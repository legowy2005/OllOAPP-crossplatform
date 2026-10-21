/**
 * OllO Flashcard Database.
 * Implements persistent local storage mirroring the Room KMP tables:
 * - folders
 * - cards
 * - images
 */

export interface FolderEntity {
  id: number;
  name: string;
  sort_order: number;
  include_in_sync: boolean;
  created_at: number;
  updated_at: number;
}

export interface CardEntity {
  id: number;
  folder_id: number;
  sort_order: number;
  front_text: string;
  back_text: string;
  front_image_id: number | null;
  back_image_id: number | null;
  created_at: number;
  updated_at: number;
}

export interface ImageEntity {
  id: number; // 32-bit CRC32 unsigned Long
  width: number;
  height: number;
  device_data: Uint8Array; // BLOB sent to glasses
  display_data: string; // Base64 dataURL PNG preview
  created_at: number;
  format: 0 | 1 | 2; // 0 = 1-bit, 1 = RGB565, 2 = 2-bit gray
}

export interface StorageBudgetConfig {
  budgetKb: number; // default 1408 KB
  autoReconnect: boolean; // default true
  useSimulatedGlasses: boolean; // default true
}

const STORAGE_KEYS = {
  FOLDERS: 'ollo_db_folders_v1',
  CARDS: 'ollo_db_cards_v1',
  IMAGES: 'ollo_db_images_v1',
  CONFIG: 'ollo_config_v1',
};

class OlloDatabase {
  private folders: FolderEntity[] = [];
  private cards: CardEntity[] = [];
  private images: Map<number, ImageEntity> = new Map();
  private config: StorageBudgetConfig = {
    budgetKb: 1408,
    autoReconnect: true,
    useSimulatedGlasses: true,
  };

  private listeners: Set<() => void> = new Set();
  private initialized: boolean = false;

  constructor() {
    this.loadFromStorage();
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    this.listeners.forEach((l) => l());
    this.saveToStorage();
  }

  private loadFromStorage() {
    try {
      const cfgRaw = localStorage.getItem(STORAGE_KEYS.CONFIG);
      if (cfgRaw) {
        this.config = { ...this.config, ...JSON.parse(cfgRaw) };
      }

      const foldersRaw = localStorage.getItem(STORAGE_KEYS.FOLDERS);
      const cardsRaw = localStorage.getItem(STORAGE_KEYS.CARDS);
      const imagesRaw = localStorage.getItem(STORAGE_KEYS.IMAGES);

      if (foldersRaw) {
        this.folders = JSON.parse(foldersRaw);
      }
      if (cardsRaw) {
        this.cards = JSON.parse(cardsRaw);
      }
      if (imagesRaw) {
        const arr = JSON.parse(imagesRaw);
        arr.forEach((item: any) => {
          this.images.set(item.id, {
            ...item,
            device_data: new Uint8Array(item.device_data),
          });
        });
      }

      // If empty, seed initial decks
      if (this.folders.length === 0) {
        this.seedInitialData();
      }
      this.initialized = true;
    } catch (e) {
      console.error('Error loading Ollo database:', e);
      this.seedInitialData();
    }
  }

  private saveToStorage() {
    try {
      localStorage.setItem(STORAGE_KEYS.CONFIG, JSON.stringify(this.config));
      localStorage.setItem(STORAGE_KEYS.FOLDERS, JSON.stringify(this.folders));
      localStorage.setItem(STORAGE_KEYS.CARDS, JSON.stringify(this.cards));

      const imagesArray = Array.from(this.images.values()).map((img) => ({
        id: img.id,
        width: img.width,
        height: img.height,
        device_data: Array.from(img.device_data),
        display_data: img.display_data,
        created_at: img.created_at,
        format: img.format,
      }));
      localStorage.setItem(STORAGE_KEYS.IMAGES, JSON.stringify(imagesArray));
    } catch (e) {
      console.warn('Failed to persist to localStorage (may be storage quota):', e);
    }
  }

