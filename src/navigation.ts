/**
 * Navigation destination types for OllO.
 * Destinations:
 * - Home
 * - Folder(id, name)
 * - CardEditor(folderId, cardId?)
 * - ImageEditor(folderId, cardId?, isFront)
 * - Sync
 * - Settings
 * - Preview(folderId, name)
 */

export type ScreenDestination =
  | { type: 'Home' }
  | { type: 'Folder'; folderId: number; folderName: string }
  | { type: 'CardEditor'; folderId: number; cardId?: number }
  | { type: 'ImageEditor'; folderId: number; cardId?: number; isFront: boolean }
  | { type: 'Sync' }
  | { type: 'Settings' }
  | { type: 'Preview'; folderId: number; folderName: string };
