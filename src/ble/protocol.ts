/**
 * OllO BLE Protocol Definition & Packet Serialization/Deserialization.
 * Exactly matches the ESP32 firmware byte-for-byte.
 * All multi-byte integers are Little-Endian.
 */

export const BLE_CONFIG = {
  DEVICE_NAME: 'Ollo',
  SERVICE_UUID: '6f6c6c6f-0001-4000-8000-00805f9b34fb',
  WRITE_CHAR_UUID: '6f6c6c6f-0002-4000-8000-00805f9b34fb',
  NOTIFY_CHAR_UUID: '6f6c6c6f-0003-4000-8000-00805f9b34fb',
  CCCD_UUID: '00002902-0000-1000-8000-00805f9b34fb',

  MAX_WRITE_BYTES: 240,
  ACK_TIMEOUT_MS: 3000,
  GET_INFO_TIMEOUT_MS: 1500,
  CHUNK_PACING_DELAY_MS: 12,
  IMG_BEGIN_SETTLE_DELAY_MS: 100,
  DEFAULT_FLASH_TOTAL: 1_441_792, // 1408 KB in bytes
  MAX_FOLDER_NAME_BYTES: 20,
} as const;

export const PACKET_TYPES = {
  // App to glasses
  BEGIN_SYNC: 0x01,
  CARD: 0x02,
  IMG_BEGIN: 0x03,
  IMG_CHUNK: 0x04,
  IMG_END: 0x05,
  END_SYNC: 0x06,
  GET_STORAGE: 0x07,
  GET_INFO: 0x08,

  // Glasses to app
  STATUS: 0x80,
  STORAGE_INFO: 0x81,
  INFO: 0x82,
} as const;

export const STATUS_CODES = {
  OK: 0,
  ERROR: 1,
  ALREADY_HAVE_IMAGE: 2,
  STORAGE_FULL: 3,
} as const;

export type StatusCode = typeof STATUS_CODES[keyof typeof STATUS_CODES];

// Inbound packet types
export interface StatusPacket {
  type: typeof PACKET_TYPES.STATUS;
  refType: number;
  status: StatusCode;
  statusName: string;
}

export interface StorageInfoPacket {
  type: typeof PACKET_TYPES.STORAGE_INFO;
  totalBytes: number;
  usedBytes: number;
  freeBytes: number;
}

export interface InfoPacket {
  type: typeof PACKET_TYPES.INFO;
  protocolVersion: number;
  maxW: number;
  maxH: number;
  maxImageBytes: number;
  maxTextBytes: number;
  flags: number;
  colorSupported: boolean;
  gray2Supported: boolean;
}

export interface UnknownPacket {
  type: 'UNKNOWN';
  rawBytes: Uint8Array;
}

export type InboundPacket = StatusPacket | StorageInfoPacket | InfoPacket | UnknownPacket;

// Helper writers for Little-Endian
function writeU16LE(buffer: Uint8Array, offset: number, value: number) {
  buffer[offset] = value & 0xFF;
  buffer[offset + 1] = (value >> 8) & 0xFF;
}

function writeU32LE(buffer: Uint8Array, offset: number, value: number) {
  buffer[offset] = value & 0xFF;
  buffer[offset + 1] = (value >> 8) & 0xFF;
  buffer[offset + 2] = (value >> 16) & 0xFF;
  buffer[offset + 3] = (value >>> 24) & 0xFF;
}

function readU16LE(buffer: Uint8Array, offset: number): number {
  return buffer[offset] | (buffer[offset + 1] << 8);
}

function readU32LE(buffer: Uint8Array, offset: number): number {
  return (
    buffer[offset] |
    (buffer[offset + 1] << 8) |
    (buffer[offset + 2] << 16) |
    ((buffer[offset + 3] << 24) >>> 0)
  ) >>> 0;
}

/**
 * PacketBuilder builds outgoing packets byte-for-byte.
 */