  private seedInitialData() {
    const now = Date.now();
    this.folders = [
      {
        id: 1,
        name: 'Japanese Kanji',
        sort_order: 0,
        include_in_sync: true,
        created_at: now - 300000,
        updated_at: now - 300000,
      },
      {
        id: 2,
        name: 'Computer Architecture',
        sort_order: 1,
        include_in_sync: true,
        created_at: now - 200000,
        updated_at: now - 200000,
      },
      {
        id: 3,
        name: 'Medical Terminology',
        sort_order: 2,
        include_in_sync: true,
        created_at: now - 100000,
        updated_at: now - 100000,
      },
    ];

    this.cards = [
      // Japanese Kanji
      {
        id: 1,
        folder_id: 1,
        sort_order: 0,
        front_text: 'Kokoro (Heart / Mind)',
        back_text: 'Kanji: 心. Meaning: Heart, spirit, core. Kun: kokoro. On: SHIN.',
        front_image_id: null,
        back_image_id: null,
        created_at: now - 280000,
        updated_at: now - 280000,
      },
      {
        id: 2,
        folder_id: 1,
        sort_order: 1,
        front_text: 'Hikari (Light / Ray)',
        back_text: 'Kanji: 光. Meaning: Ray of light. Kun: hikari. On: KOU.',
        front_image_id: null,
        back_image_id: null,
        created_at: now - 270000,
        updated_at: now - 270000,
      },
      {
        id: 3,
        folder_id: 1,
        sort_order: 2,
        front_text: 'Mizu (Water)',
        back_text: 'Kanji: 水. Meaning: Water. Kun: mizu. On: SUI.',
        front_image_id: null,
        back_image_id: null,
        created_at: now - 260000,
        updated_at: now - 260000,
      },

      // Computer Architecture
      {
        id: 4,
        folder_id: 2,
        sort_order: 0,
        front_text: 'RISC vs CISC',
        back_text: 'RISC: Reduced Instruction Set, fixed length, single cycle. CISC: Complex, variable length.',
        front_image_id: null,
        back_image_id: null,
        created_at: now - 180000,
        updated_at: now - 180000,
      },
      {
        id: 5,
        folder_id: 2,
        sort_order: 1,
        front_text: 'Branch Prediction',
        back_text: 'Technique used by pipelined processors to guess branch outcome before execution.',
        front_image_id: null,
        back_image_id: null,
        created_at: now - 170000,
        updated_at: now - 170000,
      },
      {
        id: 6,
        folder_id: 2,
        sort_order: 2,
        front_text: 'Little-Endian Byte Order',
        back_text: 'Least significant byte stored at lowest memory address. Used in x86, ARM, and Ollo BLE.',
        front_image_id: null,
        back_image_id: null,
        created_at: now - 160000,
        updated_at: now - 160000,
      },

      // Medical Terminology
      {
        id: 7,
        folder_id: 3,
        sort_order: 0,
        front_text: 'Myocardial Infarction',
        back_text: 'Ischemia and necrosis of heart muscle tissue caused by coronary artery occlusion.',
        front_image_id: null,
        back_image_id: null,
        created_at: now - 90000,
        updated_at: now - 90000,
      },
      {
        id: 8,
        folder_id: 3,
        sort_order: 1,
        front_text: 'Bradycardia',
        back_text: 'Abnormally slow resting heart rate (< 60 bpm in adults).',
        front_image_id: null,
        back_image_id: null,
        created_at: now - 80000,
        updated_at: now - 80000,
      },
    ];

    this.saveToStorage();
  }

  // --- Folder queries ---
  getFolders(): FolderEntity[] {
    return [...this.folders].sort((a, b) => a.sort_order - b.sort_order);
  }

  getFolder(id: number): FolderEntity | undefined {
    return this.folders.find((f) => f.id === id);
  }

