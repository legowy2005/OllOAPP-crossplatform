/**
 * In-memory emulator for the ESP32 smart glasses firmware.
 * Fully implements the OllO BLE protocol so tests and UI can run identically
 * on desktop, web, or emulators without physical hardware.
 */

import {
  BLE_CONFIG,
  PACKET_TYPES,
  STATUS_CODES,
  InboundPacket,
  PacketParser,
  bytesToHex,
} from './protocol';
import { GlassesTransport, ConnectionState, PacketLogEntry } from './GlassesTransport';

export interface SimulatedCardData {
  index: number;
  frontImg: number;
  backImg: number;
  folderName: string;
  frontText: string;
  backText: string;
}

export interface SimulatedImageData {
  id: number;
  width: number;
  height: number;
  format: number;
  data: Uint8Array;
}

export class SimulatedGlasses implements GlassesTransport {
  private _state: ConnectionState = 'DISCONNECTED';
  private _listeners: Set<(packet: InboundPacket) => void> = new Set();
  private _stateListeners: Set<(state: ConnectionState) => void> = new Set();

  readonly deviceName: string = 'Ollo (Simulated ESP32)';
  readonly rssi: number = -58; // Realistic RSSI in dBm

  // Simulated hardware storage state
  private totalFlashBytes: number = BLE_CONFIG.DEFAULT_FLASH_TOTAL; // 1408 KB
  private baseUsedBytes: number = 32768; // System firmware & fonts overhead ~32 KB
  private storedImages: Map<number, SimulatedImageData> = new Map();
  private storedCards: SimulatedCardData[] = [];

  // In-flight sync state
  private syncActive: boolean = false;
  private currentImageSession: {
    id: number;
    width: number;
    height: number;
    dataLen: number;
    format: number;
    buffer: Uint8Array;
    bytesReceived: number;
  } | null = null;

  // Global packet logger hook
  static packetLogs: PacketLogEntry[] = [];
  static logPacket(entry: PacketLogEntry) {
    SimulatedGlasses.packetLogs.unshift(entry);
    if (SimulatedGlasses.packetLogs.length > 500) {
      SimulatedGlasses.packetLogs.pop();
    }
  }

  get connectionState(): ConnectionState {
    return this._state;
  }

  getMaxPayloadSize(): number {
    return BLE_CONFIG.MAX_WRITE_BYTES;
  }

  onNotification(listener: (packet: InboundPacket) => void): () => void {
    this._listeners.add(listener);
    return () => {
      this._listeners.delete(listener);
    };
  }

  onConnectionChange(listener: (state: ConnectionState) => void): () => void {
    this._stateListeners.add(listener);
    return () => {
      this._stateListeners.delete(listener);
    };
  }

  private setState(state: ConnectionState) {
    this._state = state;
    this._stateListeners.forEach((l) => l(state));
  }

  private emitNotification(bytes: Uint8Array, summary: string) {
    // Log RX packet
    SimulatedGlasses.logPacket({
      id: Math.random().toString(36).substring(2, 9),
      timestamp: Date.now(),
      direction: 'RX',
      rawBytes: bytes,
      hex: bytesToHex(bytes),
      summary,
    });

    const parsed = PacketParser.parseNotification(bytes);
    this._listeners.forEach((listener) => {
      try {
        listener(parsed);
      } catch (e) {
        console.error('Error in notification listener:', e);
      }
    });
  }

  async connect(_addressOrId?: string): Promise<boolean> {
    if (this._state === 'CONNECTED') return true;
    this.setState('CONNECTING');

    // Specification: ~300ms connect delay
    await new Promise((r) => setTimeout(r, 300));
    this.setState('CONNECTED');
    return true;
  }

  async disconnect(): Promise<void> {
    if (this._state === 'DISCONNECTED') return;
    this.setState('DISCONNECTING');
    await new Promise((r) => setTimeout(r, 100));
    this.setState('DISCONNECTED');
  }

