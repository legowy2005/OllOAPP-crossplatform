import React, { useState } from 'react';
import { db, CardEntity } from '../data/database';
import { ScreenDestination } from '../navigation';
import { transliterateToGlassesAscii } from '../core/asciiTransliteration';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  RotateCw,
  Glasses,
  Edit2,
  Image as ImageIcon,
} from 'lucide-react';

interface GlassesPreviewScreenProps {
  folderId: number;
  folderName: string;
  onNavigate: (dest: ScreenDestination) => void;
}

export const GlassesPreviewScreen: React.FC<GlassesPreviewScreenProps> = ({
  folderId,
  folderName,
  onNavigate,
}) => {
  const folder = db.getFolder(folderId);
  const cards = db.getCardsInFolder(folderId);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [hudColor, setHudColor] = useState<'green' | 'amber' | 'white'>('green');

  if (cards.length === 0) {
    return (
      <div className="w-full max-w-3xl mx-auto px-4 py-12 text-center space-y-4">
        <Glasses className="w-12 h-12 text-[#7D7D7D] mx-auto" />
        <h2 className="text-xl font-bold text-[#D9D9D9]">No cards to preview</h2>
        <p className="text-xs text-[#A8A8A8]">Add some flashcards to "{folderName}" first.</p>
        <button
          onClick={() => onNavigate({ type: 'Folder', folderId, folderName })}
          className="px-4 py-2 text-xs font-semibold rounded-lg bg-[#D9D9D9] text-[#282828] hover:bg-white cursor-pointer"
        >
          Back to Folder
        </button>
      </div>
    );
  }

  const currentCard = cards[currentIndex] || cards[0];
  const frontImg = currentCard.front_image_id ? db.getImage(currentCard.front_image_id) : null;
  const backImg = currentCard.back_image_id ? db.getImage(currentCard.back_image_id) : null;

  const currentText = isFlipped ? currentCard.back_text : currentCard.front_text;
  const currentImg = isFlipped ? backImg : frontImg;

  const sanitizedText = transliterateToGlassesAscii(currentText, 100).cleanText;

  const handleNext = () => {
    setIsFlipped(false);
    setCurrentIndex((prev) => (prev + 1) % cards.length);
  };

  const handlePrev = () => {
    setIsFlipped(false);
    setCurrentIndex((prev) => (prev - 1 + cards.length) % cards.length);
  };

  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => onNavigate({ type: 'Folder', folderId, folderName })}
          className="inline-flex items-center gap-1.5 text-xs text-[#A8A8A8] hover:text-[#D9D9D9] transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to {folderName}
        </button>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 bg-[#2F2F2F] p-1 rounded-lg border border-[#4A4A4A]">
            <button
              onClick={() => setHudColor('green')}
              className={`px-2 py-0.5 text-xs rounded cursor-pointer ${
                hudColor === 'green' ? 'bg-[#2E403B] text-[#7FB5A5] font-semibold' : 'text-[#A8A8A8]'
              }`}
            >
              Green HUD
            </button>
            <button
              onClick={() => setHudColor('white')}
              className={`px-2 py-0.5 text-xs rounded cursor-pointer ${
                hudColor === 'white' ? 'bg-[#383838] text-white font-semibold' : 'text-[#A8A8A8]'
              }`}
            >
              White HUD
            </button>
            <button
              onClick={() => setHudColor('amber')}
              className={`px-2 py-0.5 text-xs rounded cursor-pointer ${
                hudColor === 'amber' ? 'bg-[#3E301F] text-[#FFB74D] font-semibold' : 'text-[#A8A8A8]'
              }`}
            >
              Amber HUD
            </button>
          </div>

          <button
            onClick={() =>
              onNavigate({
                type: 'CardEditor',
                folderId,
                cardId: currentCard.id,
              })
            }
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-[#383838] hover:bg-[#4A4A4A] text-[#D9D9D9] border border-[#4A4A4A] cursor-pointer"
          >
            <Edit2 className="w-3.5 h-3.5" />
            Edit Card
          </button>
        </div>
      </div>

      {/* Smart Glasses HUD Viewer Container */}
      <div className="bg-[#2F2F2F] border border-[#4A4A4A] rounded-2xl p-6 sm:p-8 space-y-6 shadow-2xl">
        <div className="flex items-center justify-between text-xs text-[#A8A8A8]">
          <div className="flex items-center gap-2">
            <Glasses className="w-4 h-4 text-[#7FB5A5]" />
            <span className="font-semibold text-[#D9D9D9]">Smart Glasses Optical HUD Simulation</span>
            <span>·</span>
            <span>{folderName}</span>
          </div>
          <div className="font-mono tabular-nums">
            Card {currentIndex + 1} of {cards.length}
          </div>
        </div>

        {/* Optical Glass Lens Bezel */}
        <div className="relative mx-auto max-w-2xl aspect-[16/10] bg-[#121614] rounded-2xl border-4 border-[#383838] shadow-inner p-4 flex flex-col justify-between overflow-hidden">
          {/* Subtle waveguide optical reflection & grid */}
          <div className="absolute inset-0 pointer-events-none opacity-20 bg-gradient-to-tr from-transparent via-[#7FB5A5]/10 to-transparent" />
          <div className="absolute inset-0 pointer-events-none oled-screen opacity-40" />

          {/* Top HUD Status Bar on Glasses */}
          <div className="relative z-10 flex items-center justify-between text-[11px] font-mono tracking-wider text-[#7FB5A5]/80 border-b border-[#7FB5A5]/20 pb-1.5">
            <span className="truncate max-w-[200px]">{folderName.toUpperCase()}</span>
            <span>{isFlipped ? '[ANSWER / BACK]' : '[QUESTION / FRONT]'}</span>
            <span>
              {currentIndex + 1}/{cards.length}
            </span>
          </div>

          {/* Main Visual Display on HUD */}
          <div className="relative z-10 flex-1 flex flex-col items-center justify-center p-4 text-center my-auto">
            {currentImg && (
              <div className="max-h-48 max-w-full mb-3 flex items-center justify-center overflow-hidden">
                <img
                  src={currentImg.display_data}
                  alt="HUD diagram"
                  className="max-h-48 max-w-full object-contain filter"
                  style={{
                    filter:
                      hudColor === 'green'
                        ? 'sepia(100%) hue-rotate(110deg) saturate(300%) drop-shadow(0 0 6px rgba(127,181,165,0.4))'
                        : hudColor === 'amber'
                        ? 'sepia(100%) hue-rotate(30deg) saturate(400%) drop-shadow(0 0 6px rgba(255,183,77,0.4))'
                        : 'drop-shadow(0 0 4px rgba(255,255,255,0.4))',
                  }}
                />
              </div>
            )}

            <div
              className={`font-mono text-base sm:text-xl font-bold tracking-wide transition-all ${
                hudColor === 'green'
                  ? 'text-[#7FB5A5] drop-shadow-[0_0_8px_rgba(127,181,165,0.5)]'
                  : hudColor === 'amber'
                  ? 'text-[#FFB74D] drop-shadow-[0_0_8px_rgba(255,183,77,0.5)]'
                  : 'text-white drop-shadow-[0_0_6px_rgba(255,255,255,0.4)]'
              }`}
            >
              {sanitizedText}
            </div>
          </div>

          {/* Bottom HUD Hint on Glasses */}
          <div className="relative z-10 flex items-center justify-between text-[10px] font-mono text-[#7FB5A5]/60 pt-1 border-t border-[#7FB5A5]/20">
            <span>OLLO FIRMWARE V1.0</span>
            <span>TAP TEMPLE TO FLIP</span>
          </div>
        </div>

        {/* Carousel & Flip Controls */}
        <div className="flex items-center justify-between max-w-md mx-auto pt-2">
          <button
            onClick={handlePrev}
            className="flex items-center gap-1 px-3 py-2 rounded-lg bg-[#383838] hover:bg-[#4A4A4A] text-[#D9D9D9] text-xs font-medium cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
            Previous
          </button>

          <button
            onClick={() => setIsFlipped(!isFlipped)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#D9D9D9] text-[#282828] hover:bg-white text-xs font-bold transition-all cursor-pointer shadow-md"
          >
            <RotateCw className="w-4 h-4" />
            Flip Card ({isFlipped ? 'Show Front' : 'Show Back'})
          </button>

          <button
            onClick={handleNext}
            className="flex items-center gap-1 px-3 py-2 rounded-lg bg-[#383838] hover:bg-[#4A4A4A] text-[#D9D9D9] text-xs font-medium cursor-pointer"
          >
            Next
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
