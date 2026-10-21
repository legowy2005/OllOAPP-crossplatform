import React, { useState } from 'react';
import { db, FolderEntity } from '../data/database';
import { ScreenDestination } from '../navigation';
import {
  Folder,
  Plus,
  Search,
  Upload,
  ArrowUpDown,
  Glasses,
  Settings as SettingsIcon,
  HardDrive,
  Check,
  ChevronRight,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';

interface HomeScreenProps {
  onNavigate: (dest: ScreenDestination) => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({ onNavigate }) => {
  const folders = db.getFolders();
  const allCards = db.getAllCards();
  const storageInfo = db.calculateStorageEstimate();

  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [showImportModal, setShowImportModal] = useState(false);
  const [importFolderTitle, setImportFolderTitle] = useState('');
  const [importCsvText, setImportCsvText] = useState('');
  const [isReordering, setIsReordering] = useState(false);

  // Filtered search results
  const searchTrimmed = searchQuery.trim().toLowerCase();
  const matchingCards = searchTrimmed
    ? allCards.filter(
        (c) =>
          c.front_text.toLowerCase().includes(searchTrimmed) ||
          c.back_text.toLowerCase().includes(searchTrimmed)
      )
    : [];

  const handleCreateFolder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    const created = db.createFolder(newFolderName.trim());
    setNewFolderName('');
    setShowCreateModal(false);
    onNavigate({ type: 'Folder', folderId: created.id, folderName: created.name });
  };

  const handleImportCsv = (e: React.FormEvent) => {
    e.preventDefault();
    if (!importFolderTitle.trim() || !importCsvText.trim()) return;
    const folder = db.createFolder(importFolderTitle.trim());
    const count = db.importCsv(folder.id, importCsvText);
    setShowImportModal(false);
    setImportFolderTitle('');
    setImportCsvText('');
    alert(`Imported ${count} cards into folder "${folder.name}".`);
    onNavigate({ type: 'Folder', folderId: folder.id, folderName: folder.name });
  };

  const moveFolder = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= folders.length) return;

    const ids = folders.map((f) => f.id);
    const temp = ids[index];
    ids[index] = ids[targetIndex];
    ids[targetIndex] = temp;
    db.reorderFolders(ids);
  };

  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-8 space-y-6">
      {/* Top Banner / Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-[#D9D9D9] tracking-tight">Flashcard Decks</h1>
          <p className="text-sm text-[#A8A8A8] mt-1">
            Organize cards and sync with high-contrast micro-OLED smart glasses
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setShowImportModal(true)}
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-medium rounded-lg bg-[#383838] text-[#D9D9D9] hover:bg-[#4A4A4A] border border-[#4A4A4A] transition-colors cursor-pointer"
          >
            <Upload className="w-4 h-4 text-[#7FB5A5]" />
            Import CSV
          </button>

          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg bg-[#D9D9D9] text-[#282828] hover:bg-white transition-colors cursor-pointer shadow-sm"
          >
            <Plus className="w-4 h-4" />
            New Folder
          </button>
        </div>
      </div>

      {/* Storage Estimate Bar */}
      <div className="bg-[#2F2F2F] border border-[#4A4A4A] rounded-xl p-4.5 space-y-2.5">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <HardDrive className="w-4 h-4 text-[#7FB5A5]" />
            <span className="font-medium text-[#D9D9D9]">Glasses Offline Storage Budget</span>
          </div>
          <div className="text-[#A8A8A8] tabular-nums font-mono">
            {(storageInfo.totalEstimatedBytes / 1024).toFixed(1)} KB / {(storageInfo.budgetBytes / 1024).toFixed(0)} KB (
            {storageInfo.percentUsed.toFixed(1)}%)
          </div>
        </div>

        {/* Progress bar */}
        <div className="w-full h-2.5 bg-[#282828] rounded-full overflow-hidden border border-[#4A4A4A]/60">
          <div
            className={`h-full transition-all duration-300 rounded-full ${
              storageInfo.percentUsed > 90
                ? 'bg-[#E57373]'
                : storageInfo.percentUsed > 75
                ? 'bg-[#FFB74D]'
                : 'bg-[#7FB5A5]'
            }`}
            style={{ width: `${Math.min(100, Math.max(2, storageInfo.percentUsed))}%` }}
          />
        </div>

        <div className="flex items-center justify-between text-xs text-[#A8A8A8]">
          <div className="flex items-center gap-3">
            <span>{storageInfo.cardCount} cards queued</span>
            <span>·</span>
            <span>{storageInfo.imageCount} unique images</span>
            <span>·</span>
            <span>{storageInfo.syncedFolderCount} folders in sync</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onNavigate({ type: 'Sync' })}
              className="text-[#7FB5A5] hover:underline font-medium cursor-pointer"
            >
              Start Sync
            </button>
            <span>·</span>
            <button
              onClick={() => onNavigate({ type: 'Settings' })}
              className="text-[#A8A8A8] hover:text-[#D9D9D9] cursor-pointer"
            >
              Budget Settings
            </button>
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="w-4 h-4 text-[#7D7D7D] absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search all flashcards by question, answer, or term..."
          className="w-full bg-[#2F2F2F] border border-[#4A4A4A] rounded-xl pl-10 pr-4 py-2.5 text-sm text-[#D9D9D9] placeholder-[#7D7D7D] focus:outline-none focus:border-[#7FB5A5] transition-colors"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#A8A8A8] hover:text-[#D9D9D9] px-2 py-0.5 rounded cursor-pointer"
          >
            Clear
          </button>
        )}
      </div>

      {/* Search results view if query is active */}
      {searchTrimmed ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-[#A8A8A8]">
            <span>
              Search results for "{searchQuery}" ({matchingCards.length} found)
            </span>
          </div>

          {matchingCards.length === 0 ? (
            <div className="bg-[#2F2F2F] border border-[#4A4A4A] rounded-xl p-8 text-center space-y-2">
              <p className="text-base font-medium text-[#D9D9D9]">No cards found</p>
              <p className="text-xs text-[#7D7D7D]">Try a different search term or add new cards.</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {matchingCards.map((card) => {
                const folder = db.getFolder(card.folder_id);
                return (
                  <div
                    key={card.id}
                    onClick={() => {
                      if (folder) {
                        onNavigate({ type: 'Folder', folderId: folder.id, folderName: folder.name });
                      }
                    }}
                    className="bg-[#2F2F2F] hover:bg-[#383838] border border-[#4A4A4A] rounded-xl p-4 cursor-pointer transition-colors space-y-1.5"
                  >
                    <div className="flex items-center justify-between text-xs text-[#7FB5A5]">
                      <span>{folder?.name || 'Folder'}</span>
                      <ChevronRight className="w-4 h-4 text-[#7D7D7D]" />
                    </div>
                    <div className="text-sm font-semibold text-[#D9D9D9]">{card.front_text}</div>
                    <div className="text-xs text-[#A8A8A8] line-clamp-2">{card.back_text}</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* Regular Folders List */
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-[#A8A8A8] px-1">
            <span className="font-medium text-[#D9D9D9]">Folders ({folders.length})</span>
            {folders.length > 1 && (
              <button
                onClick={() => setIsReordering(!isReordering)}
                className="flex items-center gap-1.5 text-xs text-[#7FB5A5] hover:underline cursor-pointer"
              >
                <ArrowUpDown className="w-3.5 h-3.5" />
                {isReordering ? 'Done Reordering' : 'Reorder Folders'}
              </button>
            )}
          </div>

          {folders.length === 0 ? (
            <div className="bg-[#2F2F2F] border border-dashed border-[#4A4A4A] rounded-xl p-12 text-center space-y-4">
              <Folder className="w-12 h-12 text-[#7D7D7D] mx-auto" />
              <div className="space-y-1">
                <h3 className="text-lg font-semibold text-[#D9D9D9]">No folders yet</h3>
                <p className="text-xs text-[#A8A8A8] max-w-sm mx-auto">
                  Create a folder to start organizing your flashcards, or import an existing CSV deck.
                </p>
              </div>
              <button
                onClick={() => setShowCreateModal(true)}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-[#D9D9D9] text-[#282828] hover:bg-white transition-colors cursor-pointer inline-flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Create First Folder
              </button>
            </div>
          ) : (
            <div className="space-y-2.5">
              {folders.map((folder, index) => {
                const cardCount = db.getCardsInFolder(folder.id).length;
                return (
                  <div
                    key={folder.id}
                    className="bg-[#2F2F2F] border border-[#4A4A4A] rounded-xl p-4 flex items-center justify-between gap-4 hover:border-[#606060] transition-colors"
                  >
                    <div
                      onClick={() =>
                        onNavigate({
                          type: 'Folder',
                          folderId: folder.id,
                          folderName: folder.name,
                        })
                      }
                      className="flex items-center gap-3.5 flex-1 min-w-0 cursor-pointer"
                    >
                      <div className="w-10 h-10 rounded-lg bg-[#383838] flex items-center justify-center shrink-0 border border-[#4A4A4A]">
                        <Folder className="w-5 h-5 text-[#7FB5A5]" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-semibold text-[#D9D9D9] truncate">
                            {folder.name}
                          </h3>
                          {folder.include_in_sync && (
                            <span className="text-[11px] font-medium text-[#81C784] bg-[#2E403B] px-2 py-0.5 rounded border border-[#81C784]/30 shrink-0">
                              Sync enabled
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-[#A8A8A8] mt-0.5">
                          {cardCount} {cardCount === 1 ? 'card' : 'cards'}
                        </div>
                      </div>
                    </div>

                    {/* Actions on folder */}
                    <div className="flex items-center gap-2 shrink-0">
                      {isReordering ? (
                        <div className="flex items-center gap-1">
                          <button
                            disabled={index === 0}
                            onClick={() => moveFolder(index, 'up')}
                            className="p-1.5 rounded bg-[#383838] hover:bg-[#4A4A4A] disabled:opacity-30 cursor-pointer"
                            title="Move Up"
                          >
                            <ArrowUp className="w-3.5 h-3.5 text-[#D9D9D9]" />
                          </button>
                          <button
                            disabled={index === folders.length - 1}
                            onClick={() => moveFolder(index, 'down')}
                            className="p-1.5 rounded bg-[#383838] hover:bg-[#4A4A4A] disabled:opacity-30 cursor-pointer"
                            title="Move Down"
                          >
                            <ArrowDown className="w-3.5 h-3.5 text-[#D9D9D9]" />
                          </button>
                        </div>
                      ) : (
                        <>
                          <button
                            onClick={() =>
                              onNavigate({
                                type: 'Preview',
                                folderId: folder.id,
                                folderName: folder.name,
                              })
                            }
                            className="p-2 text-xs rounded-lg bg-[#383838] hover:bg-[#4A4A4A] text-[#A8A8A8] hover:text-[#D9D9D9] border border-[#4A4A4A] transition-colors cursor-pointer"
                            title="Preview on glasses"
                          >
                            <Glasses className="w-4 h-4 text-[#7FB5A5]" />
                          </button>
                          <button
                            onClick={() =>
                              onNavigate({
                                type: 'Folder',
                                folderId: folder.id,
                                folderName: folder.name,
                              })
                            }
                            className="p-2 text-xs rounded-lg bg-[#383838] hover:bg-[#4A4A4A] text-[#A8A8A8] hover:text-[#D9D9D9] border border-[#4A4A4A] transition-colors cursor-pointer"
                            title="Open folder"
                          >
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Create Folder Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-[#2F2F2F] border border-[#4A4A4A] rounded-xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <h3 className="text-xl font-bold text-[#D9D9D9]">Create Folder</h3>
            <form onSubmit={handleCreateFolder} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#A8A8A8] mb-1.5">
                  Folder Name
                </label>
                <input
                  type="text"
                  autoFocus
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  placeholder="e.g. Japanese Kanji or Neuroanatomy"
                  className="w-full bg-[#282828] border border-[#4A4A4A] rounded-lg px-3.5 py-2 text-sm text-[#D9D9D9] focus:outline-none focus:border-[#7FB5A5]"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-xs font-medium text-[#A8A8A8] hover:text-[#D9D9D9] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!newFolderName.trim()}
                  className="px-4 py-2 text-xs font-semibold rounded-lg bg-[#D9D9D9] text-[#282828] hover:bg-white disabled:opacity-50 transition-colors cursor-pointer"
                >
                  Create Folder
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Import CSV Modal */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-[#2F2F2F] border border-[#4A4A4A] rounded-xl max-w-lg w-full p-6 space-y-4 shadow-xl">
            <h3 className="text-xl font-bold text-[#D9D9D9]">Import Flashcards CSV</h3>
            <p className="text-xs text-[#A8A8A8]">
              Paste CSV text with <code className="text-[#7FB5A5]">front,back</code> format per line. Quoted fields and commas are supported.
            </p>
            <form onSubmit={handleImportCsv} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#A8A8A8] mb-1">
                  Destination Folder Name
                </label>
                <input
                  type="text"
                  value={importFolderTitle}
                  onChange={(e) => setImportFolderTitle(e.target.value)}
                  placeholder="e.g. Imported Deck"
                  className="w-full bg-[#282828] border border-[#4A4A4A] rounded-lg px-3.5 py-2 text-sm text-[#D9D9D9] focus:outline-none focus:border-[#7FB5A5]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#A8A8A8] mb-1">
                  CSV Data (front,back)
                </label>
                <textarea
                  rows={6}
                  value={importCsvText}
                  onChange={(e) => setImportCsvText(e.target.value)}
                  placeholder={`front,back\n"What is ATP?","Adenosine triphosphate: primary cellular energy carrier"\n"What is DNA?","Deoxyribonucleic acid carrying genetic instructions"`}
                  className="w-full bg-[#282828] border border-[#4A4A4A] rounded-lg p-3 text-xs font-mono text-[#D9D9D9] focus:outline-none focus:border-[#7FB5A5]"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowImportModal(false)}
                  className="px-4 py-2 text-xs font-medium text-[#A8A8A8] hover:text-[#D9D9D9] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!importFolderTitle.trim() || !importCsvText.trim()}
                  className="px-4 py-2 text-xs font-semibold rounded-lg bg-[#D9D9D9] text-[#282828] hover:bg-white disabled:opacity-50 transition-colors cursor-pointer"
                >
                  Import Flashcards
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
