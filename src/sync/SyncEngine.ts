/**
 * OllO SyncEngine.
 * Implements the full synchronization lifecycle to smart glasses over Bluetooth Low Energy.
 * Follows exact sequence, retry timing, and packet format specified in the hardware protocol.
 */

import {
  BLE_CONFIG,
  PACKET_TYPES,
  STATUS_CODES,
  InboundPacket,
  PacketBuilder,
  StatusPacket,
  StorageInfoPacket,
  InfoPacket,
} from '../ble/protocol';
import { GlassesTransport, ConnectionState } from '../ble/GlassesTransport';
import { db, CardEntity, FolderEntity, ImageEntity } from '../data/database';
import { transliterateToGlassesAscii } from '../core/asciiTransliteration';

export type SyncPhase =
  | 'Idle'
  | 'Connecting'
  | 'CheckingInfo'
  | 'CheckingStorage'
  | 'SendingCards'
  | 'SendingImages'
  | 'Finalizing'
  | 'Done'
  | 'Failed';

export interface DeviceLimits {
  protocolVersion: number;
  maxWidth: number;
  maxHeight: number;
  maxImageBytes: number;
  maxTextBytes: number;
  colorSupported: boolean;
  gray2Supported: boolean;
}

export interface SyncProgressState {
  phase: SyncPhase;
  stepName: string;
  progress: number; // 0.0 to 1.0
  statusText: string;
  totalCards: number;
  syncedCards: number;
  totalImages: number;
  syncedImages: number;
  storageTotalBytes: number;
  storageFreeBytes: number;
  canRetry: boolean;
  errorMessage?: string;
  active: boolean;
}

export class SyncEngine {
  private transport: GlassesTransport;
  private cancelled: boolean = false;
  private unsubscribeNotifications: (() => void) | null = null;
  private pendingResolvers: Set<(packet: InboundPacket) => void> = new Set();

  private deviceLimits: DeviceLimits = {
    protocolVersion: 1,
    maxWidth: 640,
    maxHeight: 480,
    maxImageBytes: 153600,
    maxTextBytes: 100,
    colorSupported: false,
    gray2Supported: false,
  };

  private state: SyncProgressState = {
    phase: 'Idle',
    stepName: 'Ready',
    progress: 0,
    statusText: 'Ready to sync',
    totalCards: 0,
    syncedCards: 0,
    totalImages: 0,
    syncedImages: 0,
    storageTotalBytes: BLE_CONFIG.DEFAULT_FLASH_TOTAL,
    storageFreeBytes: BLE_CONFIG.DEFAULT_FLASH_TOTAL,
    canRetry: true,
    active: false,
  };

  private listeners: Set<(state: SyncProgressState) => void> = new Set();

  constructor(transport: GlassesTransport) {
    this.transport = transport;
  }

  setTransport(newTransport: GlassesTransport) {
    this.cleanupListener();
    this.transport = newTransport;
  }

  getState(): SyncProgressState {
    return { ...this.state };
  }

  getDeviceLimits(): DeviceLimits {
    return { ...this.deviceLimits };
  }

  subscribe(listener: (state: SyncProgressState) => void): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private updateState(updates: Partial<SyncProgressState>) {
    this.state = { ...this.state, ...updates };
    this.listeners.forEach((l) => l(this.getState()));
  }

  private initListener() {
    if (this.unsubscribeNotifications) return;
    this.unsubscribeNotifications = this.transport.onNotification((packet) => {
      const resolvers = Array.from(this.pendingResolvers);
      resolvers.forEach((resolver) => {
        try {
          resolver(packet);
        } catch (e) {
          console.error('Error dispatching notification to resolver', e);
        }
      });
    });
  }

  private cleanupListener() {
    if (this.unsubscribeNotifications) {
      this.unsubscribeNotifications();
      this.unsubscribeNotifications = null;
    }
    this.pendingResolvers.clear();
  }

