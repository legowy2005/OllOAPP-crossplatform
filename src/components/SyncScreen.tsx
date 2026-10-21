import React, { useState, useEffect } from 'react';
import { SyncEngine, SyncProgressState } from '../sync/SyncEngine';
import { GlassesTransport, ConnectionState } from '../ble/GlassesTransport';
import { db } from '../data/database';
import { ScreenDestination } from '../navigation';
import {
  RefreshCw,
  XCircle,
  Play,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  HardDrive,
  Layers,
  FileText,
  Image as ImageIcon,
  Radio,
  ArrowLeft,
  ChevronRight,
  Terminal,
} from 'lucide-react';

interface SyncScreenProps {
  syncEngine: SyncEngine;
  transport: GlassesTransport;
  isSimulated: boolean;
  onNavigate: (dest: ScreenDestination) => void;
}

export const SyncScreen: React.FC<SyncScreenProps> = ({
  syncEngine,
  transport,
  isSimulated,
  onNavigate,
}) => {
  const [syncState, setSyncState] = useState<SyncProgressState>(syncEngine.getState());
  const [connectionState, setConnectionState] = useState<ConnectionState>(transport.connectionState);

  useEffect(() => {
    const unsubSync = syncEngine.subscribe((state) => {
      setSyncState(state);
    });
    const unsubConn = transport.onConnectionChange((conn) => {
      setConnectionState(conn);
    });

    return () => {
      unsubSync();
      unsubConn();
    };
  }, [syncEngine, transport]);

  const storageEstimate = db.calculateStorageEstimate();

  const handleStart = () => {
    syncEngine.startSync();
  };

  const handleCancel = () => {
    syncEngine.cancel();
  };

  const handleRetry = () => {
    syncEngine.startSync();
  };

  // Phase badge color
  const getPhaseColor = () => {
    switch (syncState.phase) {
      case 'Done':
        return 'text-[#81C784] bg-[#2E403B] border-[#81C784]/40';
      case 'Failed':
        return 'text-[#E57373] bg-[#3B2626] border-[#E57373]/40';
      case 'Idle':
        return 'text-[#A8A8A8] bg-[#383838] border-[#4A4A4A]';
      default:
        return 'text-[#7FB5A5] bg-[#2E403B] border-[#7FB5A5]/40';
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <button
            onClick={() => onNavigate({ type: 'Home' })}
            className="inline-flex items-center gap-1.5 text-xs text-[#A8A8A8] hover:text-[#D9D9D9] transition-colors cursor-pointer mb-1"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Decks
          </button>
          <h1 className="text-2xl font-bold text-[#D9D9D9] tracking-tight">BLE Flashcard Sync</h1>
          <p className="text-xs text-[#A8A8A8]">
            Push cards and micro-OLED graphics directly to your smart glasses over Bluetooth Low Energy.
          </p>
        </div>

        {/* View Packet Log Button */}
        <button
          onClick={() => onNavigate({ type: 'Settings' })}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-[#383838] hover:bg-[#4A4A4A] text-[#D9D9D9] border border-[#4A4A4A] transition-colors cursor-pointer"
        >
          <Terminal className="w-4 h-4 text-[#7FB5A5]" />
          Diagnostics & Packet Log
        </button>
      </div>

      {/* Main Sync Status Card */}
      <div className="bg-[#2F2F2F] border border-[#4A4A4A] rounded-2xl p-6 sm:p-8 space-y-6 shadow-xl">
        {/* Status Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#383838] pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#383838] flex items-center justify-center border border-[#4A4A4A] shrink-0">
              <Radio
                className={`w-5 h-5 ${
                  syncState.active
                    ? 'text-[#7FB5A5] animate-pulse'
                    : syncState.phase === 'Done'
                    ? 'text-[#81C784]'
                    : syncState.phase === 'Failed'
                    ? 'text-[#E57373]'
                    : 'text-[#A8A8A8]'
                }`}
              />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold text-[#D9D9D9]">
                  {isSimulated ? 'Simulated ESP32 Glasses' : transport.deviceName}
                </span>
                <span className={`text-[11px] font-mono px-2 py-0.5 rounded border ${getPhaseColor()}`}>
                  {syncState.phase}
                </span>
              </div>
              <p className="text-xs text-[#A8A8A8] mt-0.5">{syncState.statusText}</p>
            </div>
          </div>

          <div className="text-right text-xs text-[#7D7D7D] font-mono">
            <div>BLE MTU: {transport.getMaxPayloadSize()}B</div>
            <div>STATUS: {connectionState}</div>
          </div>
        </div>

        {/* Progress Bar & Percentage */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="text-[#A8A8A8]">{syncState.stepName}</span>
            <span className="text-[#D9D9D9] font-bold tabular-nums">
              {(syncState.progress * 100).toFixed(0)}%
            </span>
          </div>

          <div className="w-full h-3 bg-[#282828] rounded-full overflow-hidden border border-[#4A4A4A]">
            <div
              className={`h-full transition-all duration-300 rounded-full ${
                syncState.phase === 'Failed'
                  ? 'bg-[#E57373]'
                  : syncState.phase === 'Done'
                  ? 'bg-[#81C784]'
                  : 'bg-[#7FB5A5]'
              }`}
              style={{ width: `${Math.max(2, syncState.progress * 100)}%` }}
            />
          </div>
        </div>

        {/* Error Callout if Failed */}
        {syncState.phase === 'Failed' && (
          <div className="bg-[#3B2626] border border-[#E57373]/50 rounded-xl p-4 text-xs text-[#E57373] space-y-1">
            <div className="font-bold flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4" />
              Sync Error ({syncState.stepName})
            </div>
            <p className="text-[#D9D9D9]">{syncState.errorMessage || syncState.statusText}</p>
          </div>
        )}

        {/* Transmission Statistics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
          <div className="bg-[#282828] p-3.5 rounded-xl border border-[#383838]">
            <div className="text-[#7D7D7D] text-[10px] uppercase">Cards Synced</div>
            <div className="text-[#D9D9D9] text-base font-bold tabular-nums mt-0.5">
              {syncState.syncedCards} / {syncState.totalCards || storageEstimate.cardCount}
            </div>
          </div>

          <div className="bg-[#282828] p-3.5 rounded-xl border border-[#383838]">
            <div className="text-[#7D7D7D] text-[10px] uppercase">Images Synced</div>
            <div className="text-[#7FB5A5] text-base font-bold tabular-nums mt-0.5">
              {syncState.syncedImages} / {syncState.totalImages || storageEstimate.imageCount}
            </div>
          </div>

          <div className="bg-[#282828] p-3.5 rounded-xl border border-[#383838]">
            <div className="text-[#7D7D7D] text-[10px] uppercase">Folders Included</div>
            <div className="text-[#D9D9D9] text-base font-bold tabular-nums mt-0.5">
              {storageEstimate.syncedFolderCount} decks
            </div>
          </div>

          <div className="bg-[#282828] p-3.5 rounded-xl border border-[#383838]">
            <div className="text-[#7D7D7D] text-[10px] uppercase">Glasses Free Storage</div>
            <div className="text-[#D9D9D9] text-base font-bold tabular-nums mt-0.5">
              {(syncState.storageFreeBytes / 1024).toFixed(1)} KB
            </div>
          </div>
        </div>

        {/* Action Controls: Start / Cancel / Retry */}
        <div className="flex items-center justify-between pt-2 border-t border-[#383838]">
          <div className="text-xs text-[#7D7D7D]">
            {isSimulated ? 'Using In-Memory ESP32 Firmware Simulator' : 'Physical BLE Active'}
          </div>

          <div className="flex items-center gap-3">
            {syncState.active ? (
              <button
                onClick={handleCancel}
                className="flex items-center gap-2 px-5 py-2.5 text-xs font-semibold rounded-lg bg-[#383838] hover:bg-[#4A4A4A] text-[#E57373] border border-[#4A4A4A] transition-colors cursor-pointer"
              >
                <XCircle className="w-4 h-4" />
                Cancel Sync
              </button>
            ) : syncState.phase === 'Failed' ? (
              <button
                onClick={handleRetry}
                disabled={!syncState.canRetry}
                className="flex items-center gap-2 px-5 py-2.5 text-xs font-semibold rounded-lg bg-[#D9D9D9] text-[#282828] hover:bg-white disabled:opacity-50 transition-colors cursor-pointer shadow-sm"
              >
                <RotateCcw className="w-4 h-4" />
                Retry Sync
              </button>
            ) : (
              <button
                onClick={handleStart}
                className="flex items-center gap-2 px-6 py-2.5 text-xs font-semibold rounded-lg bg-[#D9D9D9] text-[#282828] hover:bg-white transition-colors cursor-pointer shadow-sm"
              >
                <Play className="w-4 h-4 fill-current" />
                {syncState.phase === 'Done' ? 'Sync Again' : 'Start BLE Sync'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
