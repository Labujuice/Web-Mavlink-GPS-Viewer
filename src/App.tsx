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
import { Splitter } from './components/Splitter';

import { MavlinkDecoder } from './mavlink/decoder';
import { encodeSetMessageInterval, encodeRequestMessage, encodeHeartbeat } from './mavlink/encoder';
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
  CommandAckMsg,
  MavResult,
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
  const [detectedSysId, setDetectedSysId] = useState<number>(1);
  const [detectedCompId, setDetectedCompId] = useState<number>(1);
  const pendingAckWaitersRef = useRef<Record<number, (ack: CommandAckMsg) => void>>({});

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

  // Layout Resizing State
  const dashboardRef = useRef<HTMLDivElement>(null);
  const [isDesktop, setIsDesktop] = useState<boolean>(
    () => (typeof window !== 'undefined' ? window.innerWidth >= 1024 : true)
  );

  const [colWidths, setColWidths] = useState<[number, number, number]>(() => {
    try {
      const saved = localStorage.getItem('mav_col_widths');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length === 3) return parsed as [number, number, number];
      }
    } catch {}
    return [40, 28, 32];
  });

  const [inspectorHeight, setInspectorHeight] = useState<number>(() => {
    const saved = localStorage.getItem('mav_inspector_h');
    return saved ? Number(saved) : 230;
  });

  useEffect(() => {
    const handleWinResize = () => setIsDesktop(window.innerWidth >= 1024);
    window.addEventListener('resize', handleWinResize);
    return () => window.removeEventListener('resize', handleWinResize);
  }, []);

  const handleCol1Col2Drag = (deltaPx: number) => {
    if (!dashboardRef.current) return;
    const totalW = dashboardRef.current.clientWidth;
    if (totalW <= 0) return;
    const deltaPercent = (deltaPx / totalW) * 100;

    setColWidths(([c1, c2, c3]) => {
      let newC1 = c1 + deltaPercent;
      let newC2 = c2 - deltaPercent;
      if (newC1 < 15) {
        newC2 += newC1 - 15;
        newC1 = 15;
      } else if (newC2 < 15) {
        newC1 += newC2 - 15;
        newC2 = 15;
      }
      const updated: [number, number, number] = [
        Math.round(newC1 * 10) / 10,
        Math.round(newC2 * 10) / 10,
        c3,
      ];
      localStorage.setItem('mav_col_widths', JSON.stringify(updated));
      return updated;
    });
  };

  const handleCol2Col3Drag = (deltaPx: number) => {
    if (!dashboardRef.current) return;
    const totalW = dashboardRef.current.clientWidth;
    if (totalW <= 0) return;
    const deltaPercent = (deltaPx / totalW) * 100;

    setColWidths(([c1, c2, c3]) => {
      let newC2 = c2 + deltaPercent;
      let newC3 = c3 - deltaPercent;
      if (newC2 < 15) {
        newC3 += newC2 - 15;
        newC2 = 15;
      } else if (newC3 < 15) {
        newC2 += newC3 - 15;
        newC3 = 15;
      }
      const updated: [number, number, number] = [
        c1,
        Math.round(newC2 * 10) / 10,
        Math.round(newC3 * 10) / 10,
      ];
      localStorage.setItem('mav_col_widths', JSON.stringify(updated));
      return updated;
    });
  };

  const handleResetCols = () => {
    const def: [number, number, number] = [40, 28, 32];
    setColWidths(def);
    localStorage.setItem('mav_col_widths', JSON.stringify(def));
  };

  const handleInspectorDrag = (deltaY: number) => {
    setInspectorHeight((prev) => {
      const maxH = Math.round(window.innerHeight * 0.75);
      const next = Math.max(38, Math.min(maxH, prev - deltaY));
      localStorage.setItem('mav_inspector_h', String(next));
      return next;
    });
  };

  const handleSetHeightPreset = (preset: 'min' | 'default' | 'max') => {
    let next = 230;
    if (preset === 'min') next = 38;
    else if (preset === 'max') next = Math.min(520, Math.round(window.innerHeight * 0.65));
    else next = 230;
    setInspectorHeight(next);
    localStorage.setItem('mav_inspector_h', String(next));
  };

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

    // Auto-detect Target System ID & Component ID from vehicle packets
    if (packet.sysId > 0 && packet.sysId !== 255) {
      setDetectedSysId(packet.sysId);
      if (packet.compId > 0) {
        setDetectedCompId(packet.compId);
      }
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

    // 6. COMMAND_ACK (#77)
    if (packet.msgId === 77) {
      const ack = packet.payload as CommandAckMsg;
      const cmdName =
        ack.command === 511
          ? 'SET_MESSAGE_INTERVAL (#511)'
          : ack.command === 512
          ? 'REQUEST_MESSAGE (#512)'
          : `#${ack.command}`;
      const isAccepted = ack.result === MavResult.ACCEPTED;

      setStatusLogs((prev) => [
        {
          timestamp: packet.timestamp,
          text: `[RX ACK] 指令 ${cmdName} 飛控回應: ${ack.resultText} (SYS:${packet.sysId} COMP:${packet.compId})`,
          severity: isAccepted ? 6 : 3,
        },
        ...prev.slice(0, 99),
      ]);

      // Notify any pending command waiter
      if (pendingAckWaitersRef.current[ack.command]) {
        pendingAckWaitersRef.current[ack.command](ack);
        delete pendingAckWaitersRef.current[ack.command];
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

  // Periodic GCS Heartbeat broadcast (1 Hz) to notify Flight Controller that GCS is active
  useEffect(() => {
    if (!serialConnected) return;

    const heartbeatInterval = setInterval(async () => {
      try {
        if (serialServiceRef.current?.isConnected()) {
          const hbPacket = encodeHeartbeat(txSeqRef.current++, 255, 190);
          await serialServiceRef.current.send(hbPacket);
        }
      } catch {
        // Silently catch write issues if port disconnected
      }
    }, 1000);

    return () => clearInterval(heartbeatInterval);
  }, [serialConnected]);

  // Send MAV_CMD_SET_MESSAGE_INTERVAL to Autopilot
  const handleSetMessageInterval = async (
    msgId: number,
    hz: number,
    targetSys?: number,
    targetComp?: number
  ): Promise<{ ok: boolean; message?: string }> => {
    const sys = targetSys !== undefined ? targetSys : detectedSysId;
    const comp = targetComp !== undefined ? targetComp : detectedCompId;

    try {
      const packet = encodeSetMessageInterval(msgId, hz, txSeqRef.current++, sys, comp);
      if (serialServiceRef.current?.isConnected()) {
        const ackPromise = new Promise<CommandAckMsg | null>((resolve) => {
          pendingAckWaitersRef.current[511] = resolve;
          setTimeout(() => {
            if (pendingAckWaitersRef.current[511] === resolve) {
              delete pendingAckWaitersRef.current[511];
              resolve(null);
            }
          }, 1200); // Wait up to 1.2s for ACK
        });

        await serialServiceRef.current.send(packet);
        const intervalDesc = hz > 0 ? Math.round(1000000 / hz) + 'us' : 'OFF';
        setStatusLogs((prev) => [
          {
            timestamp: Date.now(),
            text: `[TX CMD] SET_MESSAGE_INTERVAL: Msg #${msgId} -> ${hz} Hz (${intervalDesc}) -> Target SYS:${sys} COMP:${comp}`,
            severity: 6,
          },
          ...prev.slice(0, 99),
        ]);

        const ack = await ackPromise;
        if (ack) {
          const isAccepted = ack.result === MavResult.ACCEPTED;
          return {
            ok: isAccepted,
            message: `飛控回傳 ACK: ${ack.resultText}`,
          };
        } else {
          return {
            ok: true,
            message: `指令已送出至 SYS:${sys} COMP:${comp} (未收到 ACK，部分飛控不會主動確認)`,
          };
        }
      } else {
        alert('串口尚未連線，無法發送 MAVLink 頻率請求。請先點擊 CONNECT 連線至飛控。');
        return { ok: false, message: '串口未連線' };
      }
    } catch (e: any) {
      alert(`發送指令失敗: ${e.message}`);
      return { ok: false, message: e.message };
    }
  };

  // Send MAV_CMD_REQUEST_MESSAGE (One-shot)
  const handleRequestOnce = async (
    msgId: number,
    targetSys?: number,
    targetComp?: number
  ): Promise<{ ok: boolean; message?: string }> => {
    const sys = targetSys !== undefined ? targetSys : detectedSysId;
    const comp = targetComp !== undefined ? targetComp : detectedCompId;

    try {
      const packet = encodeRequestMessage(msgId, txSeqRef.current++, sys, comp);
      if (serialServiceRef.current?.isConnected()) {
        const ackPromise = new Promise<CommandAckMsg | null>((resolve) => {
          pendingAckWaitersRef.current[512] = resolve;
          setTimeout(() => {
            if (pendingAckWaitersRef.current[512] === resolve) {
              delete pendingAckWaitersRef.current[512];
              resolve(null);
            }
          }, 1200);
        });

        await serialServiceRef.current.send(packet);
        setStatusLogs((prev) => [
          {
            timestamp: Date.now(),
            text: `[TX CMD] REQUEST_MESSAGE: Msg #${msgId} (One-shot) -> Target SYS:${sys} COMP:${comp}`,
            severity: 6,
          },
          ...prev.slice(0, 99),
        ]);

        const ack = await ackPromise;
        if (ack) {
          const isAccepted = ack.result === MavResult.ACCEPTED;
          return {
            ok: isAccepted,
            message: `飛控回傳 ACK: ${ack.resultText}`,
          };
        } else {
          return {
            ok: true,
            message: `一次性請求已送出至 SYS:${sys} COMP:${comp}`,
          };
        }
      } else {
        alert('串口尚未連線，無法發送 MAVLink 指令。');
        return { ok: false, message: '串口未連線' };
      }
    } catch (e: any) {
      alert(`發送指令失敗: ${e.message}`);
      return { ok: false, message: e.message };
    }
  };

  // Batch Request
  const handleBatchSetRates = async (
    configs: { msgId: number; hz: number }[],
    targetSys?: number,
    targetComp?: number
  ) => {
    const sys = targetSys !== undefined ? targetSys : detectedSysId;
    const comp = targetComp !== undefined ? targetComp : detectedCompId;
    for (const cfg of configs) {
      await handleSetMessageInterval(cfg.msgId, cfg.hz, sys, comp);
      await new Promise((r) => setTimeout(r, 60)); // small delay between commands
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
      <div
        ref={dashboardRef}
        className="flex-1 flex flex-col lg:flex-row gap-0 p-2 min-h-0 overflow-hidden"
      >
        {/* Left Column: 2D Leaflet Map */}
        <div
          style={isDesktop ? { width: `calc(${colWidths[0]}% - 8px)` } : undefined}
          className="w-full lg:w-auto h-full flex flex-col min-h-0 min-w-[200px]"
        >
          <MapView points={points} currentPoint={currentPoint} />
        </div>

        {/* Resizable Divider 1 (Map vs Skyplot) */}
        <div className="hidden lg:block shrink-0 h-full">
          <Splitter
            direction="vertical"
            onDrag={handleCol1Col2Drag}
            onDoubleClick={handleResetCols}
            title="拖曳調整地圖與星空圖寬度比例，雙擊重設"
          />
        </div>

        {/* Center Column: Skyplot & SNR */}
        <div
          style={isDesktop ? { width: `calc(${colWidths[1]}% - 8px)` } : undefined}
          className="w-full lg:w-auto h-full flex flex-col min-h-0 min-w-[200px]"
        >
          <SkyplotChart satellites={satellites} />
        </div>

        {/* Resizable Divider 2 (Skyplot vs CEP) */}
        <div className="hidden lg:block shrink-0 h-full">
          <Splitter
            direction="vertical"
            onDrag={handleCol2Col3Drag}
            onDoubleClick={handleResetCols}
            title="拖曳調整星空圖與CEP寬度比例，雙擊重設"
          />
        </div>

        {/* Right Column: CEP Measurement */}
        <div
          style={isDesktop ? { width: `calc(${colWidths[2]}% - 0px)` } : undefined}
          className="w-full lg:w-auto h-full flex flex-col min-h-0 min-w-[200px]"
        >
          <CepChart
            points={points}
            cepStats={cepStats}
            onResetCep={handleResetCep}
            manualRefCoord={manualRefCoord}
            onSetManualRef={setManualRefCoord}
          />
        </div>
      </div>

      {/* Resizable Horizontal Divider between Workspace & Bottom Inspector */}
      <div className="px-2 shrink-0">
        <Splitter
          direction="horizontal"
          onDrag={handleInspectorDrag}
          onDoubleClick={() => handleSetHeightPreset('default')}
          title="拖曳調整下方訊息檢查器高度，雙擊恢復預設高度"
        />
      </div>

      {/* 4. Bottom Message Inspector Bar */}
      <div
        style={{ height: `${inspectorHeight}px` }}
        className="shrink-0 px-2 pb-2 min-h-[38px] transition-all duration-75"
      >
        <MessageInspector
          latestPackets={latestPackets}
          statusLogs={statusLogs}
          isCollapsed={inspectorHeight <= 42}
          onSetHeightPreset={handleSetHeightPreset}
        />
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
        detectedSysId={detectedSysId}
        detectedCompId={detectedCompId}
      />
    </div>
  );
};