  createFolder(name: string): FolderEntity {
    const now = Date.now();
    const maxId = this.folders.reduce((max, f) => Math.max(max, f.id), 0);
    const maxSort = this.folders.reduce((max, f) => Math.max(max, f.sort_order), -1);

    const newFolder: FolderEntity = {
      id: maxId + 1,
      name: name.trim() || 'New Folder',
      sort_order: maxSort + 1,
      include_in_sync: true,
      created_at: now,
      updated_at: now,
    };
    this.folders.push(newFolder);
    this.notify();
    return newFolder;
  }

  renameFolder(id: number, newName: string) {
    const folder = this.folders.find((f) => f.id === id);
    if (folder) {
      folder.name = newName.trim();
      folder.updated_at = Date.now();
      this.notify();
    }
  }

  toggleFolderSync(id: number, include: boolean) {
    const folder = this.folders.find((f) => f.id === id);
    if (folder) {
      folder.include_in_sync = include;
      folder.updated_at = Date.now();
      this.notify();
    }
  }

  deleteFolder(id: number) {
    // CASCADE delete cards in folder
    this.cards = this.cards.filter((c) => c.folder_id !== id);
    this.folders = this.folders.filter((f) => f.id !== id);
    this.notify();
  }

  reorderFolders(newOrderIds: number[]) {
    newOrderIds.forEach((id, idx) => {
      const f = this.folders.find((item) => item.id === id);
      if (f) {
        f.sort_order = idx;
      }
    });
    this.notify();
  }

  // --- Card queries ---
  getCardsInFolder(folderId: number): CardEntity[] {
    return this.cards
      .filter((c) => c.folder_id === folderId)
      .sort((a, b) => a.sort_order - b.sort_order);
  }

  getAllCards(): CardEntity[] {
    return [...this.cards];
  }

  getCard(id: number): CardEntity | undefined {
    return this.cards.find((c) => c.id === id);
  }

  saveCard(
    folderId: number,
    cardId: number | null,
    frontText: string,
    backText: string,
    frontImageId: number | null = null,
    backImageId: number | null = null
  ): CardEntity {
    const now = Date.now();
    if (cardId) {
      const existing = this.cards.find((c) => c.id === cardId);
      if (existing) {
        existing.front_text = frontText;
        existing.back_text = backText;
        existing.front_image_id = frontImageId;
        existing.back_image_id = backImageId;
        existing.updated_at = now;
        this.notify();
        return existing;
      }
    }

    const folderCards = this.getCardsInFolder(folderId);
    const maxSort = folderCards.reduce((max, c) => Math.max(max, c.sort_order), -1);
    const maxId = this.cards.reduce((max, c) => Math.max(max, c.id), 0);

    const newCard: CardEntity = {
      id: maxId + 1,
      folder_id: folderId,
      sort_order: maxSort + 1,
      front_text: frontText,
      back_text: backText,
      front_image_id: frontImageId,
      back_image_id: backImageId,
      created_at: now,
      updated_at: now,
    };
    this.cards.push(newCard);
    this.notify();
    return newCard;
  }

  duplicateCard(cardId: number): CardEntity | null {
    const card = this.getCard(cardId);
    if (!card) return null;
    return this.saveCard(
      card.folder_id,
      null,
      `${card.front_text} (Copy)`,
      card.back_text,
      card.front_image_id,
      card.back_image_id
    );
  }

  deleteCard(cardId: number) {
    this.cards = this.cards.filter((c) => c.id !== cardId);
    this.notify();
  }

  moveCard(cardId: number, targetFolderId: number) {
    const card = this.getCard(cardId);
    if (card) {
      card.folder_id = targetFolderId;
      const targetCards = this.getCardsInFolder(targetFolderId);
      card.sort_order = targetCards.length;
      card.updated_at = Date.now();
      this.notify();
    }
  }

  reorderCards(folderId: number, orderedCardIds: number[]) {
    orderedCardIds.forEach((id, idx) => {
      const c = this.cards.find((card) => card.id === id);
      if (c && c.folder_id === folderId) {
        c.sort_order = idx;
      }
    });
    this.notify();
  }