  /**
   * Waits for a specific notification packet matching predicate, with timeout.
   * Specification: "Register the notification listener before sending each packet so no reply is missed."
   */
  private waitForNotification<T extends InboundPacket>(
    predicate: (packet: InboundPacket) => packet is T,
    timeoutMs: number
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      let timer: any = null;

      const resolver = (packet: InboundPacket) => {
        if (predicate(packet)) {
          clearTimeout(timer);
          this.pendingResolvers.delete(resolver);
          resolve(packet);
        }
      };

      timer = setTimeout(() => {
        this.pendingResolvers.delete(resolver);
        reject(new Error(`Timed out waiting for notification (${timeoutMs}ms)`));
      }, timeoutMs);

      this.pendingResolvers.add(resolver);
    });
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
  }

  cancel() {
    this.cancelled = true;
    this.updateState({
      phase: 'Idle',
      stepName: 'Cancelled',
      statusText: 'Sync cancelled by user',
      active: false,
    });
  }

  /**
   * Main synchronization procedure matching Section 6 of the OllO specification.
   */
  async startSync(): Promise<boolean> {
    this.cancelled = false;
    this.initListener();

    try {
      this.updateState({
        phase: 'Connecting',
        stepName: 'Connecting to glasses',
        statusText: 'Connecting to smart glasses via BLE...',
        progress: 0.05,
        active: true,
        canRetry: true,
        errorMessage: undefined,
      });

      // 1. Connect if not connected
      if ((this.transport.connectionState as ConnectionState) !== 'CONNECTED') {
        const connected = await this.transport.connect();
        if (!connected || (this.transport.connectionState as ConnectionState) !== 'CONNECTED') {
          throw { message: 'Could not connect to glasses', stepName: 'Connecting', canRetry: true };
        }
      }
      if (this.cancelled) return false;

      // 2. GET_INFO (wait up to 1500 ms)
      this.updateState({
        phase: 'CheckingInfo',
        stepName: 'Querying device specs',
        statusText: 'Querying hardware capabilities & display dimensions...',
        progress: 0.1,
      });

      try {
        const infoPromise = this.waitForNotification(
          (p): p is InfoPacket => p.type === PACKET_TYPES.INFO,
          BLE_CONFIG.GET_INFO_TIMEOUT_MS
        );
        await this.transport.sendPacket(PacketBuilder.buildGetInfo());
        const info = await infoPromise;

        this.deviceLimits = {
          protocolVersion: info.protocolVersion,
          maxWidth: info.maxW || 640,
          maxHeight: info.maxH || 480,
          maxImageBytes: info.maxImageBytes || 153600,
          maxTextBytes: info.maxTextBytes || 100,
          colorSupported: info.colorSupported,
          gray2Supported: info.gray2Supported,
        };
      } catch (err) {
        // Fallback to defaults
        console.warn('GET_INFO timed out, keeping default specs:', err);
        this.deviceLimits = {
          protocolVersion: 1,
          maxWidth: 640,
          maxHeight: 480,
          maxImageBytes: 153600,
          maxTextBytes: 100,
          colorSupported: false,
          gray2Supported: false,
        };
      }
      if (this.cancelled) return false;

      // 3. GET_STORAGE (retry a few times, 100ms apart)
      this.updateState({
        phase: 'CheckingStorage',
        stepName: 'Checking storage',
        statusText: 'Reading remaining flash storage...',
        progress: 0.15,
      });

      let storageInfo: StorageInfoPacket | null = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        if (this.cancelled) return false;
        try {
          const storagePromise = this.waitForNotification(
            (p): p is StorageInfoPacket => p.type === PACKET_TYPES.STORAGE_INFO,
            1200
          );
          await this.transport.sendPacket(PacketBuilder.buildGetStorage());
          storageInfo = await storagePromise;
          break;
        } catch {
          await this.sleep(100);
        }
      }

      if (!storageInfo) {
        throw {
          message: 'Glasses did not respond to storage query',
          stepName: 'CheckingStorage',
          canRetry: true,
        };
      }

      this.updateState({
        storageTotalBytes: storageInfo.totalBytes,
        storageFreeBytes: storageInfo.freeBytes,
      });

      // 4. Validate estimated deck bytes vs free bytes
      const estimate = db.calculateStorageEstimate();
      if (estimate.totalEstimatedBytes > storageInfo.freeBytes) {
        const neededKb = (estimate.totalEstimatedBytes / 1024).toFixed(1);
        const freeKb = (storageInfo.freeBytes / 1024).toFixed(1);
        throw {
          message: `Deck is too large for the glasses' remaining storage (needs about ${neededKb} KB, free ${freeKb} KB)`,
          stepName: 'CheckingStorage',
          canRetry: false,
        };
      }

      // 5. Load cards from folders with include_in_sync on, in folder order
      const folders = db.getFolders().filter((f) => f.include_in_sync);
      const cardsToSync: { folder: FolderEntity; card: CardEntity }[] = [];
      const imageIdsToSync = new Set<number>();

      for (const folder of folders) {
        const cards = db.getCardsInFolder(folder.id);
        for (const card of cards) {
          cardsToSync.push({ folder, card });
          if (card.front_image_id && card.front_image_id > 0) {
            imageIdsToSync.add(card.front_image_id);
          }
          if (card.back_image_id && card.back_image_id > 0) {
            imageIdsToSync.add(card.back_image_id);
          }
        }
      }

      const totalCards = cardsToSync.length;
      const totalImages = imageIdsToSync.size;

      this.updateState({
        totalCards,
        syncedCards: 0,
        totalImages,
        syncedImages: 0,
      });

      // 6. BEGIN_SYNC(cardCount), wait for STATUS ref 0x01 with retries
      let beginOk = false;
      for (let attempt = 0; attempt < 3; attempt++) {
        if (this.cancelled) return false;
        try {
          const beginPromise = this.waitForNotification(
            (p): p is StatusPacket => p.type === PACKET_TYPES.STATUS && p.refType === PACKET_TYPES.BEGIN_SYNC,
            BLE_CONFIG.ACK_TIMEOUT_MS
          );
          await this.transport.sendPacket(PacketBuilder.buildBeginSync(totalCards));
          const status = await beginPromise;
          if (status.status === STATUS_CODES.OK) {
            beginOk = true;
            break;
          }
        } catch {
          await this.sleep(100);
        }
      }

      if (!beginOk) {
        throw { message: 'Glasses failed to initiate sync session (BEGIN_SYNC)', stepName: 'BeginSync', canRetry: true };
      }

      // 7. Send each CARD (progress 0.2 to 0.6)
      this.updateState({
        phase: 'SendingCards',
        stepName: 'Sending flashcards',
        statusText: `Transferring ${totalCards} cards...`,
      });

      for (let i = 0; i < totalCards; i++) {
        if (this.cancelled) return false;
        const item = cardsToSync[i];

        // Sanitize text to glasses ASCII
        const frontClean = transliterateToGlassesAscii(item.card.front_text, this.deviceLimits.maxTextBytes).cleanText;
        const backClean = transliterateToGlassesAscii(item.card.back_text, this.deviceLimits.maxTextBytes).cleanText;

        const cardPacket = PacketBuilder.buildCardV2(
          i,
          item.card.front_image_id || 0,
          item.card.back_image_id || 0,
          item.folder.name,
          frontClean,
          backClean
        );

        let cardAcked = false;
        for (let attempt = 0; attempt < 3; attempt++) {
          if (this.cancelled) return false;
          try {
            const cardPromise = this.waitForNotification(
              (p): p is StatusPacket => p.type === PACKET_TYPES.STATUS && p.refType === PACKET_TYPES.CARD,
              BLE_CONFIG.ACK_TIMEOUT_MS
            );
            await this.transport.sendPacket(cardPacket);
            const ack = await cardPromise;
            if (ack.status === STATUS_CODES.OK) {
              cardAcked = true;
              break;
            }
          } catch {
            await this.sleep(100);
          }
        }

        if (!cardAcked) {
          throw {
            message: `Failed sending card #${i + 1} (${item.card.front_text.slice(0, 15)}...)`,
            stepName: 'SendingCards',
            canRetry: true,
          };
        }

        const cardProgress = 0.2 + (0.4 * (i + 1)) / (totalCards || 1);
        this.updateState({
          syncedCards: i + 1,
          progress: cardProgress,
          statusText: `Sent card ${i + 1} of ${totalCards} (${item.folder.name})`,
        });
      }

      // 8. For each unique image (progress 0.6 to 0.9), up to 3 attempts
      const uniqueImagesList = Array.from(imageIdsToSync)
        .map((id) => db.getImage(id))
        .filter((img): img is ImageEntity => !!img);

      this.updateState({
        phase: 'SendingImages',
        stepName: 'Transferring images',
        statusText: `Transferring ${uniqueImagesList.length} unique graphics...`,
      });

      const maxPayload = this.transport.getMaxPayloadSize();
      const chunkDataSize = Math.max(20, maxPayload - 5); // 5 bytes overhead for [0x04][offset u32]

      for (let imgIdx = 0; imgIdx < uniqueImagesList.length; imgIdx++) {
        if (this.cancelled) return false;
        const img = uniqueImagesList[imgIdx];

        // Skip images whose format the glasses do not support
        if (img.format === 1 && !this.deviceLimits.colorSupported) {
          console.warn(`Skipping RGB565 image 0x${img.id.toString(16)}: not supported by hardware`);
          continue;
        }
        if (img.format === 2 && !this.deviceLimits.gray2Supported) {
          console.warn(`Skipping 2-bit gray image 0x${img.id.toString(16)}: not supported by hardware`);
          continue;
        }

        let imageTransferred = false;
        for (let attempt = 0; attempt < 3; attempt++) {
          if (this.cancelled) return false;
          try {
            // Send IMG_BEGIN and wait for STATUS ref 0x03
            const beginPromise = this.waitForNotification(
              (p): p is StatusPacket => p.type === PACKET_TYPES.STATUS && p.refType === PACKET_TYPES.IMG_BEGIN,
              BLE_CONFIG.ACK_TIMEOUT_MS
            );

            const beginPacket = PacketBuilder.buildImgBegin(
              img.id,
              img.width,
              img.height,
              img.device_data.length,
              img.format
            );
            await this.transport.sendPacket(beginPacket);
            const status = await beginPromise;

            // If status is ALREADY_HAVE_IMAGE (2), count as done
            if (status.status === STATUS_CODES.ALREADY_HAVE_IMAGE) {
              imageTransferred = true;
              break;
            }

            if (status.status !== STATUS_CODES.OK) {
              await this.sleep(100);
              continue; // retry
            }

            // Specification: Wait 100 ms after IMG_BEGIN settle delay
            await this.sleep(BLE_CONFIG.IMG_BEGIN_SETTLE_DELAY_MS);

            // Send IMG_CHUNKs of (maxPayload - 5) bytes with 12 ms pacing
            const totalBytes = img.device_data.length;
            for (let offset = 0; offset < totalBytes; offset += chunkDataSize) {
              if (this.cancelled) return false;
              const slice = img.device_data.subarray(offset, Math.min(totalBytes, offset + chunkDataSize));
              const chunkPacket = PacketBuilder.buildImgChunk(offset, slice);
              await this.transport.sendPacket(chunkPacket);
              await this.sleep(BLE_CONFIG.CHUNK_PACING_DELAY_MS);
            }

            // IMG_END with checksum = (sum of all image bytes) & 0xFF
            let checksum = 0;
            for (let b = 0; b < img.device_data.length; b++) {
              checksum = (checksum + img.device_data[b]) & 0xFF;
            }

            const endPromise = this.waitForNotification(
              (p): p is StatusPacket => p.type === PACKET_TYPES.STATUS && p.refType === PACKET_TYPES.IMG_END,
              BLE_CONFIG.ACK_TIMEOUT_MS
            );
            await this.transport.sendPacket(PacketBuilder.buildImgEnd(checksum));
            const endStatus = await endPromise;

            if (endStatus.status === STATUS_CODES.OK) {
              imageTransferred = true;
              break;
            } else {
              await this.sleep(100);
            }
          } catch {
            await this.sleep(100);
          }
        }

        if (!imageTransferred) {
          throw {
            message: `Failed to transfer graphic id 0x${img.id.toString(16)} to glasses`,
            stepName: 'SendingImages',
            canRetry: true,
          };
        }

        const imgProgress = 0.6 + (0.3 * (imgIdx + 1)) / (uniqueImagesList.length || 1);
        this.updateState({
          syncedImages: imgIdx + 1,
          progress: imgProgress,
          statusText: `Synced image ${imgIdx + 1} of ${uniqueImagesList.length}`,
        });
      }

      // 9. END_SYNC, wait for STATUS ref 0x06
      this.updateState({
        phase: 'Finalizing',
        stepName: 'Finalizing sync',
        statusText: 'Committing decks to smart glasses memory...',
        progress: 0.95,
      });

      const endSyncPromise = this.waitForNotification(
        (p): p is StatusPacket => p.type === PACKET_TYPES.STATUS && p.refType === PACKET_TYPES.END_SYNC,
        BLE_CONFIG.ACK_TIMEOUT_MS
      );
      await this.transport.sendPacket(PacketBuilder.buildEndSync());
      await endSyncPromise;

      // Refresh storage info
      try {
        const storagePromise = this.waitForNotification(
          (p): p is StorageInfoPacket => p.type === PACKET_TYPES.STORAGE_INFO,
          1000
        );
        await this.transport.sendPacket(PacketBuilder.buildGetStorage());
        const finalStorage = await storagePromise;
        this.updateState({
          storageTotalBytes: finalStorage.totalBytes,
          storageFreeBytes: finalStorage.freeBytes,
        });
      } catch {
        // non-fatal
      }

      this.updateState({
        phase: 'Done',
        stepName: 'Complete',
        statusText: `Sync complete! ${totalCards} cards and ${uniqueImagesList.length} images on glasses.`,
        progress: 1.0,
        active: false,
      });

      return true;
    } catch (err: any) {
      this.updateState({
        phase: 'Failed',
        stepName: err.stepName || 'SyncError',
        statusText: err.message || 'Synchronization failed',
        errorMessage: err.message || 'Unknown synchronization error',
        canRetry: err.canRetry !== false,
        active: false,
      });
      return false;
    }
  }
}
