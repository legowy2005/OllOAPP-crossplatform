/**
 * Real Web Bluetooth Low Energy transport for OllO Smart Glasses.
 * Connects to physical hardware via Web Bluetooth API when supported.
 */

import { BLE_CONFIG, InboundPacket, PacketParser, bytesToHex } from './protocol';
import { GlassesTransport, ConnectionState } from './GlassesTransport';
import { SimulatedGlasses } from './SimulatedGlasses';

export class WebBleGlassesTransport implements GlassesTransport {
  private _state: ConnectionState = 'DISCONNECTED';
  private _listeners: Set<(packet: InboundPacket) => void> = new Set();
  private _stateListeners: Set<(state: ConnectionState) => void> = new Set();

  private device: any = null;
  private server: any = null;
  private writeChar: any = null;
  private notifyChar: any = null;

  deviceName: string = 'Ollo';
  rssi: number | null = null;

  get connectionState(): ConnectionState {
    return this._state;
  }

  static isSupported(): boolean {
    return typeof navigator !== 'undefined' && 'bluetooth' in navigator;
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

  async connect(_addressOrId?: string): Promise<boolean> {
    if (!WebBleGlassesTransport.isSupported()) {
      throw new Error('Web Bluetooth is not supported on this browser or platform.');
    }

    try {
      this.setState('CONNECTING');
      const navBt = (navigator as any).bluetooth;

      this.device = await navBt.requestDevice({
        filters: [
          { name: BLE_CONFIG.DEVICE_NAME },
          { namePrefix: 'Ollo' },
          { services: [BLE_CONFIG.SERVICE_UUID] },
        ],
        optionalServices: [BLE_CONFIG.SERVICE_UUID],
      });

      this.deviceName = this.device.name || 'Ollo';

      this.device.addEventListener('gattserverdisconnected', () => {
        this.setState('DISCONNECTED');
      });

      this.server = await this.device.gatt.connect();
      const service = await this.server.getPrimaryService(BLE_CONFIG.SERVICE_UUID);

      this.writeChar = await service.getCharacteristic(BLE_CONFIG.WRITE_CHAR_UUID);
      this.notifyChar = await service.getCharacteristic(BLE_CONFIG.NOTIFY_CHAR_UUID);

      await this.notifyChar.startNotifications();
      this.notifyChar.addEventListener('characteristicvaluechanged', (event: any) => {
        const value = event.target.value;
        const bytes = new Uint8Array(value.buffer, value.byteOffset, value.byteLength);

        SimulatedGlasses.logPacket({
          id: Math.random().toString(36).substring(2, 9),
          timestamp: Date.now(),
          direction: 'RX',
          rawBytes: bytes,
          hex: bytesToHex(bytes),
          summary: `Physical BLE RX (${bytes.length}B)`,
        });

        const parsed = PacketParser.parseNotification(bytes);
        this._listeners.forEach((listener) => {
          try {
            listener(parsed);
          } catch (e) {
            console.error('Error in listener', e);
          }
        });
      });

      this.setState('CONNECTED');
      return true;
    } catch (err: any) {
      this.setState('DISCONNECTED');
      throw err;
    }
  }

  async disconnect(): Promise<void> {
    this.setState('DISCONNECTING');
    try {
      if (this.notifyChar) {
        await this.notifyChar.stopNotifications().catch(() => {});
      }
      if (this.server && this.server.connected) {
        this.server.disconnect();
      }
    } finally {
      this.setState('DISCONNECTED');
    }
  }

  async sendPacket(bytes: Uint8Array): Promise<boolean> {
    if (this._state !== 'CONNECTED' || !this.writeChar) {
      return false;
    }

    SimulatedGlasses.logPacket({
      id: Math.random().toString(36).substring(2, 9),
      timestamp: Date.now(),
      direction: 'TX',
      rawBytes: bytes,
      hex: bytesToHex(bytes),
      summary: `Physical BLE TX (${bytes.length}B)`,
    });

    try {
      if (this.writeChar.writeValueWithResponse) {
        await this.writeChar.writeValueWithResponse(bytes);
      } else {
        await this.writeChar.writeValue(bytes);
      }
      return true;
    } catch (e) {
      console.error('Failed to send packet over physical BLE', e);
      return false;
    }
  }
}
