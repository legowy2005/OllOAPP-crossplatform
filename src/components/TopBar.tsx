import React from 'react';
import { ScreenDestination } from '../navigation';
import { ConnectionState } from '../ble/GlassesTransport';

interface TopBarProps {
  currentScreen: ScreenDestination;
  onNavigate: (dest: ScreenDestination) => void;
  connectionState: ConnectionState;
  deviceName: string;
  isSimulated: boolean;
  onOpenSync: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  currentScreen,
  onNavigate,
  connectionState,
  deviceName,
  isSimulated,
  onOpenSync,
}) => {
  return (
    <header className="w-full bg-[#2F2F2F] border-b border-[#4A4A4A] px-4 md:px-8 py-3.5 sticky top-0 z-40">
      <div className="max-w-6xl mx-auto flex items-center justify-between gap-8">
        {/* Zone 1: Single text element wordmark */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => onNavigate({ type: 'Home' })}
            className="text-left group cursor-pointer focus-visible:outline-none"
          >
            <span className="text-xl font-bold tracking-tight text-[#D9D9D9] group-hover:text-white transition-colors">
              OllO
            </span>
            <span className="ml-2 text-xs text-[#7FB5A5] font-medium tracking-wide">
              SMART GLASSES
            </span>
          </button>
        </div>

        {/* Zone 2: Single-line clean text navigation links */}
        <nav className="hidden md:flex items-center gap-7 text-sm font-medium">
          <button
            onClick={() => onNavigate({ type: 'Home' })}
            className={`whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
              currentScreen.type === 'Home'
                ? 'text-[#7FB5A5] border-b-2 border-[#7FB5A5] pb-0.5'
                : 'text-[#A8A8A8] hover:text-[#D9D9D9]'
            }`}
          >
            Decks
          </button>

          <button
            onClick={() => onNavigate({ type: 'Sync' })}
            className={`whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
              currentScreen.type === 'Sync'
                ? 'text-[#7FB5A5] border-b-2 border-[#7FB5A5] pb-0.5'
                : 'text-[#A8A8A8] hover:text-[#D9D9D9]'
            }`}
          >
            Sync
          </button>

          <button
            onClick={() => onNavigate({ type: 'Settings' })}
            className={`whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
              currentScreen.type === 'Settings'
                ? 'text-[#7FB5A5] border-b-2 border-[#7FB5A5] pb-0.5'
                : 'text-[#A8A8A8] hover:text-[#D9D9D9]'
            }`}
          >
            Settings & Diagnostics
          </button>
        </nav>

        {/* Zone 3: Hardware Status + 1 primary action */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="hidden sm:flex items-center gap-2 text-xs text-[#A8A8A8] bg-[#383838] px-2.5 py-1.5 rounded border border-[#4A4A4A]">
            <span
              className={`w-2 h-2 rounded-full ${
                connectionState === 'CONNECTED'
                  ? 'bg-[#81C784]'
                  : connectionState === 'CONNECTING'
                  ? 'bg-[#FFB74D] animate-ping'
                  : 'bg-[#7D7D7D]'
              }`}
            />
            <span className="truncate max-w-[130px]">
              {connectionState === 'CONNECTED'
                ? isSimulated
                  ? 'Simulated Glasses'
                  : deviceName
                : connectionState === 'CONNECTING'
                ? 'Connecting...'
                : 'Disconnected'}
            </span>
          </div>

          <button
            onClick={onOpenSync}
            className="px-4 py-1.5 text-xs font-semibold rounded bg-[#D9D9D9] text-[#282828] hover:bg-white transition-colors cursor-pointer whitespace-nowrap shrink-0 shadow-sm"
          >
            Sync to Glasses
          </button>
        </div>
      </div>
    </header>
  );
};
