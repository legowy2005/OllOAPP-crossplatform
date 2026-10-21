/**
 * OllO Flashcard Manager for Smart Glasses over BLE.
 * Kotlin Multiplatform Architecture & Behavior Reference.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { ScreenDestination } from './navigation';
import { TopBar } from './components/TopBar';
import { HomeScreen } from './components/HomeScreen';
import { FolderScreen } from './components/FolderScreen';
import { CardEditorScreen } from './components/CardEditorScreen';
import { ImageEditorScreen } from './components/ImageEditorScreen';
import { SyncScreen } from './components/SyncScreen';
import { SettingsScreen } from './components/SettingsScreen';
import { GlassesPreviewScreen } from './components/GlassesPreviewScreen';
import { SimulatedGlasses } from './ble/SimulatedGlasses';
import { WebBleGlassesTransport } from './ble/WebBleTransport';
import { GlassesTransport, ConnectionState } from './ble/GlassesTransport';
import { SyncEngine } from './sync/SyncEngine';
import { db } from './data/database';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<ScreenDestination>({ type: 'Home' });
  const [isSimulated, setIsSimulated] = useState<boolean>(true);
  const [, setDbRevision] = useState(0);

  // Subscribe to DB changes
  useEffect(() => {
    return db.subscribe(() => {
      setDbRevision((r) => r + 1);
    });
  }, []);

  // Instantiate transports
  const simulatedTransport = useMemo(() => new SimulatedGlasses(), []);
  const webBleTransport = useMemo(() => new WebBleGlassesTransport(), []);

  const activeTransport: GlassesTransport = isSimulated ? simulatedTransport : webBleTransport;
  const syncEngine = useMemo(() => new SyncEngine(activeTransport), [activeTransport]);

  const [connectionState, setConnectionState] = useState<ConnectionState>(activeTransport.connectionState);

  useEffect(() => {
    syncEngine.setTransport(activeTransport);
    const unsub = activeTransport.onConnectionChange((state) => {
      setConnectionState(state);
    });
    setConnectionState(activeTransport.connectionState);
    return unsub;
  }, [activeTransport, syncEngine]);

  const handleToggleSimulated = (useSimulated: boolean) => {
    setIsSimulated(useSimulated);
  };

  return (
    <div className="min-h-screen bg-[#282828] text-[#D9D9D9] flex flex-col font-sans selection:bg-[#7FB5A5] selection:text-[#282828]">
      {/* Top Bar Navigation */}
      <TopBar
        currentScreen={currentScreen}
        onNavigate={setCurrentScreen}
        connectionState={connectionState}
        deviceName={activeTransport.deviceName}
        isSimulated={isSimulated}
        onOpenSync={() => setCurrentScreen({ type: 'Sync' })}
      />

      {/* Main Viewport Container: Centered max-width column */}
      <main className="flex-1 w-full max-w-5xl mx-auto px-4 sm:px-6 py-4">
        {currentScreen.type === 'Home' && (
          <HomeScreen onNavigate={setCurrentScreen} />
        )}

        {currentScreen.type === 'Folder' && (
          <FolderScreen
            folderId={currentScreen.folderId}
            folderName={currentScreen.folderName}
            onNavigate={setCurrentScreen}
          />
        )}

        {currentScreen.type === 'CardEditor' && (
          <CardEditorScreen
            folderId={currentScreen.folderId}
            cardId={currentScreen.cardId}
            maxTextBytes={syncEngine.getDeviceLimits().maxTextBytes}
            onNavigate={setCurrentScreen}
          />
        )}

        {currentScreen.type === 'ImageEditor' && (
          <ImageEditorScreen
            folderId={currentScreen.folderId}
            cardId={currentScreen.cardId}
            isFront={currentScreen.isFront}
            onNavigate={setCurrentScreen}
          />
        )}

        {currentScreen.type === 'Sync' && (
          <SyncScreen
            syncEngine={syncEngine}
            transport={activeTransport}
            isSimulated={isSimulated}
            onNavigate={setCurrentScreen}
          />
        )}

        {currentScreen.type === 'Settings' && (
          <SettingsScreen
            transport={activeTransport}
            isSimulated={isSimulated}
            onToggleSimulated={handleToggleSimulated}
            onNavigate={setCurrentScreen}
          />
        )}

        {currentScreen.type === 'Preview' && (
          <GlassesPreviewScreen
            folderId={currentScreen.folderId}
            folderName={currentScreen.folderName}
            onNavigate={setCurrentScreen}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="w-full border-t border-[#383838] py-4 px-6 text-center text-xs text-[#7D7D7D]">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>OllO Smart Glasses Flashcards · Kotlin Multiplatform Architecture</span>
          <div className="flex items-center gap-4 text-[#A8A8A8]">
            <button
              onClick={() => setCurrentScreen({ type: 'Settings' })}
              className="hover:text-[#D9D9D9] cursor-pointer"
            >
              Hardware Protocol
            </button>
            <span>·</span>
            <button
              onClick={() => setCurrentScreen({ type: 'Sync' })}
              className="hover:text-[#D9D9D9] cursor-pointer"
            >
              BLE Sync
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
