import React, { useRef } from 'react';
import {
  Radio,
  FileCode,
  Cpu,
  Play,
  Pause,
  RotateCcw,
  Download,
  Activity,
  Zap,
  Settings,
  Usb,
} from 'lucide-react';
import { GpsFixType } from '../types/mavlink';
import { SimulatorMode } from '../services/simulator';
import { SerialPortItem } from '../services/serial';

interface HeaderProps {
  sourceType: 'serial' | 'replay' | 'sim';
  setSourceType: (type: 'serial' | 'replay' | 'sim') => void;
  // Serial
  serialConnected: boolean;
  onSerialConnect: () => void;
  onSerialDisconnect: () => void;
  serialBaud: number;
  setSerialBaud: (baud: number) => void;
  pairedPorts: SerialPortItem[];
  selectedPort: SerialPortItem | null;
  onSelectPort: (port: SerialPortItem) => void;
  onRequestNewPort: () => Promise<void>;
  onOpenPortModal: () => void;
  // Replay
  replayPlaying: boolean;
  replayProgress: number;
  onReplayPlay: () => void;
  onReplayPause: () => void;
  onReplaySeek: (p: number) => void;
  onReplaySpeed: (s: number) => void;
  onFileUpload: (file: File) => void;
  replayFileName: string | null;
  // Sim
  simRunning: boolean;
  simMode: SimulatorMode;
  simFixType: GpsFixType;
  onToggleSim: () => void;
  onSimModeChange: (m: SimulatorMode) => void;
  onSimFixTypeChange: (f: GpsFixType) => void;
  // General
  onResetData: () => void;
  onOpenExport: () => void;
  rxPacketCount: number;
  isRxActive: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  sourceType,
  setSourceType,
  serialConnected,
  onSerialConnect,
  onSerialDisconnect,
  serialBaud,
  setSerialBaud,
  pairedPorts,
  selectedPort,
  onSelectPort,
  onRequestNewPort,
  onOpenPortModal,
  replayPlaying,
  replayProgress,
  onReplayPlay,
  onReplayPause,
  onReplaySeek,
  onReplaySpeed,
  onFileUpload,
  replayFileName,
  simRunning,
  simMode,
  simFixType,
  onToggleSim,
  onSimModeChange,
  onSimFixTypeChange,
  onResetData,
  onOpenExport,
  rxPacketCount,
  isRxActive,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const baudRates = [9600, 19200, 38400, 57600, 115200, 230400, 460800, 921600];