export class PacketBuilder {
  static buildBeginSync(cardCount: number): Uint8Array {
    const packet = new Uint8Array(3);
    packet[0] = PACKET_TYPES.BEGIN_SYNC;
    writeU16LE(packet, 1, cardCount);
    return packet;
  }

  /**
   * CARD v1 (when folder name is empty or omitted):
   * [0x02][index u16][frontImg u32][backImg u32][frontLen u8][backLen u8][front][back]
   */
  static buildCardV1(
    index: number,
    frontImg: number,
    backImg: number,
    frontText: string,
    backText: string
  ): Uint8Array {
    const encoder = new TextEncoder();
    const frontBytes = encoder.encode(frontText);
    const backBytes = encoder.encode(backText);

    const totalLen = 1 + 2 + 4 + 4 + 1 + 1 + frontBytes.length + backBytes.length;
    const packet = new Uint8Array(totalLen);

    let offset = 0;
    packet[offset++] = PACKET_TYPES.CARD;
    writeU16LE(packet, offset, index);
    offset += 2;
    writeU32LE(packet, offset, frontImg >>> 0);
    offset += 4;
    writeU32LE(packet, offset, backImg >>> 0);
    offset += 4;
    packet[offset++] = frontBytes.length & 0xFF;
    packet[offset++] = backBytes.length & 0xFF;
    packet.set(frontBytes, offset);
    offset += frontBytes.length;
    packet.set(backBytes, offset);

    return packet;
  }

  /**
   * CARD v2 (folder name present):
   * [0x02][index u16][frontImg u32][backImg u32][folderLen u8][frontLen u8][backLen u8][folder][front][back]
   */
  static buildCardV2(
    index: number,
    frontImg: number,
    backImg: number,
    folderName: string,
    frontText: string,
    backText: string
  ): Uint8Array {
    const encoder = new TextEncoder();
    let folderBytes = encoder.encode(folderName);
    if (folderBytes.length > BLE_CONFIG.MAX_FOLDER_NAME_BYTES) {
      folderBytes = folderBytes.slice(0, BLE_CONFIG.MAX_FOLDER_NAME_BYTES);
    }
    const frontBytes = encoder.encode(frontText);
    const backBytes = encoder.encode(backText);

    const totalLen = 1 + 2 + 4 + 4 + 1 + 1 + 1 + folderBytes.length + frontBytes.length + backBytes.length;
    const packet = new Uint8Array(totalLen);

    let offset = 0;
    packet[offset++] = PACKET_TYPES.CARD;
    writeU16LE(packet, offset, index);
    offset += 2;
    writeU32LE(packet, offset, frontImg >>> 0);
    offset += 4;
    writeU32LE(packet, offset, backImg >>> 0);
    offset += 4;
    packet[offset++] = folderBytes.length & 0xFF;
    packet[offset++] = frontBytes.length & 0xFF;
    packet[offset++] = backBytes.length & 0xFF;

    packet.set(folderBytes, offset);
    offset += folderBytes.length;
    packet.set(frontBytes, offset);
    offset += frontBytes.length;
    packet.set(backBytes, offset);

    return packet;
  }

  /**
   * IMG_BEGIN:
   * format 0: [0x03][id u32][w u16][h u16][dataLen u32] (13 bytes)
   * format 1 or 2: same plus [format u8] (14 bytes)
   */
  static buildImgBegin(
    id: number,
    w: number,
    h: number,
    dataLen: number,
    format: 0 | 1 | 2 = 0
  ): Uint8Array {
    const len = format === 0 ? 13 : 14;
    const packet = new Uint8Array(len);

    packet[0] = PACKET_TYPES.IMG_BEGIN;
    writeU32LE(packet, 1, id >>> 0);
    writeU16LE(packet, 5, w);
    writeU16LE(packet, 7, h);
    writeU32LE(packet, 9, dataLen >>> 0);

    if (format !== 0) {
      packet[13] = format;
    }
    return packet;
  }