  async sendPacket(bytes: Uint8Array): Promise<boolean> {
    if (this._state !== 'CONNECTED') {
      return false;
    }

    const type = bytes[0];
    let summary = `TX: 0x${type.toString(16).padStart(2, '0')}`;

    switch (type) {
      case PACKET_TYPES.BEGIN_SYNC:
        summary = `BEGIN_SYNC (${bytes.length >= 3 ? bytes[1] | (bytes[2] << 8) : 0} cards)`;
        break;
      case PACKET_TYPES.CARD:
        summary = `CARD (idx=${bytes.length >= 3 ? bytes[1] | (bytes[2] << 8) : 0})`;
        break;
      case PACKET_TYPES.IMG_BEGIN: {
        const id = bytes.length >= 5 ? ((bytes[1] | (bytes[2] << 8) | (bytes[3] << 16) | (bytes[4] << 24)) >>> 0) : 0;
        summary = `IMG_BEGIN (id=0x${id.toString(16)})`;
        break;
      }
      case PACKET_TYPES.IMG_CHUNK: {
        const offset = bytes.length >= 5 ? ((bytes[1] | (bytes[2] << 8) | (bytes[3] << 16) | (bytes[4] << 24)) >>> 0) : 0;
        summary = `IMG_CHUNK (offset=${offset}, len=${bytes.length - 5})`;
        break;
      }
      case PACKET_TYPES.IMG_END:
        summary = `IMG_END (csum=0x${bytes.length >= 2 ? bytes[1].toString(16) : 0})`;
        break;
      case PACKET_TYPES.END_SYNC:
        summary = 'END_SYNC';
        break;
      case PACKET_TYPES.GET_STORAGE:
        summary = 'GET_STORAGE';
        break;
      case PACKET_TYPES.GET_INFO:
        summary = 'GET_INFO';
        break;
    }

    SimulatedGlasses.logPacket({
      id: Math.random().toString(36).substring(2, 9),
      timestamp: Date.now(),
      direction: 'TX',
      rawBytes: bytes,
      hex: bytesToHex(bytes),
      summary,
    });

    // Emulate firmware processing asynchronously
    setTimeout(() => {
      this.handleFirmwarePacket(bytes);
    }, 15);

    return true;
  }

