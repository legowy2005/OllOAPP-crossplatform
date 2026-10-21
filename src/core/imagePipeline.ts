/**
 * OllO Image Processing Pipeline.
 * Pure pixel buffer manipulation matching the Kotlin Multiplatform pipeline.
 * Formats:
 * 0 = 1-bit packed (row-major, rowBytes = (w+7)/8, MSB first: pixel x sets bit 7 - (x % 8), 1 = white/on)
 * 2 = 2-bit gray packed (rowBytes = (w+3)/4, pixel x occupies bits (x & 3) * 2, levels 0 to 3, preview value = level * 85)
 * 1 = RGB565 little-endian (color limited to 320x240, max 153600 bytes)
 */

import { calculateImageId } from './crc32';

export type ImageFormat = 0 | 1 | 2; // 0 = 1-bit, 1 = RGB565, 2 = 2-bit gray

export interface ResolutionPreset {
  name: string;
  width: number;
  height: number;
  description: string;
}

export const RESOLUTION_PRESETS: ResolutionPreset[] = [
  { name: '320x240 Min', width: 320, height: 240, description: 'Minimum resolution, fastest sync' },
  { name: '400x300', width: 400, height: 300, description: 'Standard balanced ratio' },
  { name: '480x360', width: 480, height: 360, description: 'High definition 4:3' },
  { name: '640x400 OLED Native', width: 640, height: 400, description: 'Native micro-OLED panel ratio' },
  { name: '640x480 Max', width: 640, height: 480, description: 'Maximum glasses display resolution' },
];

export interface ImageProcessingOptions {
  targetWidth: number;
  targetHeight: number;
  format: ImageFormat;
  rotateDeg: 0 | 90 | 180 | 270;
  flipH: boolean;
  flipV: boolean;
  crop: {
    leftRatio: number;
    topRatio: number;
    rightRatio: number;
    bottomRatio: number;
  };
  threshold: number; // 0 to 255 (default 128)
  useSauvola: boolean;
  useDithering: boolean;
  invert: boolean;
  despeckle: boolean;
}

export interface ProcessedImageResult {
  id: number; // 32-bit CRC32 unsigned integer
  width: number;
  height: number;
  format: ImageFormat;
  deviceData: Uint8Array;
  dataUrl: string; // PNG preview Data URL
  byteSize: number;
  checksum: number; // Sum of device_data bytes & 0xFF
}

/**
 * Grayscale conversion using ITU-R BT.601 standard weights.
 */
export function rgbaToGrayscale(rgba: Uint8ClampedArray, width: number, height: number): Uint8Array {
  const gray = new Uint8Array(width * height);
  for (let i = 0; i < gray.length; i++) {
    const r = rgba[i * 4];
    const g = rgba[i * 4 + 1];
    const b = rgba[i * 4 + 2];
    // Y = 0.299 R + 0.587 G + 0.114 B
    gray[i] = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
  }
  return gray;
}

/**
 * Fast Sauvola Adaptive Thresholding for document / text legibility.
 * Uses integral images for O(1) local mean and variance.
 * T(x, y) = m(x, y) * (1 + k * (s(x, y) / R - 1))
 */
