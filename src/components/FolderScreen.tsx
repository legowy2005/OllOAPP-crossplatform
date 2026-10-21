import React, { useState } from 'react';
import { db, CardEntity, FolderEntity } from '../data/database';
import { ScreenDestination } from '../navigation';
import {
  ArrowLeft,
  Plus,
  Glasses,
  Upload,
  Download,
  Trash2,
  Edit2,
  Copy,
  FolderInput,
  ArrowUp,
  ArrowDown,
  Image as ImageIcon,
  Check,
  MoreVertical,
} from 'lucide-react';

interface FolderScreenProps {
  folderId: number;
  folderName: string;
  onNavigate: (dest: ScreenDestination) => void;
}

export const FolderScreen: React.FC<FolderScreenProps> = ({
  folderId,
  folderName,
  onNavigate,
}) => {
  const folder = db.getFolder(folderId);
  const allFolders = db.getFolders();
  const cards = db.getCardsInFolder(folderId);

  const [isRenaming, setIsRenaming] = useState(false);
  const [renamedTitle, setRenamedTitle] = useState(folder?.name || folderName);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importCsvText, setImportCsvText] = useState('');
  const [moveCardModal, setMoveCardModal] = useState<CardEntity | null>(null);
  const [targetMoveFolderId, setTargetMoveFolderId] = useState<number>(folderId);
  const [isReordering, setIsReordering] = useState(false);

  if (!folder) {
    return (
      <div className="w-full max-w-4xl mx-auto px-4 py-12 text-center space-y-4">
        <p className="text-base text-[#D9D9D9]">Folder not found</p>
        <button
          onClick={() => onNavigate({ type: 'Home' })}
          className="text-xs text-[#7FB5A5] underline"
        >
          Return to Decks
        </button>
      </div>
    );
  }

  const handleSaveRename = (e: React.FormEvent) => {
    e.preventDefault();
    if (!renamedTitle.trim()) return;
    db.renameFolder(folderId, renamedTitle);
    setIsRenaming(false);
  };

  const handleDeleteFolder = () => {
    if (confirm(`Are you sure you want to delete folder "${folder.name}" and all its ${cards.length} cards?`)) {
      db.deleteFolder(folderId);
      onNavigate({ type: 'Home' });
    }
  };

  const handleExportCsv = () => {
    const csvData = db.exportFolderCsv(folderId);
    const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${folder.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_flashcards.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportCsv = (e: React.FormEvent) => {
    e.preventDefault();
    if (!importCsvText.trim()) return;
    const count = db.importCsv(folderId, importCsvText);
    setImportCsvText('');
    setShowImportModal(false);
    alert(`Imported ${count} cards into ${folder.name}`);
  };

  const handleDuplicate = (cardId: number) => {
    db.duplicateCard(cardId);
  };

  const handleDeleteCard = (cardId: number) => {
    if (confirm('Delete this flashcard?')) {
      db.deleteCard(cardId);
    }
  };

  const handleMoveCardSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (moveCardModal && targetMoveFolderId !== folderId) {
      db.moveCard(moveCardModal.id, targetMoveFolderId);
      setMoveCardModal(null);
    }
  };

  const moveCardOrder = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= cards.length) return;

    const ids = cards.map((c) => c.id);
    const temp = ids[index];
    ids[index] = ids[targetIndex];
    ids[targetIndex] = temp;
    db.reorderCards(folderId, ids);
  };

  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-8 space-y-6">
      {/* Back button & Folder Header */}
      <div className="space-y-4">
        <button
          onClick={() => onNavigate({ type: 'Home' })}
          className="inline-flex items-center gap-1.5 text-xs text-[#A8A8A8] hover:text-[#D9D9D9] transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to all Decks
        </button>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#2F2F2F] border border-[#4A4A4A] rounded-xl p-5">
          <div className="space-y-1">
            {isRenaming ? (
              <form onSubmit={handleSaveRename} className="flex items-center gap-2">
                <input
                  type="text"
                  autoFocus
                  value={renamedTitle}
                  onChange={(e) => setRenamedTitle(e.target.value)}
                  className="bg-[#282828] border border-[#7FB5A5] rounded px-2.5 py-1 text-lg font-bold text-[#D9D9D9] focus:outline-none"
                />
                <button
                  type="submit"
                  className="px-3 py-1 text-xs bg-[#7FB5A5] text-[#282828] font-semibold rounded cursor-pointer"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => setIsRenaming(false)}
                  className="px-2 py-1 text-xs text-[#A8A8A8] cursor-pointer"
                >
                  Cancel
                </button>
              </form>
            ) : (
              <div className="flex items-center gap-2.5">
                <h1 className="text-2xl font-bold text-[#D9D9D9] tracking-tight">{folder.name}</h1>
                <button
                  onClick={() => {
                    setRenamedTitle(folder.name);
                    setIsRenaming(true);
                  }}
                  className="p-1 text-[#A8A8A8] hover:text-[#D9D9D9] cursor-pointer"
                  title="Rename folder"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
              </div>
            )}
            <div className="flex items-center gap-2 text-xs text-[#A8A8A8]">
              <span>{cards.length} {cards.length === 1 ? 'card' : 'cards'}</span>
              <span>·</span>
              <label className="inline-flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={folder.include_in_sync}
                  onChange={(e) => db.toggleFolderSync(folderId, e.target.checked)}
                  className="rounded text-[#7FB5A5] focus:ring-0 cursor-pointer"
                />
                <span className={folder.include_in_sync ? 'text-[#81C784] font-medium' : 'text-[#A8A8A8]'}>
                  Include in BLE Sync
                </span>
              </label>
            </div>
          </div>

          {/* Folder Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => onNavigate({ type: 'Preview', folderId: folder.id, folderName: folder.name })}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-[#383838] text-[#D9D9D9] hover:bg-[#4A4A4A] border border-[#4A4A4A] transition-colors cursor-pointer"
            >
              <Glasses className="w-4 h-4 text-[#7FB5A5]" />
              Glasses Preview
            </button>

            <button
              onClick={handleExportCsv}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-[#383838] text-[#D9D9D9] hover:bg-[#4A4A4A] border border-[#4A4A4A] transition-colors cursor-pointer"
              title="Export CSV"
            >
              <Download className="w-4 h-4" />
              Export
            </button>

            <button
              onClick={() => setShowImportModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-[#383838] text-[#D9D9D9] hover:bg-[#4A4A4A] border border-[#4A4A4A] transition-colors cursor-pointer"
              title="Import CSV into this folder"
            >
              <Upload className="w-4 h-4" />
              Import
            </button>

            <button
              onClick={() => onNavigate({ type: 'CardEditor', folderId: folder.id })}
              className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-[#D9D9D9] text-[#282828] hover:bg-white transition-colors cursor-pointer shadow-sm"
            >
              <Plus className="w-4 h-4" />
              Add Card
            </button>

            <button
              onClick={handleDeleteFolder}
              className="p-2 text-xs rounded-lg text-[#E57373] hover:bg-[#383838] transition-colors cursor-pointer ml-1"
              title="Delete folder"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Cards List Header & Reorder Toggle */}
      <div className="flex items-center justify-between text-xs text-[#A8A8A8] px-1">
        <span>Cards in this deck ({cards.length})</span>
        {cards.length > 1 && (
          <button
            onClick={() => setIsReordering(!isReordering)}
            className="text-xs text-[#7FB5A5] hover:underline cursor-pointer"
          >
            {isReordering ? 'Done Reordering' : 'Reorder Cards'}
          </button>
        )}
      </div>

      {/* Cards Display */}
      {cards.length === 0 ? (
        <div className="bg-[#2F2F2F] border border-dashed border-[#4A4A4A] rounded-xl p-12 text-center space-y-4">
          <p className="text-base font-medium text-[#D9D9D9]">This folder is empty</p>
          <p className="text-xs text-[#A8A8A8] max-w-sm mx-auto">
            Create your first flashcard with front text, back text, and optional glasses-optimized graphics.
          </p>
          <button
            onClick={() => onNavigate({ type: 'CardEditor', folderId: folder.id })}
            className="px-4 py-2 text-xs font-semibold rounded-lg bg-[#D9D9D9] text-[#282828] hover:bg-white transition-colors cursor-pointer inline-flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Create Flashcard
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {cards.map((card, index) => {
            const frontImg = card.front_image_id ? db.getImage(card.front_image_id) : null;
            const backImg = card.back_image_id ? db.getImage(card.back_image_id) : null;

            return (
              <div
                key={card.id}
                className="bg-[#2F2F2F] border border-[#4A4A4A] rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:border-[#606060] transition-colors"
              >
                {/* Card Content */}
                <div
                  onClick={() =>
                    !isReordering &&
                    onNavigate({ type: 'CardEditor', folderId: folder.id, cardId: card.id })
                  }
                  className="flex-1 min-w-0 space-y-2 cursor-pointer"
                >
                  <div className="flex items-center gap-2 text-xs text-[#7D7D7D]">
                    <span className="font-mono">#{index + 1}</span>
                    <span>·</span>
                    <span className="text-[#A8A8A8]">Front ({card.front_text.length}B)</span>
                    {frontImg && (
                      <span className="inline-flex items-center gap-1 text-[#7FB5A5] text-[11px]">
                        <ImageIcon className="w-3 h-3" />
                        {frontImg.width}x{frontImg.height}
                      </span>
                    )}
                  </div>
                  <div className="text-sm font-semibold text-[#D9D9D9]">{card.front_text}</div>

                  <div className="pt-1 border-t border-[#383838]">
                    <div className="text-xs text-[#7D7D7D] flex items-center gap-2">
                      <span className="text-[#A8A8A8]">Back ({card.back_text.length}B)</span>
                      {backImg && (
                        <span className="inline-flex items-center gap-1 text-[#7FB5A5] text-[11px]">
                          <ImageIcon className="w-3 h-3" />
                          {backImg.width}x{backImg.height}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-[#A8A8A8] mt-0.5 line-clamp-2">{card.back_text}</div>
                  </div>
                </div>

                {/* Card Actions */}
                <div className="flex items-center gap-1.5 shrink-0 self-end md:self-center border-t md:border-t-0 pt-2 md:pt-0 border-[#383838]">
                  {isReordering ? (
                    <div className="flex items-center gap-1">
                      <button
                        disabled={index === 0}
                        onClick={() => moveCardOrder(index, 'up')}
                        className="p-1.5 rounded bg-[#383838] hover:bg-[#4A4A4A] disabled:opacity-30 cursor-pointer"
                        title="Move Up"
                      >
                        <ArrowUp className="w-3.5 h-3.5 text-[#D9D9D9]" />
                      </button>
                      <button
                        disabled={index === cards.length - 1}
                        onClick={() => moveCardOrder(index, 'down')}
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
                          onNavigate({ type: 'CardEditor', folderId: folder.id, cardId: card.id })
                        }
                        className="p-2 text-xs rounded-lg bg-[#383838] hover:bg-[#4A4A4A] text-[#D9D9D9] transition-colors cursor-pointer"
                        title="Edit Card"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => handleDuplicate(card.id)}
                        className="p-2 text-xs rounded-lg bg-[#383838] hover:bg-[#4A4A4A] text-[#A8A8A8] hover:text-[#D9D9D9] transition-colors cursor-pointer"
                        title="Duplicate Card"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => {
                          setMoveCardModal(card);
                          setTargetMoveFolderId(folderId);
                        }}
                        className="p-2 text-xs rounded-lg bg-[#383838] hover:bg-[#4A4A4A] text-[#A8A8A8] hover:text-[#D9D9D9] transition-colors cursor-pointer"
                        title="Move to another folder"
                      >
                        <FolderInput className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => handleDeleteCard(card.id)}
                        className="p-2 text-xs rounded-lg hover:bg-[#383838] text-[#E57373] transition-colors cursor-pointer"
                        title="Delete Card"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Move Card Modal */}
      {moveCardModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-[#2F2F2F] border border-[#4A4A4A] rounded-xl max-w-sm w-full p-6 space-y-4 shadow-xl">
            <h3 className="text-lg font-bold text-[#D9D9D9]">Move Card to Folder</h3>
            <p className="text-xs text-[#A8A8A8] truncate font-medium">"{moveCardModal.front_text}"</p>
            <form onSubmit={handleMoveCardSubmit} className="space-y-4">
              <div>
                <label className="block text-xs text-[#A8A8A8] mb-1">Target Folder</label>
                <select
                  value={targetMoveFolderId}
                  onChange={(e) => setTargetMoveFolderId(Number(e.target.value))}
                  className="w-full bg-[#282828] border border-[#4A4A4A] rounded-lg p-2 text-sm text-[#D9D9D9] focus:outline-none focus:border-[#7FB5A5]"
                >
                  {allFolders.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name} {f.id === folderId ? '(Current)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setMoveCardModal(null)}
                  className="px-3 py-1.5 text-xs text-[#A8A8A8] hover:text-[#D9D9D9] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={targetMoveFolderId === folderId}
                  className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-[#D9D9D9] text-[#282828] hover:bg-white disabled:opacity-50 transition-colors cursor-pointer"
                >
                  Move Card
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
            <h3 className="text-lg font-bold text-[#D9D9D9]">Import CSV into "{folder.name}"</h3>
            <p className="text-xs text-[#A8A8A8]">
              Paste lines of <code className="text-[#7FB5A5]">front,back</code> text.
            </p>
            <form onSubmit={handleImportCsv} className="space-y-4">
              <textarea
                rows={6}
                value={importCsvText}
                onChange={(e) => setImportCsvText(e.target.value)}
                placeholder={`front,back\n"Question 1","Answer 1"\n"Question 2","Answer 2"`}
                className="w-full bg-[#282828] border border-[#4A4A4A] rounded-lg p-3 text-xs font-mono text-[#D9D9D9] focus:outline-none focus:border-[#7FB5A5]"
              />

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowImportModal(false)}
                  className="px-3 py-1.5 text-xs text-[#A8A8A8] hover:text-[#D9D9D9] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!importCsvText.trim()}
                  className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-[#D9D9D9] text-[#282828] hover:bg-white disabled:opacity-50 transition-colors cursor-pointer"
                >
                  Import
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
