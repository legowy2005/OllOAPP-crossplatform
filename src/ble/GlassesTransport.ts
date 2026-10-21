/**
 * GlassesTransport interface and connection states.
 */

import { InboundPacket } from './protocol';

export type ConnectionState = 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED' | 'DISCONNECTING';

export interface PacketLogEntry {
  id: string;
  timestamp: number;
  direction: 'TX' | 'RX';
  rawBytes: Uint8Array;
  hex: string;
  summary: string;
}

export interface GlassesTransport {
  readonly connectionState: ConnectionState;
  readonly deviceName: string;
  readonly rssi: number | null;

  connect(addressOrId?: string): Promise<boolean>;
  disconnect(): Promise<void>;
  sendPacket(bytes: Uint8Array): Promise<boolean>;
  getMaxPayloadSize(): number;

  onNotification(listener: (packet: InboundPacket) => void): () => void;
  onConnectionChange(listener: (state: ConnectionState) => void): () => void;
}
