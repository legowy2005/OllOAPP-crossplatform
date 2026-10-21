import React, { useState } from 'react';
import { db, CardEntity } from '../data/database';
import { ScreenDestination } from '../navigation';
import { transliterateToGlassesAscii } from '../core/asciiTransliteration';
import {
  ArrowLeft,
  Save,
  Image as ImageIcon,
  AlertTriangle,
  Info,
  Check,
  Trash2,
  Sparkles,
} from 'lucide-react';

interface CardEditorScreenProps {
  folderId: number;
  cardId?: number;
  maxTextBytes?: number;
  onNavigate: (dest: ScreenDestination) => void;
}

export const CardEditorScreen: React.FC<CardEditorScreenProps> = ({
  folderId,
  cardId,
  maxTextBytes = 100,
  onNavigate,
}) => {
  const existingCard = cardId ? db.getCard(cardId) : undefined;
  const folder = db.getFolder(folderId);

  const [frontText, setFrontText] = useState(existingCard?.front_text || '');
  const [backText, setBackText] = useState(existingCard?.back_text || '');
  const [frontImageId, setFrontImageId] = useState<number | null>(
    existingCard?.front_image_id || null
  );
  const [backImageId, setBackImageId] = useState<number | null>(
    existingCard?.back_image_id || null
  );

  const frontImg = frontImageId ? db.getImage(frontImageId) : null;
  const backImg = backImageId ? db.getImage(backImageId) : null;

  // Live transliteration & ASCII sanitization
  const frontTrans = transliterateToGlassesAscii(frontText, maxTextBytes);
  const backTrans = transliterateToGlassesAscii(backText, maxTextBytes);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!frontText.trim() && !frontImageId) {
      alert('Front side must have either text or an image.');
      return;
    }

    db.saveCard(
      folderId,
      cardId || null,
      frontText,
      backText,
      frontImageId,
      backImageId
    );

    if (folder) {
      onNavigate({ type: 'Folder', folderId: folder.id, folderName: folder.name });
    } else {
      onNavigate({ type: 'Home' });
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => {
            if (folder) {
              onNavigate({ type: 'Folder', folderId: folder.id, folderName: folder.name });
            } else {
              onNavigate({ type: 'Home' });
            }
          }}
          className="inline-flex items-center gap-1.5 text-xs text-[#A8A8A8] hover:text-[#D9D9D9] transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to {folder?.name || 'Deck'}
        </button>

        <span className="text-xs text-[#7D7D7D] font-mono">
          Device limit: {maxTextBytes} bytes/side
        </span>
      </div>

      <div className="bg-[#2F2F2F] border border-[#4A4A4A] rounded-xl p-6 space-y-6">
        <div className="border-b border-[#383838] pb-4">
          <h2 className="text-2xl font-bold text-[#D9D9D9]">
            {existingCard ? 'Edit Flashcard' : 'New Flashcard'}
          </h2>
          <p className="text-xs text-[#A8A8A8] mt-1">
            Card contents are live-transliterated for the Ollo micro-OLED smart glasses display.
          </p>
        </div>

        <form onSubmit={handleSave} className="space-y-6">
          {/* FRONT SIDE */}
          <div className="space-y-3 bg-[#282828] p-4.5 rounded-xl border border-[#383838]">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#7FB5A5] uppercase tracking-wider">
                Front Side (Question / Term)
              </span>
              <div
                className={`text-xs font-mono tabular-nums ${
                  frontTrans.isTruncated
                    ? 'text-[#E57373] font-bold'
                    : frontTrans.byteLength > maxTextBytes * 0.85
                    ? 'text-[#FFB74D]'
                    : 'text-[#A8A8A8]'
                }`}
              >
                {frontTrans.byteLength} / {maxTextBytes} bytes
              </div>
            </div>

            <textarea
              rows={3}
              value={frontText}
              onChange={(e) => setFrontText(e.target.value)}
              placeholder="Enter front text, question, or term..."
              className="w-full bg-[#2F2F2F] border border-[#4A4A4A] rounded-lg p-3 text-sm text-[#D9D9D9] placeholder-[#7D7D7D] focus:outline-none focus:border-[#7FB5A5]"
            />

            {/* Live Sanitization Warning / Preview */}
            {frontTrans.wasModified && (
              <div className="flex items-start gap-2 bg-[#2E403B]/60 border border-[#7FB5A5]/30 rounded-lg p-2.5 text-xs text-[#D9D9D9]">
                <Info className="w-4 h-4 text-[#7FB5A5] shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <div className="font-medium text-[#7FB5A5]">Glasses ASCII Transliteration:</div>
                  <div className="font-mono text-[#D9D9D9] bg-[#1F2724] px-2 py-1 rounded">
                    "{frontTrans.cleanText}"
                  </div>
                  {frontTrans.warnings.map((w, i) => (
                    <div key={i} className="text-[11px] text-[#A8A8A8]">
                      {w}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Front Image Slot */}
            <div className="pt-2">
              <div className="text-xs font-medium text-[#A8A8A8] mb-2 flex items-center justify-between">
                <span>Front Graphic (Optional)</span>
                {frontImg && (
                  <button
                    type="button"
                    onClick={() => setFrontImageId(null)}
                    className="text-xs text-[#E57373] hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Trash2 className="w-3 h-3" /> Remove image
                  </button>
                )}
              </div>

              {frontImg ? (
                <div className="flex items-center gap-4 bg-[#2F2F2F] border border-[#4A4A4A] rounded-lg p-3">
                  <div className="w-24 h-16 bg-[#000000] border border-[#7FB5A5]/40 rounded overflow-hidden flex items-center justify-center shrink-0">
                    <img
                      src={frontImg.display_data}
                      alt="Front preview"
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <div className="flex-1 min-w-0 text-xs space-y-1">
                    <div className="font-semibold text-[#D9D9D9]">
                      {frontImg.width}x{frontImg.height} ·{' '}
                      {frontImg.format === 0
                        ? '1-bit Monochrome'
                        : frontImg.format === 2
                        ? '2-bit Grayscale'
                        : 'RGB565 Color'}
                    </div>
                    <div className="text-[#A8A8A8] font-mono">
                      Size: {(frontImg.device_data.length / 1024).toFixed(1)} KB · ID: 0x
                      {frontImg.id.toString(16).toUpperCase()}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      onNavigate({
                        type: 'ImageEditor',
                        folderId,
                        cardId,
                        isFront: true,
                      })
                    }
                    className="px-3 py-1.5 text-xs bg-[#383838] hover:bg-[#4A4A4A] text-[#D9D9D9] rounded border border-[#4A4A4A] cursor-pointer"
                  >
                    Re-edit
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() =>
                    onNavigate({
                      type: 'ImageEditor',
                      folderId,
                      cardId,
                      isFront: true,
                    })
                  }
                  className="w-full py-3 px-4 border border-dashed border-[#4A4A4A] hover:border-[#7FB5A5] rounded-lg text-xs text-[#A8A8A8] hover:text-[#D9D9D9] flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <ImageIcon className="w-4 h-4 text-[#7FB5A5]" />
                  Open Image Editor (Process Photo, Diagram or Sample Vector)
                </button>
              )}
            </div>
          </div>

          {/* BACK SIDE */}
          <div className="space-y-3 bg-[#282828] p-4.5 rounded-xl border border-[#383838]">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#7FB5A5] uppercase tracking-wider">
                Back Side (Answer / Detail)
              </span>
              <div
                className={`text-xs font-mono tabular-nums ${
                  backTrans.isTruncated
                    ? 'text-[#E57373] font-bold'
                    : backTrans.byteLength > maxTextBytes * 0.85
                    ? 'text-[#FFB74D]'
                    : 'text-[#A8A8A8]'
                }`}
              >
                {backTrans.byteLength} / {maxTextBytes} bytes
              </div>
            </div>

            <textarea
              rows={3}
              value={backText}
              onChange={(e) => setBackText(e.target.value)}
              placeholder="Enter back text, explanation, or definition..."
              className="w-full bg-[#2F2F2F] border border-[#4A4A4A] rounded-lg p-3 text-sm text-[#D9D9D9] placeholder-[#7D7D7D] focus:outline-none focus:border-[#7FB5A5]"
            />

            {/* Back Sanitization Warning / Preview */}
            {backTrans.wasModified && (
              <div className="flex items-start gap-2 bg-[#2E403B]/60 border border-[#7FB5A5]/30 rounded-lg p-2.5 text-xs text-[#D9D9D9]">
                <Info className="w-4 h-4 text-[#7FB5A5] shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <div className="font-medium text-[#7FB5A5]">Glasses ASCII Transliteration:</div>
                  <div className="font-mono text-[#D9D9D9] bg-[#1F2724] px-2 py-1 rounded">
                    "{backTrans.cleanText}"
                  </div>
                  {backTrans.warnings.map((w, i) => (
                    <div key={i} className="text-[11px] text-[#A8A8A8]">
                      {w}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Back Image Slot */}
            <div className="pt-2">
              <div className="text-xs font-medium text-[#A8A8A8] mb-2 flex items-center justify-between">
                <span>Back Graphic (Optional)</span>
                {backImg && (
                  <button
                    type="button"
                    onClick={() => setBackImageId(null)}
                    className="text-xs text-[#E57373] hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Trash2 className="w-3 h-3" /> Remove image
                  </button>
                )}
              </div>

              {backImg ? (
                <div className="flex items-center gap-4 bg-[#2F2F2F] border border-[#4A4A4A] rounded-lg p-3">
                  <div className="w-24 h-16 bg-[#000000] border border-[#7FB5A5]/40 rounded overflow-hidden flex items-center justify-center shrink-0">
                    <img
                      src={backImg.display_data}
                      alt="Back preview"
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <div className="flex-1 min-w-0 text-xs space-y-1">
                    <div className="font-semibold text-[#D9D9D9]">
                      {backImg.width}x{backImg.height} ·{' '}
                      {backImg.format === 0
                        ? '1-bit Monochrome'
                        : backImg.format === 2
                        ? '2-bit Grayscale'
                        : 'RGB565 Color'}
                    </div>
                    <div className="text-[#A8A8A8] font-mono">
                      Size: {(backImg.device_data.length / 1024).toFixed(1)} KB · ID: 0x
                      {backImg.id.toString(16).toUpperCase()}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      onNavigate({
                        type: 'ImageEditor',
                        folderId,
                        cardId,
                        isFront: false,
                      })
                    }
                    className="px-3 py-1.5 text-xs bg-[#383838] hover:bg-[#4A4A4A] text-[#D9D9D9] rounded border border-[#4A4A4A] cursor-pointer"
                  >
                    Re-edit
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() =>
                    onNavigate({
                      type: 'ImageEditor',
                      folderId,
                      cardId,
                      isFront: false,
                    })
                  }
                  className="w-full py-3 px-4 border border-dashed border-[#4A4A4A] hover:border-[#7FB5A5] rounded-lg text-xs text-[#A8A8A8] hover:text-[#D9D9D9] flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <ImageIcon className="w-4 h-4 text-[#7FB5A5]" />
                  Open Image Editor (Process Photo, Diagram or Sample Vector)
                </button>
              )}
            </div>
          </div>

          {/* Form Submit Buttons */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => {
                if (folder) {
                  onNavigate({ type: 'Folder', folderId: folder.id, folderName: folder.name });
                } else {
                  onNavigate({ type: 'Home' });
                }
              }}
              className="px-4 py-2 text-xs font-medium text-[#A8A8A8] hover:text-[#D9D9D9] cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex items-center gap-2 px-5 py-2.5 text-xs font-semibold rounded-lg bg-[#D9D9D9] text-[#282828] hover:bg-white transition-colors cursor-pointer shadow-sm"
            >
              <Save className="w-4 h-4" />
              Save Flashcard
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
