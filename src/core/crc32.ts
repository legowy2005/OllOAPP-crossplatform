/**
 * IEEE 802.3 CRC32 calculation.
 * Polynomial: 0xEDB88320 (reversed representation of 0x04C11DB7)
 * Initial XOR: 0xFFFFFFFF, Final XOR: 0xFFFFFFFF
 * Matches standard Java / Kotlin java.util.zip.CRC32 / KMP pure implementation.
 */

// Precomputed CRC32 table
const CRC32_TABLE = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i >>> 0;
  for (let j = 0; j < 8; j++) {
    c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
  }
  CRC32_TABLE[i] = c >>> 0;
}

/**
 * Calculates 32-bit unsigned CRC32 over arbitrary byte array.
 */
export function calculateCrc32(bytes: Uint8Array): number {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < bytes.length; i++) {
    const tableIndex = (crc ^ bytes[i]) & 0xFF;
    crc = (crc >>> 8) ^ CRC32_TABLE[tableIndex];
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

/**
 * Computes image id per OllO specification:
 * CRC32 over [width u16 LE][height u16 LE][packed pixel bytes],
 * returned as an unsigned 32-bit integer.
 */
export function calculateImageId(width: number, height: number, deviceData: Uint8Array): number {
  const buffer = new Uint8Array(4 + deviceData.length);
  // width u16 LE
  buffer[0] = width & 0xFF;
  buffer[1] = (width >> 8) & 0xFF;
  // height u16 LE
  buffer[2] = height & 0xFF;
  buffer[3] = (height >> 8) & 0xFF;
  // packed pixel bytes
  buffer.set(deviceData, 4);

  return calculateCrc32(buffer);
}