  private handleFirmwarePacket(bytes: Uint8Array) {
    if (!bytes || bytes.length === 0) return;
    const type = bytes[0];

    switch (type) {
      case PACKET_TYPES.GET_INFO: {
        // [0x82][protocolVersion u8][maxW u16][maxH u16][maxImageBytes u32][maxTextBytes u8][flags u8 optional]
        // flags: bit0 = RGB565 (1), bit1 = 2-bit gray (2) -> 0x03
        const resp = new Uint8Array(12);
        resp[0] = PACKET_TYPES.INFO;
        resp[1] = 1; // protocolVersion
        // maxW = 640
        resp[2] = 640 & 0xFF;
        resp[3] = (640 >> 8) & 0xFF;
        // maxH = 480
        resp[4] = 480 & 0xFF;
        resp[5] = (480 >> 8) & 0xFF;
        // maxImageBytes = 153600 (320x240x2)
        const maxImg = 153600;
        resp[6] = maxImg & 0xFF;
        resp[7] = (maxImg >> 8) & 0xFF;
        resp[8] = (maxImg >> 16) & 0xFF;
        resp[9] = (maxImg >>> 24) & 0xFF;
        // maxTextBytes = 100
        resp[10] = 100;
        // flags = 0x03 (both color and 2-bit supported)
        resp[11] = 0x03;

        this.emitNotification(resp, 'INFO (v1, 640x480, maxImg 153600B, maxText 100B, RGB565 & Gray2)');
        break;
      }

      case PACKET_TYPES.GET_STORAGE: {
        // [0x81][totalBytes u32 LE][usedBytes u32 LE]
        let currentUsed = this.baseUsedBytes;
        for (const img of this.storedImages.values()) {
          currentUsed += img.data.length;
        }
        for (const card of this.storedCards) {
          currentUsed += card.frontText.length + card.backText.length + card.folderName.length + 16;
        }

        const resp = new Uint8Array(9);
        resp[0] = PACKET_TYPES.STORAGE_INFO;
        // totalBytes LE
        resp[1] = this.totalFlashBytes & 0xFF;
        resp[2] = (this.totalFlashBytes >> 8) & 0xFF;
        resp[3] = (this.totalFlashBytes >> 16) & 0xFF;
        resp[4] = (this.totalFlashBytes >>> 24) & 0xFF;
        // usedBytes LE
        resp[5] = currentUsed & 0xFF;
        resp[6] = (currentUsed >> 8) & 0xFF;
        resp[7] = (currentUsed >> 16) & 0xFF;
        resp[8] = (currentUsed >>> 24) & 0xFF;

        const free = Math.max(0, this.totalFlashBytes - currentUsed);
        this.emitNotification(
          resp,
          `STORAGE_INFO (total=${(this.totalFlashBytes / 1024).toFixed(0)}KB, used=${(currentUsed / 1024).toFixed(1)}KB, free=${(free / 1024).toFixed(1)}KB)`
        );
        break;
      }

      case PACKET_TYPES.BEGIN_SYNC: {
        this.syncActive = true;
        this.storedCards = [];
        const resp = new Uint8Array([PACKET_TYPES.STATUS, PACKET_TYPES.BEGIN_SYNC, STATUS_CODES.OK]);
        this.emitNotification(resp, 'STATUS (ref=BEGIN_SYNC, status=OK)');
        break;
      }

      case PACKET_TYPES.CARD: {
        // [0x02][index u16][frontImg u32][backImg u32]...
        if (bytes.length >= 13) {
          const index = bytes[1] | (bytes[2] << 8);
          const frontImg = (bytes[3] | (bytes[4] << 8) | (bytes[5] << 16) | (bytes[6] << 24)) >>> 0;
          const backImg = (bytes[7] | (bytes[8] << 8) | (bytes[9] << 16) | (bytes[10] << 24)) >>> 0;

          // Check if v2 (has folderLen) or v1
          let folderName = '';
          let frontText = '';
          let backText = '';

          // Let's inspect length:
          // In v2: offset 11 is folderLen, 12 is frontLen, 13 is backLen
          // In v1: offset 11 is frontLen, 12 is backLen
          // If totalLen === 1 + 2 + 4 + 4 + 1 + 1 + frontLen + backLen -> v1
          const v1FrontLen = bytes[11];
          const v1BackLen = bytes[12];
          if (bytes.length === 13 + v1FrontLen + v1BackLen) {
            // It is v1
            const decoder = new TextDecoder('ascii');
            frontText = decoder.decode(bytes.slice(13, 13 + v1FrontLen));
            backText = decoder.decode(bytes.slice(13 + v1FrontLen, 13 + v1FrontLen + v1BackLen));
          } else {
            // v2: folderLen, frontLen, backLen
            const folderLen = bytes[11];
            const frontLen = bytes[12];
            const backLen = bytes[13];
            const decoder = new TextDecoder('ascii');
            let off = 14;
            folderName = decoder.decode(bytes.slice(off, off + folderLen));
            off += folderLen;
            frontText = decoder.decode(bytes.slice(off, off + frontLen));
            off += frontLen;
            backText = decoder.decode(bytes.slice(off, off + backLen));
          }

          this.storedCards.push({
            index,
            frontImg,
            backImg,
            folderName,
            frontText,
            backText,
          });

          const resp = new Uint8Array([PACKET_TYPES.STATUS, PACKET_TYPES.CARD, STATUS_CODES.OK]);
          this.emitNotification(resp, `STATUS (ref=CARD, idx=${index}, status=OK)`);
        } else {
          const resp = new Uint8Array([PACKET_TYPES.STATUS, PACKET_TYPES.CARD, STATUS_CODES.ERROR]);
          this.emitNotification(resp, 'STATUS (ref=CARD, status=ERROR)');
        }
        break;
      }

      case PACKET_TYPES.IMG_BEGIN: {
        // [0x03][id u32][w u16][h u16][dataLen u32][format optional]
        if (bytes.length >= 13) {
          const id = (bytes[1] | (bytes[2] << 8) | (bytes[3] << 16) | (bytes[4] << 24)) >>> 0;
          const width = bytes[5] | (bytes[6] << 8);
          const height = bytes[7] | (bytes[8] << 8);
          const dataLen = (bytes[9] | (bytes[10] << 8) | (bytes[11] << 16) | (bytes[12] << 24)) >>> 0;
          const format = bytes.length >= 14 ? bytes[13] : 0;

          // If glasses already have image with identical CRC32 ID:
          if (this.storedImages.has(id)) {
            const resp = new Uint8Array([
              PACKET_TYPES.STATUS,
              PACKET_TYPES.IMG_BEGIN,
              STATUS_CODES.ALREADY_HAVE_IMAGE,
            ]);
            this.emitNotification(resp, `STATUS (ref=IMG_BEGIN, id=0x${id.toString(16)}, ALREADY_HAVE_IMAGE)`);
            return;
          }

          this.currentImageSession = {
            id,
            width,
            height,
            dataLen,
            format,
            buffer: new Uint8Array(dataLen),
            bytesReceived: 0,
          };

          const resp = new Uint8Array([PACKET_TYPES.STATUS, PACKET_TYPES.IMG_BEGIN, STATUS_CODES.OK]);
          this.emitNotification(resp, `STATUS (ref=IMG_BEGIN, id=0x${id.toString(16)}, status=OK)`);
        }
        break;
      }

      case PACKET_TYPES.IMG_CHUNK: {
        // [0x04][offset u32][data...]
        if (this.currentImageSession && bytes.length > 5) {
          const offset = (bytes[1] | (bytes[2] << 8) | (bytes[3] << 16) | (bytes[4] << 24)) >>> 0;
          const chunk = bytes.slice(5);
          if (offset + chunk.length <= this.currentImageSession.buffer.length) {
            this.currentImageSession.buffer.set(chunk, offset);
            this.currentImageSession.bytesReceived += chunk.length;
          }
        }
        break;
      }

      case PACKET_TYPES.IMG_END: {
        // [0x05][checksum u8]
        if (this.currentImageSession && bytes.length >= 2) {
          const expectedChecksum = bytes[1];
          let actualChecksum = 0;
          for (let i = 0; i < this.currentImageSession.buffer.length; i++) {
            actualChecksum = (actualChecksum + this.currentImageSession.buffer[i]) & 0xFF;
          }

          if (actualChecksum === expectedChecksum) {
            this.storedImages.set(this.currentImageSession.id, {
              id: this.currentImageSession.id,
              width: this.currentImageSession.width,
              height: this.currentImageSession.height,
              format: this.currentImageSession.format,
              data: this.currentImageSession.buffer,
            });

            const resp = new Uint8Array([PACKET_TYPES.STATUS, PACKET_TYPES.IMG_END, STATUS_CODES.OK]);
            this.emitNotification(resp, `STATUS (ref=IMG_END, csum=0x${expectedChecksum.toString(16)}, status=OK)`);
          } else {
            const resp = new Uint8Array([PACKET_TYPES.STATUS, PACKET_TYPES.IMG_END, STATUS_CODES.ERROR]);
            this.emitNotification(resp, `STATUS (ref=IMG_END, checksum mismatch, status=ERROR)`);
          }
          this.currentImageSession = null;
        }
        break;
      }

      case PACKET_TYPES.END_SYNC: {
        this.syncActive = false;
        const resp = new Uint8Array([PACKET_TYPES.STATUS, PACKET_TYPES.END_SYNC, STATUS_CODES.OK]);
        this.emitNotification(resp, 'STATUS (ref=END_SYNC, status=OK)');
        break;
      }

      default: {
        const resp = new Uint8Array([PACKET_TYPES.STATUS, type, STATUS_CODES.ERROR]);
        this.emitNotification(resp, `STATUS (ref=0x${type.toString(16)}, status=ERROR)`);
        break;
      }
    }
  }

  // Getters for diagnostics
  getSyncedCards(): SimulatedCardData[] {
    return [...this.storedCards];
  }

  getSyncedImages(): SimulatedImageData[] {
    return Array.from(this.storedImages.values());
  }

  resetSimulatedStorage() {
    this.storedCards = [];
    this.storedImages.clear();
  }
}