export function applySauvola(
  gray: Uint8Array,
  width: number,
  height: number,
  windowSize: number = 21,
  k: number = 0.28,
  R: number = 128
): Uint8Array {
  const n = width * height;
  const binary = new Uint8Array(n);

  const integral = new Float64Array((width + 1) * (height + 1));
  const integralSq = new Float64Array((width + 1) * (height + 1));

  // Build integral image
  for (let y = 0; y < height; y++) {
    let rowSum = 0;
    let rowSumSq = 0;
    const yOffset = y * width;
    const intOffset = (y + 1) * (width + 1);
    const prevIntOffset = y * (width + 1);

    for (let x = 0; x < width; x++) {
      const val = gray[yOffset + x];
      rowSum += val;
      rowSumSq += val * val;

      integral[intOffset + (x + 1)] = integral[prevIntOffset + (x + 1)] + rowSum;
      integralSq[intOffset + (x + 1)] = integralSq[prevIntOffset + (x + 1)] + rowSumSq;
    }
  }

  const half = Math.floor(windowSize / 2);

  for (let y = 0; y < height; y++) {
    const y0 = Math.max(0, y - half);
    const y1 = Math.min(height - 1, y + half);
    const h = y1 - y0 + 1;

    for (let x = 0; x < width; x++) {
      const x0 = Math.max(0, x - half);
      const x1 = Math.min(width - 1, x + half);
      const w = x1 - x0 + 1;
      const count = w * h;

      // Area in integral image
      const intW = width + 1;
      const sum =
        integral[(y1 + 1) * intW + (x1 + 1)] -
        integral[y0 * intW + (x1 + 1)] -
        integral[(y1 + 1) * intW + x0] +
        integral[y0 * intW + x0];

      const sumSq =
        integralSq[(y1 + 1) * intW + (x1 + 1)] -
        integralSq[y0 * intW + (x1 + 1)] -
        integralSq[(y1 + 1) * intW + x0] +
        integralSq[y0 * intW + x0];

      const mean = sum / count;
      const variance = Math.max(0, sumSq / count - mean * mean);
      const stdDev = Math.sqrt(variance);

      const threshold = mean * (1.0 + k * (stdDev / R - 1.0));
      const pixelVal = gray[y * width + x];

      // Document threshold: if pixelVal >= threshold -> background (white / 255), else text (black / 0)
      binary[y * width + x] = pixelVal >= threshold ? 255 : 0;
    }
  }

  return binary;
}

/**
 * Remove isolated black noise specks to keep glasses display clean.
 */
export function despeckleImage(binary: Uint8Array, width: number, height: number): Uint8Array {
  const result = new Uint8Array(binary);
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;
      if (binary[idx] === 0) {
        // Pixel is black. Check 8 neighbors.
        let whiteNeighbors = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            if (binary[(y + dy) * width + (x + dx)] === 255) {
              whiteNeighbors++;
            }
          }
        }
        if (whiteNeighbors >= 7) {
          result[idx] = 255; // isolated noise speck
        }
      }
    }
  }
  return result;
}

/**
 * Floyd-Steinberg error diffusion dithering.
 */
export function floydSteinbergDither(
  gray: Uint8Array,
  width: number,
  height: number,
  threshold: number = 128
): Uint8Array {
  const buffer = new Float32Array(gray);
  const out = new Uint8Array(width * height);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      const oldVal = buffer[idx];
      const newVal = oldVal >= threshold ? 255 : 0;
      out[idx] = newVal;
      const err = oldVal - newVal;

      if (x + 1 < width) {
        buffer[idx + 1] += (err * 7) / 16;
      }
      if (y + 1 < height) {
        if (x - 1 >= 0) {
          buffer[(y + 1) * width + (x - 1)] += (err * 3) / 16;
        }
        buffer[(y + 1) * width + x] += (err * 5) / 16;
        if (x + 1 < width) {
          buffer[(y + 1) * width + (x + 1)] += (err * 1) / 16;
        }
      }
    }
  }
  return out;
}

/**
 * Quantize to 4 levels for 2-bit grayscale (0, 1, 2, 3).
 */
export function quantize2Bit(gray: Uint8Array): Uint8Array {
  const out = new Uint8Array(gray.length);
  for (let i = 0; i < gray.length; i++) {
    const val = gray[i];
    if (val < 64) {
      out[i] = 0;
    } else if (val < 128) {
      out[i] = 1;
    } else if (val < 192) {
      out[i] = 2;
    } else {
      out[i] = 3;
    }
  }
  return out;
}

/**
 * Packs binary image into format 0 (1-bit packed).
 * row-major, rowBytes = (w+7)/8, MSB first: pixel x sets bit 7 - (x % 8), 1 = white/on
 */
