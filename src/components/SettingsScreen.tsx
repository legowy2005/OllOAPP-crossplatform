import React, { useState, useEffect } from 'react';
import { db } from '../data/database';
import { ScreenDestination } from '../navigation';
import { SimulatedGlasses } from '../ble/SimulatedGlasses';
import { WebBleGlassesTransport } from '../ble/WebBleTransport';
import { GlassesTransport, ConnectionState, PacketLogEntry } from '../ble/GlassesTransport';
import { runAllUnitTests, TestResult } from '../tests/unitTests';
import { generateKmpZip } from '../kmp/exportZip';
import { KMP_SOURCE_FILES, KmpFile } from '../kmp/kmpSources';
import {
  HardDrive,
  Bluetooth,
  Terminal,
  Cpu,
  RefreshCw,
  Check,
  Search,
  Radio,
  FileCode,
  Download,
  Play,
  CheckCircle2,
  XCircle,
  Copy,
  ChevronRight,
  Code2,
} from 'lucide-react';

interface SettingsScreenProps {
  transport: GlassesTransport;
  isSimulated: boolean;
  onToggleSimulated: (useSimulated: boolean) => void;
  onNavigate: (dest: ScreenDestination) => void;
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({
  transport,
  isSimulated,
  onToggleSimulated,
  onNavigate,
}) => {
  const config = db.getConfig();

  // Storage Budget Dialog
  const [showBudgetDialog, setShowBudgetDialog] = useState(false);
  const [budgetInput, setBudgetInput] = useState(config.budgetKb.toString());

  // Glasses Scan Dialog
  const [showScanDialog, setShowScanDialog] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [discoveredDevices, setDiscoveredDevices] = useState<
    { id: string; name: string; rssi: number; isSimulated?: boolean }[]
  >([]);

  // Packet Log Dialog
  const [showPacketLogDialog, setShowPacketLogDialog] = useState(false);
  const [packetLogs, setPacketLogs] = useState<PacketLogEntry[]>([...SimulatedGlasses.packetLogs]);

  // Unit Tests state
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [isRunningTests, setIsRunningTests] = useState(false);

  // KMP Codebase Viewer
  const [showKmpViewer, setShowKmpViewer] = useState(false);
  const [selectedKmpFile, setSelectedKmpFile] = useState<KmpFile>(KMP_SOURCE_FILES[3]); // Protocol.kt or Crc32.kt
  const [isDownloadingZip, setIsDownloadingZip] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setPacketLogs([...SimulatedGlasses.packetLogs]);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleSaveBudget = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseInt(budgetInput, 10);
    if (!isNaN(val) && val > 0) {
      db.updateConfig({ budgetKb: val });
      setShowBudgetDialog(false);
    }
  };

  const handleStartScan = async () => {
    setIsScanning(true);
    setDiscoveredDevices([]);

    // Scan mockup with simulated devices and physical Web BLE probe
    await new Promise((r) => setTimeout(r, 600));

    const found = [
      { id: 'sim_1', name: 'Ollo (Simulated ESP32)', rssi: -58, isSimulated: true },
    ];

    if (WebBleGlassesTransport.isSupported()) {
      found.push({ id: 'phy_1', name: 'Ollo BLE Smart Glasses', rssi: -64, isSimulated: false });
    }

    setDiscoveredDevices(found);
    setIsScanning(false);
  };

  const handleConnectDevice = async (device: { id: string; name: string; isSimulated?: boolean }) => {
    if (device.isSimulated) {
      onToggleSimulated(true);
    } else {
      onToggleSimulated(false);
      try {
        await transport.connect();
      } catch (e) {
        alert('Physical BLE connection cancelled or unavailable: ' + (e as any)?.message);
      }
    }
    setShowScanDialog(false);
  };

  const handleRunTests = async () => {
    setIsRunningTests(true);
    const results = await runAllUnitTests();
    setTestResults(results);
    setIsRunningTests(false);
  };

