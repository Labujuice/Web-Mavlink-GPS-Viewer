import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Header } from './components/Header';
import { TelemetryBar } from './components/TelemetryBar';
import { SkyplotChart } from './components/SkyplotChart';
import { CepChart } from './components/CepChart';
import { MapView } from './components/MapView';
import { MessageInspector } from './components/MessageInspector';
import { ExportModal } from './components/ExportModal';
import { SerialPortModal } from './components/SerialPortModal';
import { MessageRateModal } from './components/MessageRateModal';

import { MavlinkDecoder } from './mavlink/decoder';
import { encodeSetMessageInterval, encodeRequestMessage } from './mavlink/encoder';
import { WebSerialService, SerialPortItem, getSerialDiagnostic } from './services/serial';
import { LogReplayService } from './services/logReplay';
import { GpsSimulator, SimulatorMode } from './services/simulator';
import { AlertTriangle } from 'lucide-react';
import {
  TrajectoryPoint,
  SatelliteInfo,
  GpsRawIntMsg,
  GlobalPositionIntMsg,
  GpsRtkMsg,
  DecodedMavPacket,
  GpsFixType,
} from './types/mavlink';
import { calculateCepStats } from './utils/geo';

export const App: React.FC = () => {
  // Source State
  const [sourceType, setSourceType] = useState<'serial' | 'replay' | 'sim'>('sim');
  const [serialConnected, setSerialConnected] = useState<boolean>(false);
  const [serialBaud, setSerialBaud] = useState<number>(115200);
  const [pairedPorts, setPairedPorts] = useState<SerialPortItem[]>([]);
  const [selectedPort, setSelectedPort] = useState<SerialPortItem | null>(null);
  const [isSerialModalOpen, setIsSerialModalOpen] = useState<boolean>(false);

  // Message Stream Rate State
  const [isRateModalOpen, setIsRateModalOpen] = useState<boolean>(false);
  const [measuredRates, setMeasuredRates] = useState<Record<number, number>>({});
  const packetTimestampsRef = useRef<Record<number, number[]>>({});
  const txSeqRef = useRef<number>(0);

  // Replay State
  const [replayPlaying, setReplayPlaying] = useState<boolean>(false);
  const [replayProgress, setReplayProgress] = useState<number>(0);
  const [replayFileName, setReplayFileName] = useState<string | null>(null);

  // Simulator State
  const [simRunning, setSimRunning] = useState<boolean>(false);
  const [simMode, setSimMode] = useState<SimulatorMode>('stationary');
  const [simFixType, setSimFixType] = useState<GpsFixType>(GpsFixType.RTK_FIXED);

  // Telemetry & Data
  const [rxPacketCount, setRxPacketCount] = useState<number>(0);
  const [isRxActive, setIsRxActive] = useState<boolean>(false);
  const [gpsRaw, setGpsRaw] = useState<GpsRawIntMsg | null>(null);
  const [globalPos, setGlobalPos] = useState<GlobalPositionIntMsg | null>(null);
  const [gpsRtk, setGpsRtk] = useState<GpsRtkMsg | null>(null);
  const [satellites, setSatellites] = useState<SatelliteInfo[]>([]);
  const [points, setPoints] = useState<TrajectoryPoint[]>([]);
  const [latestPackets, setLatestPackets] = useState<Record<number, DecodedMavPacket>>({});
  const [statusLogs, setStatusLogs] = useState<{ timestamp: number; text: string; severity: number }[]>([]);

  // CEP State
  const [manualRefCoord, setManualRefCoord] = useState<{ lat: number; lon: number } | null>(null);

  // Export Modal
  const [isExportOpen, setIsExportOpen] = useState<boolean>(false);

  // References for services
  const decoderRef = useRef<MavlinkDecoder>(new MavlinkDecoder());
  const serialServiceRef = useRef<WebSerialService | null>(null);
  const replayServiceRef = useRef<LogReplayService | null>(null);
  const simulatorRef = useRef<GpsSimulator | null>(null);
  const rxTimerRef = useRef<any>(null);

  // Flash RX Activity Indicator
  const triggerRxPulse = useCallback(() => {
    setIsRxActive(true);
    if (rxTimerRef.current) clearTimeout(rxTimerRef.current);
    rxTimerRef.current = setTimeout(() => setIsRxActive(false), 120);
  }, []);

  // Handle Inbound Decoded MAVLink Packet
  const handlePacket = useCallback((packet: DecodedMavPacket) => {
    const now = Date.now();
    setRxPacketCount((c) => c + 1);
    triggerRxPulse();

    // Track arrival timestamp for Hz measurement
    if (!packetTimestampsRef.current[packet.msgId]) {
      packetTimestampsRef.current[packet.msgId] = [];
    }
    packetTimestampsRef.current[packet.msgId].push(now);

    setLatestPackets((prev) => ({ ...prev, [packet.msgId]: packet }));

    // 1. GPS_RAW_INT (#24) or GPS2_RAW (#124)
    if (packet.msgId === 24 || packet.msgId === 124) {
      const raw = packet.payload as GpsRawIntMsg;
      setGpsRaw(raw);

      if (raw.lat !== 0 && raw.lon !== 0) {
        const latDeg = raw.lat / 1e7;
        const lonDeg = raw.lon / 1e7;
        const altM = raw.alt / 1e3;
        const headingDeg = raw.cog / 100;
        const speedMps = raw.vel / 100;

        const newPoint: TrajectoryPoint = {
          lat: latDeg,
          lon: lonDeg,
          alt: altM,
          timestamp: packet.timestamp,
          heading: headingDeg,
          fixType: raw.fix_type,
          sats: raw.satellites_visible,
          speed: speedMps,
        };

        setPoints((prev) => {
          const next = [...prev, newPoint];
          // Limit memory to latest 3000 points to avoid memory bloat
          return next.length > 3000 ? next.slice(next.length - 3000) : next;
        });
      }
    }

    // 2. GPS_STATUS (#25)
    if (packet.msgId === 25) {
      const p = packet.payload;
      const sats: SatelliteInfo[] = [];
      const prns: number[] = p.satellite_prn || [];
      const used: number[] = p.satellite_used || [];
      const elev: number[] = p.satellite_elevation || [];
      const az: number[] = p.satellite_azimuth || [];
      const snr: number[] = p.satellite_snr || [];

      for (let i = 0; i < prns.length; i++) {
        if (prns[i] > 0) {
          sats.push({
            prn: prns[i],
            used: used[i] === 1,
            elevation: elev[i] || 0,
            azimuth: az[i] || 0,
            snr: snr[i] || 0,
          });
        }
      }
      setSatellites(sats);
    }

    // 3. GLOBAL_POSITION_INT (#33)
    if (packet.msgId === 33) {
      setGlobalPos(packet.payload as GlobalPositionIntMsg);
    }

    // 4. GPS_RTK (#127) or GPS2_RTK (#128)
    if (packet.msgId === 127 || packet.msgId === 128) {
      setGpsRtk(packet.payload as GpsRtkMsg);
    }

    // 5. STATUSTEXT (#253)
    if (packet.msgId === 253) {
      const p = packet.payload;
      if (p.text) {
        setStatusLogs((prev) => [
          { timestamp: packet.timestamp, text: p.text, severity: p.severity || 6 },
          ...prev.slice(0, 99), // Keep latest 100 logs
        ]);
      }
    }
  }, [triggerRxPulse]);

  // Periodic Rate (Hz) Calculation
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      const newRates: Record<number, number> = {};
      for (const [msgIdStr, timestamps] of Object.entries(packetTimestampsRef.current)) {
        const id = Number(msgIdStr);
        // Keep timestamps in the last 2.0 seconds
        const valid = timestamps.filter((t) => now - t <= 2000);
        packetTimestampsRef.current[id] = valid;
        newRates[id] = valid.length / 2.0;
      }
      setMeasuredRates(newRates);
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Refresh Paired Serial Ports
  const refreshPairedPorts = useCallback(async () => {
    if (serialServiceRef.current) {
      const ports = await serialServiceRef.current.getPairedPorts();
      setPairedPorts(ports);
      if (ports.length > 0) {
        setSelectedPort((curr) => curr || ports[0]);
      }
    }
  }, []);

  // Request new port via browser native device picker
  const handleRequestNewPort = async () => {
    if (!serialServiceRef.current) return;
    try {
      const newPort = await serialServiceRef.current.requestNewPort();
      if (newPort) {
        setPairedPorts((prev) => [newPort, ...prev.filter((p) => p.id !== newPort.id)]);
        setSelectedPort(newPort);
      }
    } catch (e: any) {
      alert(e.message);
    }
  };

  // Initialize Decoder & Services
  useEffect(() => {
    decoderRef.current.onPacket = handlePacket;

    // Web Serial
    serialServiceRef.current = new WebSerialService(
      (chunk) => decoderRef.current.feed(chunk),
      (err) => alert(`串口連線錯誤: ${err.message}`),
      () => setSerialConnected(false)
    );

    refreshPairedPorts();

    // Log Replay
    replayServiceRef.current = new LogReplayService(
      (chunk) => decoderRef.current.feed(chunk),
      (prog) => setReplayProgress(prog),
      () => setReplayPlaying(false)
    );

    // Simulator
    simulatorRef.current = new GpsSimulator((packet) => handlePacket(packet));

    return () => {
      serialServiceRef.current?.disconnect();
      replayServiceRef.current?.pause();
      simulatorRef.current?.stop();
    };
  }, [handlePacket, refreshPairedPorts]);

  // Serial Connect / Disconnect
  const handleSerialConnect = async () => {
    if (!serialServiceRef.current) return;

    let targetPort = selectedPort;
    if (!targetPort) {
      targetPort = await serialServiceRef.current.requestNewPort();
      if (targetPort) {
        setPairedPorts((prev) => [targetPort!, ...prev.filter((p) => p.id !== targetPort!.id)]);
        setSelectedPort(targetPort);
      } else {
        return;
      }
    }

    try {
      const ok = await serialServiceRef.current.connect(targetPort.port, serialBaud);
      setSerialConnected(ok);
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleSerialDisconnect = async () => {
    await serialServiceRef.current?.disconnect();
    setSerialConnected(false);
  };

  // Send MAV_CMD_SET_MESSAGE_INTERVAL to Autopilot
  const handleSetMessageInterval = async (
    msgId: number,
    hz: number,
    targetSys: number = 1,
    targetComp: number = 1
  ): Promise<boolean> => {
    try {
      const packet = encodeSetMessageInterval(msgId, hz, txSeqRef.current++, targetSys, targetComp);
      if (serialServiceRef.current?.isConnected()) {
        await serialServiceRef.current.send(packet);
        setStatusLogs((prev) => [
          {
            timestamp: Date.now(),
            text: `[TX CMD] SET_MESSAGE_INTERVAL: Msg #${msgId} -> ${hz} Hz (${hz > 0 ? Math.round(1000000 / hz) + 'us' : 'OFF'})`,
            severity: 6,
          },
          ...prev.slice(0, 99),
        ]);
        return true;
      } else {
        alert('串口尚未連線，無法發送 MAVLink 頻率請求。請先點擊 CONNECT 連線至飛控。');
        return false;
      }
    } catch (e: any) {
      alert(`發送指令失敗: ${e.message}`);
      return false;
    }
  };

  // Send MAV_CMD_REQUEST_MESSAGE (One-shot)
  const handleRequestOnce = async (
    msgId: number,
    targetSys: number = 1,
    targetComp: number = 1
  ): Promise<boolean> => {
    try {
      const packet = encodeRequestMessage(msgId, txSeqRef.current++, targetSys, targetComp);
      if (serialServiceRef.current?.isConnected()) {
        await serialServiceRef.current.send(packet);
        setStatusLogs((prev) => [
          {
            timestamp: Date.now(),
            text: `[TX CMD] REQUEST_MESSAGE: Msg #${msgId} (One-shot)`,
            severity: 6,
          },
          ...prev.slice(0, 99),
        ]);
        return true;
      } else {
        alert('串口尚未連線，無法發送 MAVLink 指令。');
        return false;
      }
    } catch (e: any) {
      alert(`發送指令失敗: ${e.message}`);
      return false;
    }
  };

  // Batch Request
  const handleBatchSetRates = async (configs: { msgId: number; hz: number }[]) => {
    for (const cfg of configs) {
      await handleSetMessageInterval(cfg.msgId, cfg.hz);
      await new Promise((r) => setTimeout(r, 50)); // small delay
    }
  };

  // Replay Controls
  const handleFileUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result && replayServiceRef.current) {
        replayServiceRef.current.loadFile(e.target.result as ArrayBuffer);
        setReplayFileName(file.name);
        setReplayProgress(0);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleReplayPlay = () => {
    replayServiceRef.current?.play();
    setReplayPlaying(true);
  };

  const handleReplayPause = () => {
    replayServiceRef.current?.pause();
    setReplayPlaying(false);
  };

  const handleReplaySeek = (percent: number) => {
    replayServiceRef.current?.seek(percent);
    setReplayProgress(percent);
  };

  const handleReplaySpeed = (spd: number) => {
    replayServiceRef.current?.setSpeed(spd);
  };

  // Simulator Controls
  const handleToggleSim = () => {
    if (!simulatorRef.current) return;
    if (simRunning) {
      simulatorRef.current.stop();
      setSimRunning(false);
    } else {
      simulatorRef.current.start();
      setSimRunning(true);
    }
  };

  const handleSimModeChange = (m: SimulatorMode) => {
    setSimMode(m);
    if (simulatorRef.current) simulatorRef.current.mode = m;
  };

  const handleSimFixTypeChange = (f: GpsFixType) => {
    setSimFixType(f);
    if (simulatorRef.current) simulatorRef.current.fixType = f;
  };

  // Reset / Clear Data
  const handleResetData = () => {
    setPoints([]);
    setGpsRaw(null);
    setGlobalPos(null);
    setGpsRtk(null);
    setSatellites([]);
    setLatestPackets({});
    setStatusLogs([]);
    setRxPacketCount(0);
    packetTimestampsRef.current = {};
    setMeasuredRates({});
  };

  const handleResetCep = () => {
    setPoints([]);
  };

  // Computed CEP
  const cepStats = calculateCepStats(points, manualRefCoord || undefined);
  const currentPoint = points.length > 0 ? points[points.length - 1] : null;
  const usedSatsCount = satellites.filter((s) => s.used).length;

  return (
    <div className="flex flex-col h-screen w-screen bg-black text-cyber-text overflow-hidden">
      {/* 1. Top Cyber-HUD Header */}
      <Header
        sourceType={sourceType}
        setSourceType={(t) => {
          setSourceType(t);
          if (t !== 'sim' && simRunning) {
            simulatorRef.current?.stop();
            setSimRunning(false);
          }
        }}
        serialConnected={serialConnected}
        onSerialConnect={handleSerialConnect}
        onSerialDisconnect={handleSerialDisconnect}
        serialBaud={serialBaud}
        setSerialBaud={setSerialBaud}
        pairedPorts={pairedPorts}
        selectedPort={selectedPort}
        onSelectPort={setSelectedPort}
        onRequestNewPort={handleRequestNewPort}
        onOpenPortModal={() => setIsSerialModalOpen(true)}
        onOpenRateModal={() => setIsRateModalOpen(true)}
        replayPlaying={replayPlaying}
        replayProgress={replayProgress}
        onReplayPlay={handleReplayPlay}
        onReplayPause={handleReplayPause}
        onReplaySeek={handleReplaySeek}
        onReplaySpeed={handleReplaySpeed}
        onFileUpload={handleFileUpload}
        replayFileName={replayFileName}
        simRunning={simRunning}
        simMode={simMode}
        simFixType={simFixType}
        onToggleSim={handleToggleSim}
        onSimModeChange={handleSimModeChange}
        onSimFixTypeChange={handleSimFixTypeChange}
        onResetData={handleResetData}
        onOpenExport={() => setIsExportOpen(true)}
        rxPacketCount={rxPacketCount}
        isRxActive={isRxActive}
      />

      {/* Serial Diagnostic Warning Banner */}
      {sourceType === 'serial' && !getSerialDiagnostic().ok && (
        <div className="bg-red-950/80 border-b border-red-800 px-4 py-2 text-xs flex items-center justify-between font-mono text-red-300">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{getSerialDiagnostic().reason}</span>
          </div>
          <button
            onClick={() => setIsSerialModalOpen(true)}
            className="underline text-cyber-line text-[11px] shrink-0 ml-3 hover:text-white"
          >
            查看解決方案 &gt;
          </button>
        </div>
      )}

      {/* 2. Top Telemetry Status Bar */}
      <TelemetryBar
        gpsRaw={gpsRaw}
        globalPos={globalPos}
        gpsRtk={gpsRtk}
        usedSatsCount={usedSatsCount}
      />

      {/* 3. Main Dashboard Workspace */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-2 p-2 min-h-0 overflow-hidden">
        {/* Left Column: 2D Leaflet Map (5 cols) */}
        <div className="lg:col-span-5 h-full flex flex-col min-h-0">
          <MapView points={points} currentPoint={currentPoint} />
        </div>

        {/* Center Column: Skyplot & SNR (3 cols) */}
        <div className="lg:col-span-3 h-full flex flex-col min-h-0">
          <SkyplotChart satellites={satellites} />
        </div>

        {/* Right Column: CEP Measurement (4 cols) */}
        <div className="lg:col-span-4 h-full flex flex-col min-h-0">
          <CepChart
            points={points}
            cepStats={cepStats}
            onResetCep={handleResetCep}
            manualRefCoord={manualRefCoord}
            onSetManualRef={setManualRefCoord}
          />
        </div>
      </div>

      {/* 4. Bottom Message Inspector Bar */}
      <div className="h-44 shrink-0 border-t border-cyber-border px-2 pb-2">
        <MessageInspector latestPackets={latestPackets} statusLogs={statusLogs} />
      </div>

      {/* 5. Export Dialog */}
      <ExportModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        points={points}
      />

      {/* 6. Serial / COM Port Management Dialog */}
      <SerialPortModal
        isOpen={isSerialModalOpen}
        onClose={() => setIsSerialModalOpen(false)}
        pairedPorts={pairedPorts}
        selectedPort={selectedPort}
        onSelectPort={setSelectedPort}
        onRequestNewPort={handleRequestNewPort}
        onRefreshPorts={refreshPairedPorts}
        serialBaud={serialBaud}
        setSerialBaud={setSerialBaud}
        isConnected={serialConnected}
        onConnect={handleSerialConnect}
        onDisconnect={handleSerialDisconnect}
      />

      {/* 7. Message Stream Rate Configuration Dialog */}
      <MessageRateModal
        isOpen={isRateModalOpen}
        onClose={() => setIsRateModalOpen(false)}
        rates={measuredRates}
        onSetRate={handleSetMessageInterval}
        onRequestOnce={handleRequestOnce}
        onBatchSetRates={handleBatchSetRates}
        isConnected={serialConnected}
      />
    </div>
  );
};