  /**
   * IMG_CHUNK:
   * [0x04][offset u32][data...]
   */
  static buildImgChunk(offset: number, chunkData: Uint8Array): Uint8Array {
    const packet = new Uint8Array(5 + chunkData.length);
    packet[0] = PACKET_TYPES.IMG_CHUNK;
    writeU32LE(packet, 1, offset >>> 0);
    packet.set(chunkData, 5);
    return packet;
  }

  /**
   * IMG_END:
   * [0x05][checksum u8] where checksum = (sum of all image bytes) & 0xFF
   */
  static buildImgEnd(checksum: number): Uint8Array {
    const packet = new Uint8Array(2);
    packet[0] = PACKET_TYPES.IMG_END;
    packet[1] = checksum & 0xFF;
    return packet;
  }

  static buildEndSync(): Uint8Array {
    return new Uint8Array([PACKET_TYPES.END_SYNC]);
  }

  static buildGetStorage(): Uint8Array {
    return new Uint8Array([PACKET_TYPES.GET_STORAGE]);
  }

  static buildGetInfo(): Uint8Array {
    return new Uint8Array([PACKET_TYPES.GET_INFO]);
  }
}

/**
 * PacketParser parses notifications from glasses.
 * Per specification: "Anything else or malformed becomes Unknown(raw bytes); the parser must never throw."
 */
export class PacketParser {
  static parseNotification(data: Uint8Array): InboundPacket {
    try {
      if (!data || data.length === 0) {
        return { type: 'UNKNOWN', rawBytes: data || new Uint8Array() };
      }

      const type = data[0];

      // 0x80 STATUS [0x80][refType u8][status u8]
      if (type === PACKET_TYPES.STATUS) {
        if (data.length >= 3) {
          const refType = data[1];
          const status = data[2] as StatusCode;
          let statusName = 'UNKNOWN';
          switch (status) {
            case STATUS_CODES.OK:
              statusName = 'OK';
              break;
            case STATUS_CODES.ERROR:
              statusName = 'ERROR';
              break;
            case STATUS_CODES.ALREADY_HAVE_IMAGE:
              statusName = 'ALREADY_HAVE_IMAGE';
              break;
            case STATUS_CODES.STORAGE_FULL:
              statusName = 'STORAGE_FULL';
              break;
          }
          return {
            type: PACKET_TYPES.STATUS,
            refType,
            status,
            statusName,
          };
        }
      }

      // 0x81 STORAGE_INFO [0x81][totalBytes u32 LE][usedBytes u32 LE]
      if (type === PACKET_TYPES.STORAGE_INFO) {
        if (data.length >= 9) {
          const totalBytes = readU32LE(data, 1);
          const usedBytes = readU32LE(data, 5);
          const freeBytes = Math.max(0, totalBytes - usedBytes);
          return {
            type: PACKET_TYPES.STORAGE_INFO,
            totalBytes,
            usedBytes,
            freeBytes,
          };
        }
      }

      // 0x82 INFO [0x82][protocolVersion u8][maxW u16][maxH u16][maxImageBytes u32][maxTextBytes u8][flags u8 optional]
      // Needs at least 11 bytes
      if (type === PACKET_TYPES.INFO) {
        if (data.length >= 11) {
          const protocolVersion = data[1];
          const maxW = readU16LE(data, 2);
          const maxH = readU16LE(data, 4);
          const maxImageBytes = readU32LE(data, 6);
          const maxTextBytes = data[10];
          const flags = data.length >= 12 ? data[11] : 0;
          const colorSupported = (flags & 0x01) !== 0;
          const gray2Supported = (flags & 0x02) !== 0;

          return {
            type: PACKET_TYPES.INFO,
            protocolVersion,
            maxW,
            maxH,
            maxImageBytes,
            maxTextBytes,
            flags,
            colorSupported,
            gray2Supported,
          };
        }
      }

      return { type: 'UNKNOWN', rawBytes: data };
    } catch {
      return { type: 'UNKNOWN', rawBytes: data || new Uint8Array() };
    }
  }
}

/**
 * Format raw bytes as hex string for packet diagnostics.
 */
export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0').toUpperCase())
    .join(' ');
}