  return (
    <header className="bg-cyber-black border-b border-cyber-border px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 select-none">
      {/* Brand & Logo */}
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 border border-cyber-line flex items-center justify-center bg-cyber-dark corner-box">
          <Radio className="w-4 h-4 text-cyber-line animate-pulse" />
        </div>
        <div>
          <div className="text-sm font-bold tracking-widest text-cyber-line text-glow flex items-center gap-2">
            MAV_GPS_VIEWER
            <span className="text-[10px] px-1 py-0.5 border border-cyber-dim text-cyber-muted tracking-normal">
              v0.1.0
            </span>
          </div>
          <div className="text-[10px] text-cyber-muted tracking-tight">
            ZERO-BACKEND AVIONICS TELEMETRY
          </div>
        </div>
      </div>

      {/* Center Data Source Controls */}
      <div className="flex items-center gap-2 bg-cyber-dark border border-cyber-border p-1">
        {/* Source Tabs */}
        <button
          onClick={() => setSourceType('serial')}
          className={`px-2.5 py-1 text-xs flex items-center gap-1.5 transition-colors border ${
            sourceType === 'serial'
              ? 'bg-cyber-line/10 text-cyber-line border-cyber-line font-bold'
              : 'text-cyber-muted/60 border-transparent hover:text-cyber-muted'
          }`}
        >
          <Radio className="w-3.5 h-3.5" />
          WEB SERIAL
        </button>

        <button
          onClick={() => setSourceType('replay')}
          className={`px-2.5 py-1 text-xs flex items-center gap-1.5 transition-colors border ${
            sourceType === 'replay'
              ? 'bg-cyber-line/10 text-cyber-line border-cyber-line font-bold'
              : 'text-cyber-muted/60 border-transparent hover:text-cyber-muted'
          }`}
        >
          <FileCode className="w-3.5 h-3.5" />
          LOG REPLAY
        </button>

        <button
          onClick={() => setSourceType('sim')}
          className={`px-2.5 py-1 text-xs flex items-center gap-1.5 transition-colors border ${
            sourceType === 'sim'
              ? 'bg-cyber-line/10 text-cyber-line border-cyber-line font-bold'
              : 'text-cyber-muted/60 border-transparent hover:text-cyber-muted'
          }`}
        >
          <Cpu className="w-3.5 h-3.5" />
          SIMULATOR
        </button>

        <div className="h-4 w-[1px] bg-cyber-border mx-1" />

        {/* Source-specific Sub-controls */}
        {sourceType === 'serial' && (
          <div className="flex items-center gap-2">
            {/* COM Port Selector Dropdown / Button */}
            <div className="flex items-center">
              {pairedPorts.length > 0 ? (
                <select
                  value={selectedPort?.id || ''}
                  onChange={(e) => {
                    const found = pairedPorts.find((p) => p.id === e.target.value);
                    if (found) onSelectPort(found);
                  }}
                  disabled={serialConnected}
                  className="bg-black text-cyber-line border border-cyber-border px-2 py-0.5 text-xs focus:outline-none focus:border-cyber-line cursor-pointer max-w-[200px] truncate"
                  title="選擇已授權之 COM Port"
                >
                  {pairedPorts.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.displayName}
                    </option>
                  ))}
                </select>
              ) : (
                <button
                  onClick={onRequestNewPort}
                  disabled={serialConnected}
                  className="bg-black text-cyber-muted hover:text-cyber-line border border-cyber-border hover:border-cyber-line px-2 py-0.5 text-xs flex items-center gap-1 transition-colors"
                  title="新增或選取系統串口 (/dev/ttyUSB0, COM3...)"
                >
                  <Usb className="w-3 h-3 text-cyber-line" />
                  <span>+ 選取 COM 埠</span>
                </button>
              )}

              {/* Port Manager Modal Button */}
              <button
                onClick={onOpenPortModal}
                className="p-1 border border-l-0 border-cyber-border hover:border-cyber-line text-cyber-muted hover:text-cyber-line bg-black"
                title="開啟 COM 埠設定視窗"
              >
                <Settings className="w-3 h-3" />
              </button>
            </div>

            {/* Baud Rate Selector */}
            <select
              value={serialBaud}
              onChange={(e) => setSerialBaud(Number(e.target.value))}
              disabled={serialConnected}
              className="bg-black text-cyber-line border border-cyber-border px-2 py-0.5 text-xs focus:outline-none focus:border-cyber-line cursor-pointer"
            >
              {baudRates.map((b) => (
                <option key={b} value={b}>
                  {b} bps
                </option>
              ))}
            </select>