export function pack1BitFormat(pixels: Uint8Array, width: number, height: number): Uint8Array {
  const rowBytes = Math.floor((width + 7) / 8);
  const packed = new Uint8Array(rowBytes * height);

  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowBytes;
    const pixelRowOffset = y * width;
    for (let x = 0; x < width; x++) {
      const pixelVal = pixels[pixelRowOffset + x];
      // 1 = white/on (pixelVal > 127)
      if (pixelVal > 127) {
        const byteIndex = rowOffset + Math.floor(x / 8);
        const bitPosition = 7 - (x % 8);
        packed[byteIndex] |= 1 << bitPosition;
      }
    }
  }
  return packed;
}

/**
 * Packs 4-level gray into format 2 (2-bit gray packed).
 * rowBytes = (w+3)/4, pixel x occupies bits (x & 3) * 2, levels 0 to 3
 */
export function pack2BitFormat(levels: Uint8Array, width: number, height: number): Uint8Array {
  const rowBytes = Math.floor((width + 3) / 4);
  const packed = new Uint8Array(rowBytes * height);

  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowBytes;
    const pixelRowOffset = y * width;
    for (let x = 0; x < width; x++) {
      const level = levels[pixelRowOffset + x] & 0x03;
      const byteIndex = rowOffset + Math.floor(x / 4);
      const shift = (x & 3) * 2;
      packed[byteIndex] |= level << shift;
    }
  }
  return packed;
}

/**
 * Packs RGBA into format 1 (RGB565 little-endian).
 * Color limited to 320x240, max 153600 bytes.
 */
export function packRgb565Format(rgba: Uint8ClampedArray, width: number, height: number): Uint8Array {
  const packed = new Uint8Array(width * height * 2);
  let pIdx = 0;
  for (let i = 0; i < width * height; i++) {
    const r = rgba[i * 4];
    const g = rgba[i * 4 + 1];
    const b = rgba[i * 4 + 2];

    const r5 = (r >> 3) & 0x1F;
    const g6 = (g >> 2) & 0x3F;
    const b5 = (b >> 3) & 0x1F;
    const rgb565 = (r5 << 11) | (g6 << 5) | b5;

    // Little-endian
    packed[pIdx++] = rgb565 & 0xFF;
    packed[pIdx++] = (rgb565 >> 8) & 0xFF;
  }
  return packed;
}

/**
 * Complete processor that runs the pipeline on an HTMLCanvasElement or ImageBitmap.
 */