  const handleDownloadKmpZip = async () => {
    try {
      setIsDownloadingZip(true);
      const blob = await generateKmpZip();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'ollo_smart_glasses_kmp_project.zip';
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert('Failed generating zip: ' + e);
    } finally {
      setIsDownloadingZip(false);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-8 space-y-6">
      {/* Title */}
      <div>
        <h1 className="text-2xl font-bold text-[#D9D9D9] tracking-tight">Settings & Diagnostics</h1>
        <p className="text-xs text-[#A8A8A8] mt-1">
          Configure offline flash storage budget, Bluetooth LE connection, and firmware diagnostics.
        </p>
      </div>

      {/* 1. STORAGE ESTIMATION */}
      <div className="bg-[#2F2F2F] border border-[#4A4A4A] rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2.5 text-sm font-semibold text-[#D9D9D9]">
          <HardDrive className="w-4 h-4 text-[#7FB5A5]" />
          <span>Storage Estimation</span>
        </div>

        <div className="flex items-center justify-between p-3.5 bg-[#282828] rounded-xl border border-[#383838]">
          <div>
            <div className="text-xs font-semibold text-[#D9D9D9]">Offline Storage Budget</div>
            <div className="text-[11px] text-[#A8A8A8]">
              Maximum flash budget allocated for decks on glasses (Default: 1408 KB / 1.37 MB)
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm font-mono font-bold text-[#7FB5A5] tabular-nums">
              {config.budgetKb} KB
            </span>
            <button
              onClick={() => {
                setBudgetInput(config.budgetKb.toString());
                setShowBudgetDialog(true);
              }}
              className="px-3 py-1.5 text-xs bg-[#383838] hover:bg-[#4A4A4A] text-[#D9D9D9] rounded-lg border border-[#4A4A4A] transition-colors cursor-pointer"
            >
              Change Budget
            </button>
          </div>
        </div>
      </div>

      {/* 2. GLASSES CONNECTION */}
      <div className="bg-[#2F2F2F] border border-[#4A4A4A] rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2.5 text-sm font-semibold text-[#D9D9D9]">
          <Bluetooth className="w-4 h-4 text-[#7FB5A5]" />
          <span>Glasses Connection</span>
        </div>

        <div className="space-y-3">
          {/* Active Device Info & Scan Button */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 bg-[#282828] rounded-xl border border-[#383838]">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-[#D9D9D9]">
                  {isSimulated ? 'Ollo (Simulated ESP32 Firmware)' : transport.deviceName}
                </span>
                <span className="text-[10px] font-mono text-[#81C784] bg-[#2E403B] px-1.5 py-0.5 rounded border border-[#81C784]/30">
                  {transport.connectionState}
                </span>
              </div>
              <div className="text-[11px] text-[#A8A8A8] mt-0.5">
                Service: <code className="text-[#7FB5A5] font-mono">6f6c6c6f-0001-...-00805f9b34fb</code>
              </div>
            </div>

            <button
              onClick={() => {
                setShowScanDialog(true);
                handleStartScan();
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-[#383838] hover:bg-[#4A4A4A] text-[#D9D9D9] rounded-lg border border-[#4A4A4A] transition-colors cursor-pointer self-start sm:self-auto"
            >
              <Search className="w-3.5 h-3.5 text-[#7FB5A5]" />
              Scan for Devices
            </button>
          </div>

          {/* Automatic Reconnect Toggle */}
          <div className="flex items-center justify-between p-3.5 bg-[#282828] rounded-xl border border-[#383838]">
            <div>
              <div className="text-xs font-semibold text-[#D9D9D9]">Automatic Reconnect</div>
              <div className="text-[11px] text-[#A8A8A8]">
                Silently reconnect to smart glasses when in range
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={config.autoReconnect}
                onChange={(e) => db.updateConfig({ autoReconnect: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-[#383838] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#7FB5A5]" />
            </label>
          </div>
        </div>
      </div>

      {/* 3. DEVELOPER & DIAGNOSTICS */}
      <div className="bg-[#2F2F2F] border border-[#4A4A4A] rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2.5 text-sm font-semibold text-[#D9D9D9]">
          <Cpu className="w-4 h-4 text-[#7FB5A5]" />
          <span>Developer & Diagnostics</span>
        </div>

        <div className="space-y-3">
          {/* Simulated Glasses Toggle */}
          <div className="flex items-center justify-between p-3.5 bg-[#282828] rounded-xl border border-[#383838]">
            <div>
              <div className="text-xs font-semibold text-[#D9D9D9]">Use Simulated Glasses</div>
              <div className="text-[11px] text-[#A8A8A8]">
                Emulates exact ESP32 firmware in memory (~300ms connect, full packet handling)
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={isSimulated}
                onChange={(e) => onToggleSimulated(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-[#383838] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#7FB5A5]" />
            </label>
          </div>

          {/* Action buttons row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <button
              onClick={() => setShowPacketLogDialog(true)}
              className="flex items-center justify-center gap-2 p-3 rounded-xl bg-[#282828] hover:bg-[#383838] border border-[#383838] text-xs text-[#D9D9D9] transition-colors cursor-pointer"
            >
              <Terminal className="w-4 h-4 text-[#7FB5A5]" />
              BLE Packet Log ({packetLogs.length})
            </button>

            <button
              onClick={handleRunTests}
              className="flex items-center justify-center gap-2 p-3 rounded-xl bg-[#282828] hover:bg-[#383838] border border-[#383838] text-xs text-[#D9D9D9] transition-colors cursor-pointer"
            >
              <Play className="w-4 h-4 text-[#81C784]" />
              Run Protocol Tests
            </button>

            <button
              onClick={() => setShowKmpViewer(true)}
              className="flex items-center justify-center gap-2 p-3 rounded-xl bg-[#282828] hover:bg-[#383838] border border-[#383838] text-xs text-[#D9D9D9] transition-colors cursor-pointer"
            >
              <Code2 className="w-4 h-4 text-[#FFB74D]" />
              KMP Gradle Source ({KMP_SOURCE_FILES.length} files)
            </button>
          </div>

          {/* Test Results Output */}
          {testResults.length > 0 && (
            <div className="bg-[#282828] rounded-xl border border-[#383838] p-4 space-y-2.5">
              <div className="flex items-center justify-between text-xs text-[#A8A8A8]">
                <span className="font-semibold text-[#D9D9D9]">
                  Protocol & Sync Test Suite Results
                </span>
                <span className="font-mono text-[#81C784]">
                  {testResults.filter((r) => r.passed).length}/{testResults.length} PASSED
                </span>
              </div>
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {testResults.map((t, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between text-xs py-1 px-2 rounded bg-[#2F2F2F] border border-[#4A4A4A]/50 font-mono"
                  >
                    <div className="flex items-center gap-2 truncate">
                      {t.passed ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-[#81C784] shrink-0" />
                      ) : (
                        <XCircle className="w-3.5 h-3.5 text-[#E57373] shrink-0" />
                      )}
                      <span className="text-[#7FB5A5]">[{t.suite}]</span>
                      <span className="text-[#D9D9D9] truncate">{t.name}</span>
                    </div>
                    <span className="text-[#7D7D7D] shrink-0">{t.durationMs}ms</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* DIALOG: Storage Budget */}
      {showBudgetDialog && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-[#2F2F2F] border border-[#4A4A4A] rounded-xl max-w-sm w-full p-6 space-y-4 shadow-xl">
            <h3 className="text-lg font-bold text-[#D9D9D9]">Storage Budget (KB)</h3>
            <p className="text-xs text-[#A8A8A8]">
              Default glasses memory partition allocation is 1408 KB (1,441,792 bytes).
            </p>
            <form onSubmit={handleSaveBudget} className="space-y-4">
              <div>
                <label className="block text-xs text-[#A8A8A8] mb-1">Budget Limit in Kilobytes</label>
                <input
                  type="number"
                  min="128"
                  max="16384"
                  value={budgetInput}
                  onChange={(e) => setBudgetInput(e.target.value)}
                  className="w-full bg-[#282828] border border-[#4A4A4A] rounded-lg p-2.5 text-sm text-[#D9D9D9] font-mono focus:outline-none focus:border-[#7FB5A5]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowBudgetDialog(false)}
                  className="px-3 py-1.5 text-xs text-[#A8A8A8] hover:text-[#D9D9D9] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-[#D9D9D9] text-[#282828] hover:bg-white transition-colors cursor-pointer"
                >
                  Save Budget
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DIALOG: Device Scan "Available devices" */}
      {showScanDialog && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-[#2F2F2F] border border-[#4A4A4A] rounded-xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-[#D9D9D9]">Available devices</h3>
              {isScanning && <RefreshCw className="w-4 h-4 text-[#7FB5A5] animate-spin" />}
            </div>
            <p className="text-xs text-[#A8A8A8]">
              Scanning for Bluetooth Low Energy smart glasses advertising service UUID{' '}
              <code className="text-[#7FB5A5]">6f6c6c6f-0001-...</code>
            </p>

            <div className="space-y-2 max-h-60 overflow-y-auto">
              {discoveredDevices.map((dev) => (
                <div
                  key={dev.id}
                  onClick={() => handleConnectDevice(dev)}
                  className="flex items-center justify-between p-3 rounded-lg bg-[#282828] hover:bg-[#383838] border border-[#4A4A4A] cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <Radio className="w-4 h-4 text-[#7FB5A5]" />
                    <div>
                      <div className="text-xs font-semibold text-[#D9D9D9]">{dev.name}</div>
                      <div className="text-[10px] text-[#A8A8A8]">{dev.isSimulated ? 'Internal Emulator' : 'Hardware'}</div>
                    </div>
                  </div>
                  <div className="text-xs font-mono text-[#81C784] font-bold">
                    {dev.rssi} dBm
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowScanDialog(false)}
                className="px-4 py-2 text-xs font-medium text-[#A8A8A8] hover:text-[#D9D9D9] cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DIALOG: BLE Packet Log with hex dumps */}
      {showPacketLogDialog && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className="bg-[#2F2F2F] border border-[#4A4A4A] rounded-xl max-w-4xl w-full p-6 space-y-4 shadow-2xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-[#383838] pb-3">
              <div className="flex items-center gap-2">
                <Terminal className="w-5 h-5 text-[#7FB5A5]" />
                <h3 className="text-lg font-bold text-[#D9D9D9]">BLE Packet Log & Hex Dumps</h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    SimulatedGlasses.packetLogs = [];
                    setPacketLogs([]);
                  }}
                  className="px-2.5 py-1 text-xs text-[#E57373] hover:underline cursor-pointer"
                >
                  Clear Logs
                </button>
                <button
                  onClick={() => setShowPacketLogDialog(false)}
                  className="px-3 py-1 text-xs bg-[#383838] text-[#D9D9D9] rounded hover:bg-[#4A4A4A] cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1 font-mono text-xs">
              {packetLogs.length === 0 ? (
                <div className="text-center py-12 text-[#7D7D7D]">No BLE packets recorded yet. Run a sync or test to observe packets.</div>
              ) : (
                packetLogs.map((log) => (
                  <div
                    key={log.id}
                    className={`p-2.5 rounded-lg border text-xs ${
                      log.direction === 'TX'
                        ? 'bg-[#282828] border-[#4A4A4A]'
                        : 'bg-[#1E2925] border-[#7FB5A5]/40'
                    }`}
                  >
                    <div className="flex items-center justify-between text-[11px] mb-1">
                      <span className={log.direction === 'TX' ? 'text-[#FFB74D] font-bold' : 'text-[#81C784] font-bold'}>
                        [{log.direction}] {log.summary}
                      </span>
                      <span className="text-[#7D7D7D]">
                        {new Date(log.timestamp).toLocaleTimeString()}.{log.timestamp % 1000} ({log.rawBytes.length}B)
                      </span>
                    </div>
                    <div className="text-[11px] text-[#A8A8A8] break-all bg-black/40 p-1.5 rounded select-all">
                      {log.hex}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* DIALOG: KMP Source Code Browser & Zip Download */}
      {showKmpViewer && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className="bg-[#2F2F2F] border border-[#4A4A4A] rounded-xl max-w-5xl w-full p-6 space-y-4 shadow-2xl max-h-[88vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-[#383838] pb-3">
              <div className="flex items-center gap-2">
                <FileCode className="w-5 h-5 text-[#7FB5A5]" />
                <div>
                  <h3 className="text-lg font-bold text-[#D9D9D9]">Kotlin Multiplatform Codebase</h3>
                  <p className="text-[11px] text-[#A8A8A8]">Android, iOS & Windows Desktop Gradle Project</p>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <button
                  onClick={handleDownloadKmpZip}
                  disabled={isDownloadingZip}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold bg-[#7FB5A5] hover:bg-[#91c5b6] text-[#282828] rounded-lg transition-colors cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  {isDownloadingZip ? 'Archiving...' : 'Download Project (.zip)'}
                </button>
                <button
                  onClick={() => setShowKmpViewer(false)}
                  className="px-3 py-1.5 text-xs bg-[#383838] text-[#D9D9D9] rounded hover:bg-[#4A4A4A] cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>

            <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-4 min-h-0">
              {/* File Tree */}
              <div className="md:col-span-4 bg-[#282828] border border-[#383838] rounded-lg p-2 overflow-y-auto space-y-1">
                {KMP_SOURCE_FILES.map((file) => (
                  <button
                    key={file.path}
                    onClick={() => setSelectedKmpFile(file)}
                    className={`w-full text-left px-2.5 py-1.5 rounded text-xs font-mono truncate transition-colors cursor-pointer ${
                      selectedKmpFile.path === file.path
                        ? 'bg-[#2E403B] text-[#7FB5A5] font-bold'
                        : 'text-[#A8A8A8] hover:text-[#D9D9D9] hover:bg-[#383838]'
                    }`}
                  >
                    {file.path}
                  </button>
                ))}
              </div>

              {/* File Content Preview */}
              <div className="md:col-span-8 bg-[#1E1E1E] border border-[#383838] rounded-lg p-3.5 flex flex-col min-h-0">
                <div className="flex items-center justify-between text-xs text-[#7D7D7D] font-mono border-b border-[#2E2E2E] pb-2 mb-2">
                  <span>{selectedKmpFile.path}</span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(selectedKmpFile.content);
                      alert('Copied to clipboard');
                    }}
                    className="flex items-center gap-1 text-[#7FB5A5] hover:underline cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    Copy
                  </button>
                </div>
                <pre className="flex-1 overflow-auto text-xs font-mono text-[#D9D9D9] select-all whitespace-pre leading-relaxed">
                  {selectedKmpFile.content}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
