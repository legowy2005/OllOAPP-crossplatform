/**
 * Built-in Unit Test Runner for OllO protocol, algorithms, and sync engine.
 * Covers:
 * - PacketBuilder byte layout tests
 * - PacketParser notification decoding tests (must never throw)
 * - Crc32 IEEE polynomial verification tests
 * - AsciiTransliteration text sanitization and byte counting tests
 * - SyncEngine end-to-end sync against SimulatedGlasses
 */

import { calculateCrc32, calculateImageId } from '../core/crc32';
import { transliterateToGlassesAscii } from '../core/asciiTransliteration';
import { PacketBuilder, PacketParser, PACKET_TYPES, STATUS_CODES } from '../ble/protocol';
import { SimulatedGlasses } from '../ble/SimulatedGlasses';
import { SyncEngine } from '../sync/SyncEngine';

export interface TestResult {
  suite: string;
  name: string;
  passed: boolean;
  durationMs: number;
  message?: string;
}

export async function runAllUnitTests(): Promise<TestResult[]> {
  const results: TestResult[] = [];

  const runTest = async (suite: string, name: string, fn: () => Promise<void> | void) => {
    const t0 = performance.now();
    try {
      await fn();
      results.push({
        suite,
        name,
        passed: true,
        durationMs: Math.round(performance.now() - t0),
      });
    } catch (e: any) {
      results.push({
        suite,
        name,
        passed: false,
        durationMs: Math.round(performance.now() - t0),
        message: e?.message || String(e),
      });
    }
  };

  // 1. Crc32 Tests
  await runTest('Crc32', 'Standard IEEE 802.3 test vectors (123456789 -> 0xCBF43926)', () => {
    const testBytes = new TextEncoder().encode('123456789');
    const crc = calculateCrc32(testBytes);
    if (crc !== 0xCBF43926) {
      throw new Error(`Expected 0xCBF43926, got 0x${crc.toString(16).toUpperCase()}`);
    }
  });

  await runTest('Crc32', 'Image ID calculation includes width, height and packed bytes', () => {
    const pixels = new Uint8Array([0xAA, 0x55, 0xFF, 0x00]);
    const imgId = calculateImageId(320, 240, pixels);
    if (typeof imgId !== 'number' || imgId <= 0) {
      throw new Error('Image ID should be valid unsigned 32-bit positive integer');
    }
  });

  // 2. AsciiTransliteration Tests
  await runTest('AsciiTransliteration', 'Replaces tabs, CR, and LF with spaces', () => {
    const res = transliterateToGlassesAscii('Line1\nLine2\rLine3\tDone');
    if (res.cleanText !== 'Line1 Line2 Line3 Done') {
      throw new Error(`Expected space-separated words, got "${res.cleanText}"`);
    }
    if (!res.wasModified) throw new Error('wasModified should be true');
  });

  await runTest('AsciiTransliteration', 'Strips diacritics and replaces German ß with ss', () => {
    const res = transliterateToGlassesAscii('Café Straße');
    if (res.cleanText !== 'Cafe Strasse') {
      throw new Error(`Expected "Cafe Strasse", got "${res.cleanText}"`);
    }
  });

  await runTest('AsciiTransliteration', 'Converts curly quotes to straight quotes', () => {
    const res = transliterateToGlassesAscii('“Smart” ‘Glasses’');
    if (res.cleanText !== '"Smart" \'Glasses\'') {
      throw new Error(`Expected straight quotes, got "${res.cleanText}"`);
    }
  });

  await runTest('AsciiTransliteration', 'Replaces non-ASCII symbols with question mark', () => {
    const res = transliterateToGlassesAscii('Emoji 😀 and Symbol ★');
    if (!res.cleanText.includes('?')) {
      throw new Error('Non-ASCII characters should become ?');
    }
  });

  await runTest('AsciiTransliteration', 'Enforces byte limit truncation', () => {
    const longText = 'A'.repeat(150);
    const res = transliterateToGlassesAscii(longText, 100);
    if (res.byteLength !== 100 || !res.isTruncated) {
      throw new Error(`Expected truncation at 100 bytes, got ${res.byteLength}`);
    }
  });

  // 3. PacketBuilder Tests
  await runTest('PacketBuilder', 'buildBeginSync generates [0x01][cardCount u16 LE]', () => {
    const packet = PacketBuilder.buildBeginSync(513); // 513 = 0x0201 -> [0x01, 0x02]
    if (packet.length !== 3) throw new Error(`Length should be 3, got ${packet.length}`);
    if (packet[0] !== PACKET_TYPES.BEGIN_SYNC) throw new Error('Wrong packet type');
    if (packet[1] !== 0x01 || packet[2] !== 0x02) throw new Error('Incorrect Little-Endian encoding');
  });

  await runTest('PacketBuilder', 'buildCardV2 incorporates folder name and length prefix', () => {
    const packet = PacketBuilder.buildCardV2(0, 0, 0, 'Bio', 'DNA', 'RNA');
    if (packet[0] !== PACKET_TYPES.CARD) throw new Error('Wrong packet type');
    // Offset 11 is folderLen (3)
    if (packet[11] !== 3) throw new Error(`Expected folderLen 3, got ${packet[11]}`);
    if (packet[12] !== 3) throw new Error(`Expected frontLen 3, got ${packet[12]}`);
    if (packet[13] !== 3) throw new Error(`Expected backLen 3, got ${packet[13]}`);
  });

  await runTest('PacketBuilder', 'buildImgBegin handles format 0 (13 bytes) and format 1/2 (14 bytes)', () => {
    const p0 = PacketBuilder.buildImgBegin(0x12345678, 640, 480, 38400, 0);
    if (p0.length !== 13) throw new Error(`Format 0 must be 13 bytes, got ${p0.length}`);
    const p2 = PacketBuilder.buildImgBegin(0x12345678, 640, 480, 76800, 2);
    if (p2.length !== 14 || p2[13] !== 2) throw new Error(`Format 2 must be 14 bytes with trailing format byte`);
  });

  // 4. PacketParser Tests
  await runTest('PacketParser', 'Parses STATUS notification correctly', () => {
    const data = new Uint8Array([0x80, 0x01, 0x00]); // STATUS ref=BEGIN_SYNC, status=OK
    const parsed = PacketParser.parseNotification(data);
    if (parsed.type !== PACKET_TYPES.STATUS || (parsed as any).status !== STATUS_CODES.OK) {
      throw new Error('Failed to parse STATUS OK');
    }
  });

  await runTest('PacketParser', 'Parses STORAGE_INFO notification [0x81][total u32][used u32]', () => {
    const data = new Uint8Array([
      0x81,
      0x00, 0x00, 0x16, 0x00, // 1441792 LE
      0x00, 0x10, 0x00, 0x00, // 4096 LE
    ]);
    const parsed = PacketParser.parseNotification(data);
    if (parsed.type !== PACKET_TYPES.STORAGE_INFO) throw new Error('Expected STORAGE_INFO');
    const storage = parsed as any;
    if (storage.totalBytes !== 1441792 || storage.usedBytes !== 4096 || storage.freeBytes !== 1437696) {
      throw new Error(`Unexpected storage calculation: ${JSON.stringify(storage)}`);
    }
  });

  await runTest('PacketParser', 'Never throws on malformed or empty data', () => {
    const malformed = new Uint8Array([0xFF, 0x00]);
    const res = PacketParser.parseNotification(malformed);
    if (res.type !== 'UNKNOWN') throw new Error('Expected UNKNOWN packet for malformed bytes');

    const empty = PacketParser.parseNotification(new Uint8Array(0));
    if (empty.type !== 'UNKNOWN') throw new Error('Expected UNKNOWN for empty buffer');
  });

  // 5. SyncEngine against SimulatedGlasses Tests
  await runTest('SyncEngine', 'Executes end-to-end sync against SimulatedGlasses', async () => {
    const simulated = new SimulatedGlasses();
    const engine = new SyncEngine(simulated);
    const success = await engine.startSync();
    if (!success) {
      const err = engine.getState().errorMessage;
      throw new Error(`SyncEngine failed against SimulatedGlasses: ${err}`);
    }
    const state = engine.getState();
    if (state.phase !== 'Done' || state.progress !== 1.0) {
      throw new Error(`Expected Phase Done and progress 1.0, got ${state.phase} (${state.progress})`);
    }
    const syncedCards = simulated.getSyncedCards();
    if (syncedCards.length === 0) {
      throw new Error('No cards were stored in SimulatedGlasses');
    }
  });

  return results;
}