export async function processImageForGlasses(
  sourceImage: CanvasImageSource,
  sourceW: number,
  sourceH: number,
  options: ImageProcessingOptions
): Promise<ProcessedImageResult> {
  // If format is RGB565 (1), cap resolution to 320x240 per spec
  let targetW = options.targetWidth;
  let targetH = options.targetHeight;
  if (options.format === 1) {
    targetW = Math.min(320, targetW);
    targetH = Math.min(240, targetH);
  }

  // Offscreen canvas for spatial operations (crop, rotate, flip, letterboxing)
  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) {
    throw new Error('Canvas 2D context not available');
  }

  // Fill canvas with white background (standard flashcard canvas)
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, targetW, targetH);

  // Compute crop box on source
  const cropL = options.crop.leftRatio * sourceW;
  const cropT = options.crop.topRatio * sourceH;
  const cropR = (1 - options.crop.rightRatio) * sourceW;
  const cropB = (1 - options.crop.bottomRatio) * sourceH;
  const cropW = Math.max(1, cropR - cropL);
  const cropH = Math.max(1, cropB - cropT);

  // Temporary canvas for crop and rotation/flip
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = cropW;
  tempCanvas.height = cropH;
  const tCtx = tempCanvas.getContext('2d');
  if (tCtx) {
    tCtx.drawImage(sourceImage, cropL, cropT, cropW, cropH, 0, 0, cropW, cropH);
  }

  // Apply rotate and flip
  const rotCanvas = document.createElement('canvas');
  const isRotated90or270 = options.rotateDeg === 90 || options.rotateDeg === 270;
  rotCanvas.width = isRotated90or270 ? cropH : cropW;
  rotCanvas.height = isRotated90or270 ? cropW : cropH;
  const rCtx = rotCanvas.getContext('2d');

  if (rCtx) {
    rCtx.save();
    rCtx.translate(rotCanvas.width / 2, rotCanvas.height / 2);
    rCtx.rotate((options.rotateDeg * Math.PI) / 180);
    rCtx.scale(options.flipH ? -1 : 1, options.flipV ? -1 : 1);
    rCtx.drawImage(tempCanvas, -cropW / 2, -cropH / 2);
    rCtx.restore();
  }

  // Draw into target canvas with aspect fit (letterboxed on white)
  const fitScale = Math.min(targetW / rotCanvas.width, targetH / rotCanvas.height);
  const fittedW = Math.round(rotCanvas.width * fitScale);
  const fittedH = Math.round(rotCanvas.height * fitScale);
  const posX = Math.round((targetW - fittedW) / 2);
  const posY = Math.round((targetH - fittedH) / 2);

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(rotCanvas, posX, posY, fittedW, fittedH);

  // Read back pixel data
  const imageData = ctx.getImageData(0, 0, targetW, targetH);
  let deviceData: Uint8Array;

  // Process based on format
  if (options.format === 1) {
    // RGB565 color
    deviceData = packRgb565Format(imageData.data, targetW, targetH);
  } else if (options.format === 2) {
    // 2-bit grayscale
    let gray = rgbaToGrayscale(imageData.data, targetW, targetH);
    if (options.invert) {
      for (let i = 0; i < gray.length; i++) gray[i] = 255 - gray[i];
    }
    const levels = quantize2Bit(gray);
    deviceData = pack2BitFormat(levels, targetW, targetH);

    // Update display canvas with 2-bit preview values (level * 85)
    for (let i = 0; i < levels.length; i++) {
      const val = levels[i] * 85;
      imageData.data[i * 4] = val;
      imageData.data[i * 4 + 1] = val;
      imageData.data[i * 4 + 2] = val;
    }
    ctx.putImageData(imageData, 0, 0);
  } else {
    // 0 = 1-bit monochrome
    let gray = rgbaToGrayscale(imageData.data, targetW, targetH);

    let binary: Uint8Array;
    if (options.useSauvola) {
      binary = applySauvola(gray, targetW, targetH, 21, 0.28, 128);
    } else if (options.useDithering) {
      binary = floydSteinbergDither(gray, targetW, targetH, options.threshold);
    } else {
      binary = new Uint8Array(gray.length);
      const th = options.threshold;
      for (let i = 0; i < gray.length; i++) {
        binary[i] = gray[i] >= th ? 255 : 0;
      }
    }

    if (options.despeckle) {
      binary = despeckleImage(binary, targetW, targetH);
    }

    if (options.invert) {
      for (let i = 0; i < binary.length; i++) {
        binary[i] = binary[i] === 255 ? 0 : 255;
      }
    }

    deviceData = pack1BitFormat(binary, targetW, targetH);

    // Update display canvas with crisp 1-bit preview
    for (let i = 0; i < binary.length; i++) {
      const val = binary[i];
      imageData.data[i * 4] = val;
      imageData.data[i * 4 + 1] = val;
      imageData.data[i * 4 + 2] = val;
    }
    ctx.putImageData(imageData, 0, 0);
  }

  // Calculate checksum = sum of all deviceData bytes & 0xFF
  let checksum = 0;
  for (let i = 0; i < deviceData.length; i++) {
    checksum = (checksum + deviceData[i]) & 0xFF;
  }

  // Calculate CRC32 32-bit image ID over [width u16 LE][height u16 LE][deviceData]
  const imageId = calculateImageId(targetW, targetH, deviceData);
  const dataUrl = canvas.toDataURL('image/png');

  return {
    id: imageId,
    width: targetW,
    height: targetH,
    format: options.format,
    deviceData,
    dataUrl,
    byteSize: deviceData.length,
    checksum,
  };
}