            {/* Connect / Disconnect Action */}
            {serialConnected ? (
              <button
                onClick={onSerialDisconnect}
                className="bg-red-950/40 text-red-400 border border-red-800 hover:bg-red-900/50 px-2.5 py-0.5 text-xs font-bold transition-colors"
              >
                DISCONNECT
              </button>
            ) : (
              <button
                onClick={onSerialConnect}
                className="bg-cyber-line/10 text-cyber-line border border-cyber-line hover:bg-cyber-line/20 px-2.5 py-0.5 text-xs font-bold transition-colors flex items-center gap-1"
              >
                <Zap className="w-3 h-3" />
                CONNECT
              </button>
            )}
          </div>
        )}

        {sourceType === 'replay' && (
          <div className="flex items-center gap-2">
            <input
              type="file"
              ref={fileInputRef}
              accept=".tlog,.bin,.raw,.csv"
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  onFileUpload(e.target.files[0]);
                }
              }}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="bg-black text-cyber-line border border-cyber-border hover:border-cyber-line px-2 py-0.5 text-xs cursor-pointer truncate max-w-[120px]"
            >
              {replayFileName ? replayFileName : 'LOAD FILE...'}
            </button>

            {replayFileName && (
              <>
                <button
                  onClick={replayPlaying ? onReplayPause : onReplayPlay}
                  className="p-1 border border-cyber-line text-cyber-line hover:bg-cyber-line/20"
                >
                  {replayPlaying ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                </button>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={replayProgress}
                  onChange={(e) => onReplaySeek(Number(e.target.value))}
                  className="w-20 accent-cyber-line h-1 bg-cyber-border cursor-pointer"
                />
                <span className="text-[10px] text-cyber-muted w-8">{Math.round(replayProgress)}%</span>
                <div className="flex gap-1 text-[10px]">
                  {[1, 2, 5, 10].map((spd) => (
                    <button
                      key={spd}
                      onClick={() => onReplaySpeed(spd)}
                      className="px-1 border border-cyber-border hover:border-cyber-line text-cyber-muted hover:text-cyber-line"
                    >
                      {spd}x
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {sourceType === 'sim' && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => onSimModeChange(simMode === 'stationary' ? 'orbit' : 'stationary')}
              className="px-2 py-0.5 text-xs border border-cyber-border text-cyber-line hover:border-cyber-line"
            >
              MODE: {simMode.toUpperCase()}
            </button>
            <select
              value={simFixType}
              onChange={(e) => onSimFixTypeChange(Number(e.target.value) as GpsFixType)}
              className="bg-black text-cyber-line border border-cyber-border px-1.5 py-0.5 text-xs focus:outline-none"
            >
              <option value={GpsFixType.FIX_3D}>3D FIX</option>
              <option value={GpsFixType.RTK_FLOAT}>RTK FLOAT</option>
              <option value={GpsFixType.RTK_FIXED}>RTK FIXED</option>
            </select>
            <button
              onClick={onToggleSim}
              className={`px-2.5 py-0.5 text-xs font-bold border transition-colors ${
                simRunning
                  ? 'bg-amber-950/40 text-amber-400 border-amber-800 hover:bg-amber-900/50'
                  : 'bg-cyber-line/10 text-cyber-line border-cyber-line hover:bg-cyber-line/20'
              }`}
            >
              {simRunning ? 'STOP SIM' : 'START SIM'}
            </button>
          </div>
        )}
      </div>

      {/* Right Action Tools & RX Status */}
      <div className="flex items-center gap-3">
        {/* RX Activity LED Indicator */}
        <div className="flex items-center gap-1.5 px-2 py-1 bg-cyber-dark border border-cyber-border text-xs">
          <Activity
            className={`w-3.5 h-3.5 ${
              isRxActive ? 'text-cyber-line drop-shadow-[0_0_5px_#00ff66]' : 'text-cyber-dim'
            }`}
          />
          <span className="text-[11px] text-cyber-muted font-mono">
            RX: <span className="text-cyber-line font-bold">{rxPacketCount}</span>
          </span>
        </div>

        {/* Export Button */}
        <button
          onClick={onOpenExport}
          title="Export flight data (CSV / KML / GeoJSON)"
          className="px-2.5 py-1 text-xs border border-cyber-line text-cyber-line bg-cyber-dark hover:bg-cyber-line/20 transition-colors flex items-center gap-1.5"
        >
          <Download className="w-3.5 h-3.5" />
          EXPORT
        </button>

        {/* Reset / Clear Button */}
        <button
          onClick={onResetData}
          title="Reset telemetry & trajectory (F5 clears everything)"
          className="px-2.5 py-1 text-xs border border-cyber-border text-cyber-muted hover:border-cyber-line hover:text-cyber-line bg-cyber-dark transition-colors flex items-center gap-1.5"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          CLEAR
        </button>
      </div>
    </header>
  );
};
