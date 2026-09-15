import React, { useState } from 'react';
import { DecodedMavPacket } from '../types/mavlink';
import { ListTree, Terminal, ChevronRight, ChevronDown, Minimize2, Maximize2, Square } from 'lucide-react';
import { Splitter } from './Splitter';

interface MessageInspectorProps {
  latestPackets: Record<number, DecodedMavPacket>;
  statusLogs: { timestamp: number; text: string; severity: number }[];
  isCollapsed?: boolean;
  onSetHeightPreset?: (preset: 'min' | 'default' | 'max') => void;
}

export const MessageInspector: React.FC<MessageInspectorProps> = ({
  latestPackets,
  statusLogs,
  isCollapsed = false,
  onSetHeightPreset,
}) => {
  const [activeTab, setActiveTab] = useState<'inspector' | 'logs'>('inspector');
  const [selectedMsgId, setSelectedMsgId] = useState<number>(24);
  const [expandedFields, setExpandedFields] = useState<Record<string, boolean>>({});

  const [sidebarWidth, setSidebarWidth] = useState<number>(() => {
    const saved = localStorage.getItem('mav_inspector_sidebar_w');
    return saved ? Number(saved) : 220;
  });

  const handleSidebarDrag = (delta: number) => {
    setSidebarWidth((prev) => {
      const next = Math.max(140, Math.min(500, prev + delta));
      localStorage.setItem('mav_inspector_sidebar_w', String(next));
      return next;
    });
  };

  const toggleField = (key: string) => {
    setExpandedFields((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const currentPacket = latestPackets[selectedMsgId];

  // Helper to format values with units & engineering meaning
  const formatFieldValue = (key: string, val: any, msgId: number): { raw: string; engineering: string } => {
    if (val === undefined || val === null) return { raw: 'null', engineering: '-' };

    if (Array.isArray(val)) {
      return { raw: `[${val.length} items]`, engineering: JSON.stringify(val.slice(0, 10)) + (val.length > 10 ? '...' : '') };
    }

    if (typeof val === 'object') {
      return { raw: '{Object}', engineering: JSON.stringify(val) };
    }

    const num = Number(val);
    if (isNaN(num)) return { raw: String(val), engineering: String(val) };

    // GPS_RAW_INT & GPS2_RAW
    if (msgId === 24 || msgId === 124) {
      if (key === 'lat' || key === 'lon') {
        return { raw: `${num}`, engineering: `${(num / 1e7).toFixed(7)}°` };
      }
      if (key === 'alt' || key === 'alt_ellipsoid') {
        return { raw: `${num}`, engineering: `${(num / 1000).toFixed(3)} m` };
      }
      if (key === 'eph') {
        return { raw: `${num}`, engineering: `HDOP ${(num / 100).toFixed(2)}` };
      }
      if (key === 'epv') {
        return { raw: `${num}`, engineering: `VDOP ${(num / 100).toFixed(2)}` };
      }
      if (key === 'vel') {
        return { raw: `${num} cm/s`, engineering: `${(num / 100).toFixed(2)} m/s (${((num / 100) * 3.6).toFixed(1)} km/h)` };
      }
      if (key === 'cog' || key === 'yaw') {
        return { raw: `${num} cdeg`, engineering: `${(num / 100).toFixed(2)}°` };
      }
      if (key === 'h_acc' || key === 'v_acc' || key === 'vel_acc') {
        return { raw: `${num} mm`, engineering: `${(num / 1000).toFixed(3)} m` };
      }
      if (key === 'fix_type') {
        const fixNames = ['NO_GPS', 'NO_FIX', '2D_FIX', '3D_FIX', 'DGPS', 'RTK_FLOAT', 'RTK_FIXED', 'STATIC', 'PPP'];
        return { raw: `${num}`, engineering: `${fixNames[num] || 'UNKNOWN'} (${num})` };
      }
    }

    // GLOBAL_POSITION_INT
    if (msgId === 33) {
      if (key === 'lat' || key === 'lon') {
        return { raw: `${num}`, engineering: `${(num / 1e7).toFixed(7)}°` };
      }
      if (key === 'alt' || key === 'relative_alt') {
        return { raw: `${num}`, engineering: `${(num / 1000).toFixed(3)} m` };
      }
      if (key === 'vx' || key === 'vy' || key === 'vz') {
        return { raw: `${num} cm/s`, engineering: `${(num / 100).toFixed(2)} m/s` };
      }
      if (key === 'hdg') {
        return { raw: `${num} cdeg`, engineering: `${(num / 100).toFixed(2)}°` };
      }
    }

    // GPS_RTK
    if (msgId === 127 || msgId === 128) {
      if (key === 'baseline_a_mm' || key === 'baseline_b_mm' || key === 'baseline_c_mm') {
        return { raw: `${num} mm`, engineering: `${(num / 1000).toFixed(3)} m` };
      }
      if (key === 'accuracy') {
        return { raw: `${num}`, engineering: `${num} mm` };
      }
    }

    return { raw: String(val), engineering: String(val) };
  };

  const knownMessages = [
    { id: 24, name: 'GPS_RAW_INT' },
    { id: 25, name: 'GPS_STATUS' },
    { id: 33, name: 'GLOBAL_POSITION_INT' },
    { id: 124, name: 'GPS2_RAW' },
    { id: 127, name: 'GPS_RTK' },
    { id: 128, name: 'GPS2_RTK' },
    { id: 232, name: 'GPS_INPUT' },
    { id: 113, name: 'HIL_GPS' },
    { id: 253, name: 'STATUSTEXT' },
  ];

  return (
    <div className="flex flex-col h-full bg-cyber-black border border-cyber-border corner-box overflow-hidden">
      {/* Top Switcher Bar */}
      <div className="flex items-center justify-between border-b border-cyber-border bg-cyber-dark px-3 py-1.5 select-none">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('inspector')}
            className={`flex items-center gap-1.5 px-2 py-0.5 text-xs font-mono border transition-colors ${
              activeTab === 'inspector'
                ? 'border-cyber-line text-cyber-line bg-cyber-line/10'
                : 'border-transparent text-cyber-muted hover:text-cyber-line'
            }`}
          >
            <ListTree className="w-3.5 h-3.5" />
            GPS MESSAGE INSPECTOR
          </button>

          <button
            onClick={() => setActiveTab('logs')}
            className={`flex items-center gap-1.5 px-2 py-0.5 text-xs font-mono border transition-colors ${
              activeTab === 'logs'
                ? 'border-cyber-line text-cyber-line bg-cyber-line/10'
                : 'border-transparent text-cyber-muted hover:text-cyber-line'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            STATUS LOGS ({statusLogs.length})
          </button>
        </div>

        <div className="flex items-center gap-3">
          {activeTab === 'inspector' && currentPacket && (
            <div className="text-[10px] text-cyber-muted font-mono hidden sm:block">
              SYS: {currentPacket.sysId} | COMP: {currentPacket.compId} | SEQ: {currentPacket.seq} |
              TIME: {new Date(currentPacket.timestamp).toLocaleTimeString()}
            </div>
          )}

          {onSetHeightPreset && (
            <div className="flex items-center gap-1 border-l border-cyber-border/80 pl-2">
              <button
                onClick={() => onSetHeightPreset('min')}
                className={`p-1 border text-[10px] transition-colors ${
                  isCollapsed
                    ? 'border-cyber-line text-cyber-line bg-cyber-line/20'
                    : 'border-cyber-border text-cyber-muted hover:text-cyber-line hover:border-cyber-line'
                }`}
                title="最小化收起 (底欄高度 38px)"
              >
                <Minimize2 className="w-3 h-3" />
              </button>
              <button
                onClick={() => onSetHeightPreset('default')}
                className="p-1 border border-cyber-border text-cyber-muted hover:text-cyber-line hover:border-cyber-line text-[10px] transition-colors"
                title="標準高度 (240px)"
              >
                <Square className="w-3 h-3" />
              </button>
              <button
                onClick={() => onSetHeightPreset('max')}
                className="p-1 border border-cyber-border text-cyber-muted hover:text-cyber-line hover:border-cyber-line text-[10px] transition-colors"
                title="最大化高度 (460px)"
              >
                <Maximize2 className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Tab 1: GPS Messages Field Inspector */}
      {activeTab === 'inspector' && (
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden font-mono min-h-0">
          {/* Left Message Type List */}
          <div
            style={{ width: `${sidebarWidth}px` }}
            className="w-full md:w-auto border-r border-cyber-border bg-black/50 overflow-y-auto shrink-0"
          >
            <div className="p-1.5 text-[10px] text-cyber-muted uppercase border-b border-cyber-border flex justify-between items-center">
              <span>SELECT GPS MSG</span>
              <span className="text-[9px] text-cyber-dim">可拉動寬度</span>
            </div>
            {knownMessages.map((m) => {
              const pkt = latestPackets[m.id];
              const isSelected = selectedMsgId === m.id;
              return (
                <button
                  key={m.id}
                  onClick={() => setSelectedMsgId(m.id)}
                  className={`w-full px-2.5 py-1.5 text-left text-xs border-b border-cyber-border flex items-center justify-between transition-colors ${
                    isSelected
                      ? 'bg-cyber-line/20 text-cyber-line border-l-2 border-l-cyber-line'
                      : 'text-cyber-muted hover:bg-cyber-dark hover:text-cyber-line'
                  }`}
                >
                  <div className="truncate">
                    <span className="text-cyber-dim mr-1">#{m.id}</span>
                    <span>{m.name}</span>
                  </div>
                  {pkt ? (
                    <span className="w-2 h-2 rounded-full bg-cyber-line animate-pulse" title="Active" />
                  ) : (
                    <span className="w-2 h-2 rounded-full bg-neutral-800" title="No Data" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Resizable Divider between Left List and Right Table */}
          <div className="hidden md:block shrink-0 h-full">
            <Splitter
              direction="vertical"
              onDrag={handleSidebarDrag}
              onDoubleClick={() => {
                setSidebarWidth(220);
                localStorage.setItem('mav_inspector_sidebar_w', '220');
              }}
              title="拖曳調整訊息清單與資料表格寬度，雙擊重設"
            />
          </div>

          {/* Right Field Inspector Table */}
          <div className="flex-1 overflow-y-auto p-2">
            {currentPacket ? (
              <div className="border border-cyber-border">
                <div className="bg-cyber-dark px-3 py-1.5 border-b border-cyber-border flex items-center justify-between text-xs text-cyber-line">
                  <span className="font-bold">
                    #{currentPacket.msgId} {currentPacket.msgName}
                  </span>
                  <span className="text-[10px] text-cyber-muted">
                    {Object.keys(currentPacket.payload).length} FIELDS EXPANDED
                  </span>
                </div>

                <table className="w-full text-left text-xs border-collapse font-mono">
                  <thead>
                    <tr className="border-b border-cyber-border bg-black/70 text-cyber-muted text-[10px]">
                      <th className="p-2 w-1/4">FIELD NAME</th>
                      <th className="p-2 w-1/4">RAW VALUE</th>
                      <th className="p-2 w-1/2">ENGINEERING VALUE / DECODED</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(currentPacket.payload).map(([fieldKey, rawVal]) => {
                      const { raw, engineering } = formatFieldValue(fieldKey, rawVal, currentPacket.msgId);
                      const isArr = Array.isArray(rawVal);

                      return (
                        <React.Fragment key={fieldKey}>
                          <tr className="border-b border-cyber-border/50 hover:bg-cyber-dark/60 transition-colors">
                            <td className="p-2 text-cyber-muted font-bold flex items-center gap-1">
                              {isArr && (
                                <button
                                  onClick={() => toggleField(fieldKey)}
                                  className="text-cyber-line hover:text-white"
                                >
                                  {expandedFields[fieldKey] ? (
                                    <ChevronDown className="w-3 h-3" />
                                  ) : (
                                    <ChevronRight className="w-3 h-3" />
                                  )}
                                </button>
                              )}
                              <span>{fieldKey}</span>
                            </td>
                            <td className="p-2 text-cyber-dim truncate max-w-[150px]">{raw}</td>
                            <td className="p-2 text-cyber-line font-medium break-all">{engineering}</td>
                          </tr>

                          {/* Nested Array View */}
                          {isArr && expandedFields[fieldKey] && (
                            <tr className="bg-black/90 border-b border-cyber-border">
                              <td colSpan={3} className="p-2 pl-6">
                                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-1.5 text-[11px]">
                                  {(rawVal as number[]).map((v, i) => (
                                    <div
                                      key={i}
                                      className="border border-cyber-border/40 p-1 flex justify-between bg-cyber-dark/40"
                                    >
                                      <span className="text-cyber-muted">[{i}]:</span>
                                      <span className="text-cyber-line font-bold">{v}</span>
                                    </div>
                                  ))}
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-cyber-dim text-xs py-8">
                <span>NO PACKET DATA RECEIVED YET FOR #{selectedMsgId}</span>
                <span className="text-[10px] mt-1 text-neutral-600">
                  CONNECT SERIAL, REPLAY LOG OR START SIMULATOR TO POPULATE
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Autopilot Status Logs */}
      {activeTab === 'logs' && (
        <div className="flex-1 overflow-y-auto p-2 font-mono text-xs space-y-1 bg-black/70">
          {statusLogs.length === 0 ? (
            <div className="text-cyber-dim text-center py-6">NO STATUSTEXT LOGS RECORDED</div>
          ) : (
            statusLogs.map((log, idx) => (
              <div
                key={idx}
                className="flex items-start gap-2 border-b border-cyber-border/30 pb-1 text-[11px]"
              >
                <span className="text-cyber-muted shrink-0">
                  [{new Date(log.timestamp).toLocaleTimeString()}]
                </span>
                <span
                  className={`px-1 py-0.2 text-[9px] border uppercase shrink-0 ${
                    log.severity <= 3
                      ? 'border-red-500 text-red-400 bg-red-950/20'
                      : log.severity <= 4
                      ? 'border-amber-400 text-amber-400 bg-amber-950/20'
                      : 'border-cyber-line text-cyber-line bg-cyber-line/10'
                  }`}
                >
                  SEV:{log.severity}
                </span>
                <span className="text-cyber-line break-all">{log.text}</span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};