  // --- Image queries ---
  saveImage(img: ImageEntity) {
    this.images.set(img.id, img);
    this.notify();
  }

  getImage(id: number): ImageEntity | undefined {
    return this.images.get(id);
  }

  getAllImages(): ImageEntity[] {
    return Array.from(this.images.values());
  }

  // --- Storage estimation ---
  /**
   * Offline storage estimate = sum of card text bytes + unique image device_data sizes
   * for cards in folders with include_in_sync on.
   */
  calculateStorageEstimate(): {
    totalEstimatedBytes: number;
    textBytes: number;
    imageBytes: number;
    cardCount: number;
    imageCount: number;
    syncedFolderCount: number;
    budgetBytes: number;
    percentUsed: number;
  } {
    const syncedFolderIds = new Set(
      this.folders.filter((f) => f.include_in_sync).map((f) => f.id)
    );

    const syncedCards = this.cards.filter((c) => syncedFolderIds.has(c.folder_id));
    const uniqueImageIds = new Set<number>();

    let textBytes = 0;
    const encoder = new TextEncoder();

    for (const card of syncedCards) {
      textBytes += encoder.encode(card.front_text).length;
      textBytes += encoder.encode(card.back_text).length;
      if (card.front_image_id && card.front_image_id > 0) {
        uniqueImageIds.add(card.front_image_id);
      }
      if (card.back_image_id && card.back_image_id > 0) {
        uniqueImageIds.add(card.back_image_id);
      }
    }

    let imageBytes = 0;
    for (const imgId of uniqueImageIds) {
      const img = this.images.get(imgId);
      if (img) {
        imageBytes += img.device_data.length;
      }
    }

    const totalEstimatedBytes = textBytes + imageBytes;
    const budgetBytes = this.config.budgetKb * 1024;
    const percentUsed = budgetBytes > 0 ? (totalEstimatedBytes / budgetBytes) * 100 : 0;

    return {
      totalEstimatedBytes,
      textBytes,
      imageBytes,
      cardCount: syncedCards.length,
      imageCount: uniqueImageIds.size,
      syncedFolderCount: syncedFolderIds.size,
      budgetBytes,
      percentUsed,
    };
  }

  // --- Configuration ---
  getConfig(): StorageBudgetConfig {
    return { ...this.config };
  }

  updateConfig(updates: Partial<StorageBudgetConfig>) {
    this.config = { ...this.config, ...updates };
    this.notify();
  }

  // --- CSV Import / Export ---
  exportFolderCsv(folderId: number): string {
    const folder = this.getFolder(folderId);
    const cards = this.getCardsInFolder(folderId);
    let csv = 'front,back\n';

    for (const card of cards) {
      const escape = (str: string) => {
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      };
      csv += `${escape(card.front_text)},${escape(card.back_text)}\n`;
    }
    return csv;
  }

  importCsv(targetFolderId: number, csvContent: string): number {
    const lines = csvContent.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length === 0) return 0;

    let startIndex = 0;
    // Check if header exists
    if (lines[0].toLowerCase().startsWith('front,back')) {
      startIndex = 1;
    }

    let count = 0;
    for (let i = startIndex; i < lines.length; i++) {
      const row = this.parseCsvLine(lines[i]);
      if (row.length >= 2 && (row[0].trim() || row[1].trim())) {
        this.saveCard(targetFolderId, null, row[0].trim(), row[1].trim(), null, null);
        count++;
      }
    }
    return count;
  }

  private parseCsvLine(text: string): string[] {
    const result: string[] = [];
    let cur = '';
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (c === '"') {
        if (inQuotes && text[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (c === ',' && !inQuotes) {
        result.push(cur);
        cur = '';
      } else {
        cur += c;
      }
    }
    result.push(cur);
    return result;
  }
}

export const db = new OlloDatabase();
