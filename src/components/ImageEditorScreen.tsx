import React, { useState, useEffect, useRef } from 'react';
import { db, ImageEntity } from '../data/database';
import { ScreenDestination } from '../navigation';
import {
  RESOLUTION_PRESETS,
  ImageProcessingOptions,
  ImageFormat,
  processImageForGlasses,
  ProcessedImageResult,
} from '../core/imagePipeline';
import { SAMPLE_GRAPHICS } from '../core/sampleGraphics';
import {
  ArrowLeft,
  Upload,
  RotateCw,
  FlipHorizontal,
  FlipVertical,
  Sliders,
  Crop,
  Eye,
  Save,
  Sparkles,
  Layers,
  Palette,
  Check,
  RefreshCw,
} from 'lucide-react';

interface ImageEditorScreenProps {
  folderId: number;
  cardId?: number;
  isFront: boolean;
  onNavigate: (dest: ScreenDestination) => void;
}

export const ImageEditorScreen: React.FC<ImageEditorScreenProps> = ({
  folderId,
  cardId,
  isFront,
  onNavigate,
}) => {
  // Source canvas ref or image element
  const [sourceCanvas, setSourceCanvas] = useState<HTMLCanvasElement | null>(null);
  const [sourceW, setSourceW] = useState(640);
  const [sourceH, setSourceH] = useState(400);

  // Editor configuration
  const [presetIndex, setPresetIndex] = useState(3); // Default 640x400 OLED Native
  const [format, setFormat] = useState<ImageFormat>(0); // 0 = 1-bit, 1 = RGB565, 2 = 2-bit
  const [rotateDeg, setRotateDeg] = useState<0 | 90 | 180 | 270>(0);
  const [flipH, setFlipH] = useState(false);
  const [flipV, setFlipV] = useState(false);
  const [threshold, setThreshold] = useState(128);
  const [useSauvola, setUseSauvola] = useState(false);
  const [useDithering, setUseDithering] = useState(false);
  const [invert, setInvert] = useState(false);
  const [despeckle, setDespeckle] = useState(true);

  // Crop ratios (0.0 to 1.0)
  const [crop, setCrop] = useState({
    leftRatio: 0,
    topRatio: 0,
    rightRatio: 0,
    bottomRatio: 0,
  });
  const [lockRatio, setLockRatio] = useState(false);

  // Preview result
  const [processedResult, setProcessedResult] = useState<ProcessedImageResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // OLED phosphor color theme for preview simulation
  const [oledColorTheme, setOledColorTheme] = useState<'green' | 'white' | 'amber'>('green');

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize with the first sample graphic (Kanji Study)
  useEffect(() => {
    loadSampleGraphic(SAMPLE_GRAPHICS[0].id);
  }, []);

  const loadSampleGraphic = (sampleId: string) => {
    const sample = SAMPLE_GRAPHICS.find((s) => s.id === sampleId) || SAMPLE_GRAPHICS[0];
    const canvas = sample.generate();
    setSourceCanvas(canvas);
    setSourceW(canvas.width);
    setSourceH(canvas.height);
    resetCrop();
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        // Downscale to at most 2048px per spec
        const maxDim = 2048;
        let w = img.width;
        let h = img.height;
        if (w > maxDim || h > maxDim) {
          const scale = maxDim / Math.max(w, h);
          w = Math.round(w * scale);
          h = Math.round(h * scale);
        }

        const c = document.createElement('canvas');
        c.width = w;
        c.height = h;
        const ctx = c.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, w, h);
          setSourceCanvas(c);
          setSourceW(w);
          setSourceH(h);
          resetCrop();
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const resetCrop = () => {
    setCrop({ leftRatio: 0, topRatio: 0, rightRatio: 0, bottomRatio: 0 });
  };

  // Run pipeline whenever controls change
  useEffect(() => {
    if (!sourceCanvas) return;

    let cancelled = false;
    setIsProcessing(true);

    const preset = RESOLUTION_PRESETS[presetIndex];
    const options: ImageProcessingOptions = {
      targetWidth: preset.width,
      targetHeight: preset.height,
      format,
      rotateDeg,
      flipH,
      flipV,
      crop,
      threshold,
      useSauvola,
      useDithering,
      invert,
      despeckle,
    };

    processImageForGlasses(sourceCanvas, sourceW, sourceH, options)
      .then((res) => {
        if (!cancelled) {
          setProcessedResult(res);
          setIsProcessing(false);
        }
      })
      .catch((err) => {
        console.error('Error processing image:', err);
        if (!cancelled) setIsProcessing(false);
      });

    return () => {
      cancelled = true;
    };
  }, [
    sourceCanvas,
    sourceW,
    sourceH,
    presetIndex,
    format,
    rotateDeg,
    flipH,
    flipV,
    crop,
    threshold,
    useSauvola,
    useDithering,
    invert,
    despeckle,
  ]);

  const handleRotate = () => {
    setRotateDeg((prev) => {
      const next = (prev + 90) % 360;
      return next as 0 | 90 | 180 | 270;
    });
  };

  const handleSaveAndReturn = () => {
    if (!processedResult) return;

    const imgEntity: ImageEntity = {
      id: processedResult.id,
      width: processedResult.width,
      height: processedResult.height,
      device_data: processedResult.deviceData,
      display_data: processedResult.dataUrl,
      created_at: Date.now(),
      format: processedResult.format,
    };

    db.saveImage(imgEntity);

    // If cardId exists, link image directly
    if (cardId) {
      const card = db.getCard(cardId);
      if (card) {
        db.saveCard(
          folderId,
          cardId,
          card.front_text,
          card.back_text,
          isFront ? imgEntity.id : card.front_image_id,
          isFront ? card.back_image_id : imgEntity.id
        );
      }
    }

    onNavigate({
      type: 'CardEditor',
      folderId,
      cardId,
    });
  };

  const preset = RESOLUTION_PRESETS[presetIndex];

  return (
    <div className="w-full max-w-6xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <button
            onClick={() => onNavigate({ type: 'CardEditor', folderId, cardId })}
            className="inline-flex items-center gap-1.5 text-xs text-[#A8A8A8] hover:text-[#D9D9D9] transition-colors cursor-pointer mb-1"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Card Editor ({isFront ? 'Front Graphic' : 'Back Graphic'})
          </button>
          <h1 className="text-2xl font-bold text-[#D9D9D9] tracking-tight">
            Micro-OLED Image Pipeline
          </h1>
          <p className="text-xs text-[#A8A8A8]">
            Format, dither, and quantize graphics with hardware-accurate preview for smart glasses.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-medium rounded-lg bg-[#383838] text-[#D9D9D9] hover:bg-[#4A4A4A] border border-[#4A4A4A] transition-colors cursor-pointer"
          >
            <Upload className="w-4 h-4 text-[#7FB5A5]" />
            Upload File
          </button>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept="image/*"
            className="hidden"
          />

          <button
            onClick={handleSaveAndReturn}
            disabled={!processedResult}
            className="flex items-center gap-2 px-5 py-2 text-xs font-semibold rounded-lg bg-[#D9D9D9] text-[#282828] hover:bg-white disabled:opacity-50 transition-colors cursor-pointer shadow-sm"
          >
            <Save className="w-4 h-4" />
            Save Graphic to Card
          </button>
        </div>
      </div>

      {/* Main Grid: Controls on Left, Live OLED Simulator on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN: Controls & Presets */}
        <div className="lg:col-span-5 space-y-4">
          {/* Sample Graphics Selector */}
          <div className="bg-[#2F2F2F] border border-[#4A4A4A] rounded-xl p-4 space-y-2.5">
            <span className="text-xs font-bold text-[#7FB5A5] uppercase tracking-wider">
              Built-in Test Graphics
            </span>
            <div className="grid grid-cols-2 gap-2">
              {SAMPLE_GRAPHICS.map((sg) => (
                <button
                  key={sg.id}
                  onClick={() => loadSampleGraphic(sg.id)}
                  className="px-2.5 py-2 text-left rounded-lg bg-[#282828] hover:bg-[#383838] border border-[#4A4A4A] text-xs transition-colors cursor-pointer"
                >
                  <div className="font-semibold text-[#D9D9D9] truncate">{sg.name}</div>
                  <div className="text-[10px] text-[#A8A8A8] truncate mt-0.5">{sg.description}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Resolution Presets */}
          <div className="bg-[#2F2F2F] border border-[#4A4A4A] rounded-xl p-4 space-y-2.5">
            <span className="text-xs font-bold text-[#7FB5A5] uppercase tracking-wider">
              Resolution Preset
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {RESOLUTION_PRESETS.map((p, idx) => (
                <button
                  key={p.name}
                  onClick={() => setPresetIndex(idx)}
                  className={`px-3 py-2 text-left rounded-lg text-xs transition-colors cursor-pointer border ${
                    presetIndex === idx
                      ? 'bg-[#2E403B] border-[#7FB5A5] text-[#D9D9D9]'
                      : 'bg-[#282828] border-[#4A4A4A] text-[#A8A8A8] hover:text-[#D9D9D9]'
                  }`}
                >
                  <div className="font-semibold">{p.name}</div>
                  <div className="text-[10px] text-[#7D7D7D] truncate">{p.description}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Output Format Mode */}
          <div className="bg-[#2F2F2F] border border-[#4A4A4A] rounded-xl p-4 space-y-3">
            <span className="text-xs font-bold text-[#7FB5A5] uppercase tracking-wider">
              Output Encoding Format
            </span>

            <div className="space-y-2">
              {/* Format 0: 1-bit */}
              <label className="flex items-start gap-2.5 p-2 rounded-lg bg-[#282828] border border-[#4A4A4A] cursor-pointer">
                <input
                  type="radio"
                  name="format"
                  checked={format === 0}
                  onChange={() => setFormat(0)}
                  className="mt-0.5 text-[#7FB5A5] focus:ring-0 cursor-pointer"
                />
                <div className="text-xs">
                  <div className="font-semibold text-[#D9D9D9]">Format 0: 1-Bit Packed (Default)</div>
                  <div className="text-[#A8A8A8] text-[11px]">
                    Row-major bit-packed. Ultra fast BLE sync, high contrast for text & line drawings.
                  </div>
                </div>
              </label>

              {/* Format 2: 2-bit */}
              <label className="flex items-start gap-2.5 p-2 rounded-lg bg-[#282828] border border-[#4A4A4A] cursor-pointer">
                <input
                  type="radio"
                  name="format"
                  checked={format === 2}
                  onChange={() => setFormat(2)}
                  className="mt-0.5 text-[#7FB5A5] focus:ring-0 cursor-pointer"
                />
                <div className="text-xs">
                  <div className="font-semibold text-[#D9D9D9]">
                    Format 2: Smooth Grayscale (2-Bit Packed)
                  </div>
                  <div className="text-[#A8A8A8] text-[11px]">
                    4 levels (0, 85, 170, 255). Ideal for shaded anatomical diagrams & continuous-tone photos.
                  </div>
                </div>
              </label>

              {/* Format 1: RGB565 */}
              <label className="flex items-start gap-2.5 p-2 rounded-lg bg-[#282828] border border-[#4A4A4A] cursor-pointer">
                <input
                  type="radio"
                  name="format"
                  checked={format === 1}
                  onChange={() => setFormat(1)}
                  className="mt-0.5 text-[#7FB5A5] focus:ring-0 cursor-pointer"
                />
                <div className="text-xs">
                  <div className="font-semibold text-[#D9D9D9]">
                    Format 1: Experimental Color (RGB565)
                  </div>
                  <div className="text-[#A8A8A8] text-[11px]">
                    2 bytes/pixel Little-Endian. Capped to 320x240 (max 153,600 bytes).
                  </div>
                </div>
              </label>
            </div>
          </div>

          {/* Orientation & Crop Actions */}
          <div className="bg-[#2F2F2F] border border-[#4A4A4A] rounded-xl p-4 space-y-3">
            <span className="text-xs font-bold text-[#7FB5A5] uppercase tracking-wider">
              Geometry & Orientation
            </span>

            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={handleRotate}
                className="flex items-center justify-center gap-1.5 py-2 px-3 text-xs bg-[#282828] hover:bg-[#383838] border border-[#4A4A4A] rounded-lg text-[#D9D9D9] transition-colors cursor-pointer"
              >
                <RotateCw className="w-3.5 h-3.5 text-[#7FB5A5]" />
                {rotateDeg}°
              </button>

              <button
                onClick={() => setFlipH(!flipH)}
                className={`flex items-center justify-center gap-1.5 py-2 px-3 text-xs border rounded-lg transition-colors cursor-pointer ${
                  flipH
                    ? 'bg-[#2E403B] border-[#7FB5A5] text-[#D9D9D9]'
                    : 'bg-[#282828] border-[#4A4A4A] text-[#A8A8A8] hover:text-[#D9D9D9]'
                }`}
              >
                <FlipHorizontal className="w-3.5 h-3.5" />
                Flip H
              </button>

              <button
                onClick={() => setFlipV(!flipV)}
                className={`flex items-center justify-center gap-1.5 py-2 px-3 text-xs border rounded-lg transition-colors cursor-pointer ${
                  flipV
                    ? 'bg-[#2E403B] border-[#7FB5A5] text-[#D9D9D9]'
                    : 'bg-[#282828] border-[#4A4A4A] text-[#A8A8A8] hover:text-[#D9D9D9]'
                }`}
              >
                <FlipVertical className="w-3.5 h-3.5" />
                Flip V
              </button>
            </div>

            {/* Crop Sliders */}
            <div className="space-y-2 pt-2 border-t border-[#383838]">
              <div className="flex items-center justify-between text-xs text-[#A8A8A8]">
                <span className="flex items-center gap-1.5">
                  <Crop className="w-3.5 h-3.5 text-[#7FB5A5]" />
                  Crop Margins
                </span>
                <button
                  onClick={resetCrop}
                  className="text-[#7FB5A5] hover:underline cursor-pointer"
                >
                  Reset Crop
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="text-[11px] text-[#7D7D7D] block mb-1">
                    Left: {(crop.leftRatio * 100).toFixed(0)}%
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="0.45"
                    step="0.01"
                    value={crop.leftRatio}
                    onChange={(e) =>
                      setCrop({ ...crop, leftRatio: parseFloat(e.target.value) })
                    }
                    className="w-full accent-[#7FB5A5] cursor-pointer"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-[#7D7D7D] block mb-1">
                    Right: {(crop.rightRatio * 100).toFixed(0)}%
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="0.45"
                    step="0.01"
                    value={crop.rightRatio}
                    onChange={(e) =>
                      setCrop({ ...crop, rightRatio: parseFloat(e.target.value) })
                    }
                    className="w-full accent-[#7FB5A5] cursor-pointer"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-[#7D7D7D] block mb-1">
                    Top: {(crop.topRatio * 100).toFixed(0)}%
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="0.45"
                    step="0.01"
                    value={crop.topRatio}
                    onChange={(e) =>
                      setCrop({ ...crop, topRatio: parseFloat(e.target.value) })
                    }
                    className="w-full accent-[#7FB5A5] cursor-pointer"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-[#7D7D7D] block mb-1">
                    Bottom: {(crop.bottomRatio * 100).toFixed(0)}%
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="0.45"
                    step="0.01"
                    value={crop.bottomRatio}
                    onChange={(e) =>
                      setCrop({ ...crop, bottomRatio: parseFloat(e.target.value) })
                    }
                    className="w-full accent-[#7FB5A5] cursor-pointer"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Filter, Thresholding & Sauvola Controls */}
          <div className="bg-[#2F2F2F] border border-[#4A4A4A] rounded-xl p-4 space-y-3.5">
            <span className="text-xs font-bold text-[#7FB5A5] uppercase tracking-wider">
              Quantization & Filters
            </span>

            {format === 0 && (
              <>
                {/* Global Threshold Slider */}
                <div>
                  <div className="flex items-center justify-between text-xs text-[#A8A8A8] mb-1">
                    <span>Threshold: {threshold}</span>
                    <span className="text-[#7D7D7D]">0 = Black, 255 = White</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="254"
                    value={threshold}
                    disabled={useSauvola}
                    onChange={(e) => setThreshold(Number(e.target.value))}
                    className="w-full accent-[#7FB5A5] disabled:opacity-40 cursor-pointer"
                  />
                </div>

                {/* Sauvola Adaptive Threshold Toggle */}
                <label className="flex items-start gap-2.5 text-xs text-[#D9D9D9] cursor-pointer p-2 rounded-lg bg-[#282828] border border-[#4A4A4A]">
                  <input
                    type="checkbox"
                    checked={useSauvola}
                    onChange={(e) => setUseSauvola(e.target.checked)}
                    className="mt-0.5 text-[#7FB5A5] rounded focus:ring-0 cursor-pointer"
                  />
                  <div>
                    <span className="font-semibold">Sauvola Adaptive Threshold</span>
                    <p className="text-[11px] text-[#A8A8A8]">
                      Dynamic local window binarization. Essential for textbook scans, book pages, and uneven lighting.
                    </p>
                  </div>
                </label>

                {/* Dithering Toggle */}
                <label className="flex items-start gap-2.5 text-xs text-[#D9D9D9] cursor-pointer p-2 rounded-lg bg-[#282828] border border-[#4A4A4A]">
                  <input
                    type="checkbox"
                    checked={useDithering}
                    disabled={useSauvola}
                    onChange={(e) => setUseDithering(e.target.checked)}
                    className="mt-0.5 text-[#7FB5A5] rounded focus:ring-0 cursor-pointer disabled:opacity-40"
                  />
                  <div>
                    <span className="font-semibold">Floyd-Steinberg Dithering</span>
                    <p className="text-[11px] text-[#A8A8A8]">
                      Error diffusion simulating smooth halftone gradients.
                    </p>
                  </div>
                </label>
              </>
            )}

            {/* Invert & Despeckle Toggles */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <label className="flex items-center gap-2 p-2 rounded-lg bg-[#282828] border border-[#4A4A4A] cursor-pointer">
                <input
                  type="checkbox"
                  checked={invert}
                  onChange={(e) => setInvert(e.target.checked)}
                  className="text-[#7FB5A5] rounded focus:ring-0 cursor-pointer"
                />
                <span className="text-[#D9D9D9] font-medium">Invert Pixels</span>
              </label>

              <label className="flex items-center gap-2 p-2 rounded-lg bg-[#282828] border border-[#4A4A4A] cursor-pointer">
                <input
                  type="checkbox"
                  checked={despeckle}
                  onChange={(e) => setDespeckle(e.target.checked)}
                  className="text-[#7FB5A5] rounded focus:ring-0 cursor-pointer"
                />
                <span className="text-[#D9D9D9] font-medium">Remove Specks</span>
              </label>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Live OLED Glasses Hardware Simulator */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-[#2F2F2F] border border-[#4A4A4A] rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between text-xs border-b border-[#383838] pb-3">
              <div className="flex items-center gap-2 font-medium text-[#D9D9D9]">
                <Eye className="w-4 h-4 text-[#7FB5A5]" />
                <span>Smart Glasses Micro-OLED Viewport</span>
              </div>

              {/* Display Phosphor tint toggle */}
              <div className="flex items-center gap-1 bg-[#282828] p-1 rounded border border-[#4A4A4A]">
                <button
                  onClick={() => setOledColorTheme('green')}
                  className={`px-2 py-0.5 rounded text-[11px] transition-colors cursor-pointer ${
                    oledColorTheme === 'green' ? 'bg-[#2E403B] text-[#7FB5A5] font-semibold' : 'text-[#A8A8A8]'
                  }`}
                >
                  Green OLED
                </button>
                <button
                  onClick={() => setOledColorTheme('white')}
                  className={`px-2 py-0.5 rounded text-[11px] transition-colors cursor-pointer ${
                    oledColorTheme === 'white' ? 'bg-[#383838] text-white font-semibold' : 'text-[#A8A8A8]'
                  }`}
                >
                  White OLED
                </button>
                <button
                  onClick={() => setOledColorTheme('amber')}
                  className={`px-2 py-0.5 rounded text-[11px] transition-colors cursor-pointer ${
                    oledColorTheme === 'amber' ? 'bg-[#3E301F] text-[#FFB74D] font-semibold' : 'text-[#A8A8A8]'
                  }`}
                >
                  Amber
                </button>
              </div>
            </div>

            {/* Micro-OLED Display Frame */}
            <div className="relative rounded-lg overflow-hidden border-2 border-[#1E1E1E] shadow-2xl p-2 bg-[#0F0F0F]">
              <div
                className="w-full aspect-[16/10] max-h-[460px] oled-screen relative flex items-center justify-center overflow-hidden rounded"
                style={{
                  filter:
                    oledColorTheme === 'green'
                      ? 'drop-shadow(0 0 8px rgba(127, 181, 165, 0.25))'
                      : oledColorTheme === 'amber'
                      ? 'drop-shadow(0 0 8px rgba(255, 183, 77, 0.25))'
                      : 'none',
                }}
              >
                {processedResult ? (
                  <img
                    src={processedResult.dataUrl}
                    alt="Processed Glasses Output"
                    className="max-w-full max-h-full object-contain"
                    style={{
                      imageRendering: 'pixelated',
                      filter:
                        format !== 1
                          ? oledColorTheme === 'green'
                            ? 'sepia(100%) hue-rotate(110deg) saturate(300%)'
                            : oledColorTheme === 'amber'
                            ? 'sepia(100%) hue-rotate(30deg) saturate(400%)'
                            : 'none'
                          : 'none',
                    }}
                  />
                ) : (
                  <div className="text-xs text-[#7D7D7D] animate-pulse">Rendering pixel buffer...</div>
                )}
              </div>
            </div>

            {/* Hardware Metrics Strip */}
            {processedResult && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono bg-[#282828] p-3 rounded-lg border border-[#383838]">
                <div>
                  <div className="text-[#7D7D7D] text-[10px]">RESOLUTION</div>
                  <div className="text-[#D9D9D9] font-bold">
                    {processedResult.width} × {processedResult.height}
                  </div>
                </div>

                <div>
                  <div className="text-[#7D7D7D] text-[10px]">PAYLOAD SIZE</div>
                  <div className="text-[#7FB5A5] font-bold">
                    {(processedResult.byteSize / 1024).toFixed(1)} KB ({processedResult.byteSize.toLocaleString()} B)
                  </div>
                </div>

                <div>
                  <div className="text-[#7D7D7D] text-[10px]">32-BIT IMAGE ID (CRC32)</div>
                  <div className="text-[#D9D9D9] font-bold">
                    0x{processedResult.id.toString(16).toUpperCase()}
                  </div>
                </div>

                <div>
                  <div className="text-[#7D7D7D] text-[10px]">BLE CHUNKS</div>
                  <div className="text-[#D9D9D9] font-bold">
                    ~{Math.ceil(processedResult.byteSize / 235)} pkts
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
