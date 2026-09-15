import React, { useState } from 'react';
import { X, Send, Sliders, Zap, CheckCircle, Clock } from 'lucide-react';

export interface MessageRateItem {
  msgId: number;
  name: string;
  description: string;
  defaultHz: number;
  currentActualHz: number;
}

interface MessageRateModalProps {
  isOpen: boolean;
  onClose: () => void;
  rates: Record<number, number>; // actual measured incoming Hz
  onSetRate: (msgId: number, hz: number, targetSys: number, targetComp: number) => Promise<boolean>;
  onRequestOnce: (msgId: number, targetSys: number, targetComp: number) => Promise<boolean>;
  onBatchSetRates: (configs: { msgId: number; hz: number }[]) => Promise<void>;
  isConnected: boolean;
}

export const MessageRateModal: React.FC<MessageRateModalProps> = ({
  isOpen,
  onClose,
  rates,
  onSetRate,
  onRequestOnce,
  onBatchSetRates,
  isConnected,
}) => {
  const [targetSys, setTargetSys] = useState<number>(1);
  const [targetComp, setTargetComp] = useState<number>(1);
  const [desiredRates, setDesiredRates] = useState<Record<number, number>>({
    24: 5,
    25: 1,
    33: 5,
    124: 0,
    127: 1,
    128: 0,
  });

  // Custom Message ID input
  const [customMsgId, setCustomMsgId] = useState<string>('');
  const [customHz, setCustomHz] = useState<number>(5);

  // Status message
  const [actionLog, setActionLog] = useState<string | null>(null);

  if (!isOpen) return null;

  const targetGpsMessages: { msgId: number; name: string; desc: string; recHz: number }[] = [
    { msgId: 24, name: 'GPS_RAW_INT', desc: '主 GPS 經緯度、海拔、HDOP、速度與 Fix 狀態', recHz: 5 },
    { msgId: 25, name: 'GPS_STATUS', desc: '衛星天頂圖 (Skyplot)、仰角/方位角與 SNR 訊號強度', recHz: 1 },
    { msgId: 33, name: 'GLOBAL_POSITION_INT', desc: 'EKF 融合後全域導航座標與運動速度', recHz: 5 },
    { msgId: 124, name: 'GPS2_RAW', desc: '副 GPS 模組原始數據', recHz: 0 },
    { msgId: 127, name: 'GPS_RTK', desc: 'RTK 基準站資訊、基線向量與解算精度指標', recHz: 1 },
    { msgId: 128, name: 'GPS2_RTK', desc: '副 RTK 基準站與基線狀態', recHz: 0 },
  ];

  const handleSendRate = async (msgId: number, hz: number) => {
    setActionLog(`正在請求 #${msgId} 設定為 ${hz} Hz...`);
    const ok = await onSetRate(msgId, hz, targetSys, targetComp);
    if (ok) {
      setActionLog(`已送出: #${msgId} 設定為 ${hz} Hz (間隔: ${hz > 0 ? Math.round(1000000 / hz) + 'us' : '停止'})`);
    } else {
      setActionLog(`發送失敗: 請確認串口連線正常。`);
    }
  };

  const handleRequestOneShot = async (msgId: number) => {
    setActionLog(`正在請求一次性接收 #${msgId}...`);
    const ok = await onRequestOnce(msgId, targetSys, targetComp);
    if (ok) {
      setActionLog(`已送出一次性請求: #${msgId}`);
    } else {
      setActionLog(`發送失敗: 請確認串口連線正常。`);
    }
  };

  // Presets
  const applyStandardPreset = async () => {
    setActionLog('正在套用標準推薦頻率 (Raw 5Hz, Status 1Hz, RTK 1Hz)...');
    await onBatchSetRates([
      { msgId: 24, hz: 5 },
      { msgId: 25, hz: 1 },
      { msgId: 33, hz: 5 },
      { msgId: 127, hz: 1 },
    ]);
    setDesiredRates((prev) => ({ ...prev, 24: 5, 25: 1, 33: 5, 127: 1 }));
    setActionLog('標準頻率請求已全數送出！');
  };

  const applyHighRatePreset = async () => {
    setActionLog('正在套用高頻監控頻率 (Raw 10Hz, Pos 10Hz, Status 2Hz)...');
    await onBatchSetRates([
      { msgId: 24, hz: 10 },
      { msgId: 25, hz: 2 },
      { msgId: 33, hz: 10 },
      { msgId: 127, hz: 5 },
    ]);
    setDesiredRates((prev) => ({ ...prev, 24: 10, 25: 2, 33: 10, 127: 5 }));
    setActionLog('高頻監控請求已全數送出！');
  };

  const applyStopAllPreset = async () => {
    setActionLog('正在發送停用所有 GPS 串流 (0 Hz)...');
    await onBatchSetRates([
      { msgId: 24, hz: 0 },
      { msgId: 25, hz: 0 },
      { msgId: 33, hz: 0 },
      { msgId: 124, hz: 0 },
      { msgId: 127, hz: 0 },
      { msgId: 128, hz: 0 },
    ]);
    setDesiredRates({ 24: 0, 25: 0, 33: 0, 124: 0, 127: 0, 128: 0 });
    setActionLog('已送出全部停止串流指令！');
  };

  return (
    <div className="fixed inset-0 z-[2000] bg-black/80 flex items-center justify-center p-4">
      <div className="bg-cyber-black border border-cyber-line corner-box w-full max-w-2xl p-5 font-mono text-cyber-text shadow-[0_0_25px_rgba(0,255,102,0.25)] flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-cyber-border pb-3 mb-3">
          <div className="text-sm font-bold text-cyber-line tracking-wider flex items-center gap-2">
            <Sliders className="w-4 h-4 text-cyber-line" />
            MAVLINK 封包串流頻率請求控制 (SET_MESSAGE_INTERVAL)
          </div>
          <button onClick={onClose} className="text-cyber-muted hover:text-cyber-line">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Subheader & Target Sys/Comp */}
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs mb-3 border border-cyber-border/60 p-2.5 bg-cyber-dark/60">
          <div className="text-[11px] text-cyber-muted">
            透過 MAVLink 標準 <code>COMMAND_LONG (#76)</code> 向飛控請求指定頻率。
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="text-cyber-muted text-[10px]">TARGET SYS:</span>
              <input
                type="number"
                min="0"
                max="255"
                value={targetSys}
                onChange={(e) => setTargetSys(Number(e.target.value))}
                className="w-12 bg-black border border-cyber-border px-1 py-0.5 text-center text-cyber-line text-xs"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-cyber-muted text-[10px]">COMP:</span>
              <input
                type="number"
                min="0"
                max="255"
                value={targetComp}
                onChange={(e) => setTargetComp(Number(e.target.value))}
                className="w-12 bg-black border border-cyber-border px-1 py-0.5 text-center text-cyber-line text-xs"
              />
            </div>
          </div>
        </div>

        {/* Quick Batch Presets */}
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <span className="text-[10px] text-cyber-muted uppercase font-bold">快速預設：</span>
          <button
            onClick={applyStandardPreset}
            disabled={!isConnected}
            className="px-2.5 py-1 text-xs border border-cyber-line bg-cyber-line/10 hover:bg-cyber-line/20 text-cyber-line flex items-center gap-1 transition-colors disabled:opacity-40"
          >
            <Zap className="w-3 h-3" /> 標準頻率 (5Hz/1Hz)
          </button>
          <button
            onClick={applyHighRatePreset}
            disabled={!isConnected}
            className="px-2.5 py-1 text-xs border border-cyber-border hover:border-cyber-line text-cyber-muted hover:text-cyber-line flex items-center gap-1 transition-colors disabled:opacity-40"
          >
            <Zap className="w-3 h-3" /> 高速遙測 (10Hz)
          </button>
          <button
            onClick={applyStopAllPreset}
            disabled={!isConnected}
            className="px-2.5 py-1 text-xs border border-red-800 text-red-400 hover:bg-red-950/40 flex items-center gap-1 transition-colors disabled:opacity-40"
          >
            停止全部 (0Hz)
          </button>
        </div>

        {/* Message Table */}
        <div className="flex-1 overflow-y-auto border border-cyber-border mb-3 bg-black/40">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-cyber-border bg-black/80 text-cyber-muted text-[10px]">
                <th className="p-2 w-1/4">MAVLINK 訊息</th>
                <th className="p-2 w-1/6 text-center">實測接收頻率</th>
                <th className="p-2 w-1/3 text-center">目標請求頻率 (Hz)</th>
                <th className="p-2 w-1/4 text-right">執行發送</th>
              </tr>
            </thead>
            <tbody>
              {targetGpsMessages.map((m) => {
                const currentActual = rates[m.msgId] || 0;
                const targetHz = desiredRates[m.msgId] !== undefined ? desiredRates[m.msgId] : m.recHz;

                return (
                  <tr key={m.msgId} className="border-b border-cyber-border/40 hover:bg-cyber-dark/50 transition-colors">
                    <td className="p-2">
                      <div className="font-bold text-cyber-line flex items-center gap-1.5">
                        <span className="text-cyber-dim">#{m.msgId}</span>
                        <span>{m.name}</span>
                      </div>
                      <div className="text-[10px] text-cyber-muted truncate max-w-[200px]" title={m.desc}>
                        {m.desc}
                      </div>
                    </td>

                    <td className="p-2 text-center font-mono">
                      <span
                        className={`px-2 py-0.5 text-xs font-bold border ${
                          currentActual > 0
                            ? 'border-cyber-line text-cyber-line bg-cyber-line/10 animate-pulse'
                            : 'border-cyber-border/40 text-neutral-600'
                        }`}
                      >
                        {currentActual > 0 ? `${currentActual.toFixed(1)} Hz` : 'OFF'}
                      </span>
                    </td>

                    <td className="p-2 text-center">
                      <div className="flex items-center justify-center gap-1">
                        {[0, 1, 2, 5, 10, 20].map((hz) => (
                          <button
                            key={hz}
                            onClick={() => setDesiredRates((prev) => ({ ...prev, [m.msgId]: hz }))}
                            className={`px-1.5 py-0.5 text-[10px] border transition-colors ${
                              targetHz === hz
                                ? 'border-cyber-line bg-cyber-line/20 text-cyber-line font-bold'
                                : 'border-cyber-border/60 text-cyber-muted hover:border-cyber-line'
                            }`}
                          >
                            {hz === 0 ? 'OFF' : `${hz}Hz`}
                          </button>
                        ))}
                      </div>
                    </td>

                    <td className="p-2 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleRequestOneShot(m.msgId)}
                          disabled={!isConnected}
                          className="px-2 py-1 text-[10px] border border-cyber-border hover:border-cyber-line text-cyber-muted hover:text-cyber-line transition-colors disabled:opacity-40"
                          title="一次性請求單個封包"
                        >
                          單次 1x
                        </button>
                        <button
                          onClick={() => handleSendRate(m.msgId, targetHz)}
                          disabled={!isConnected}
                          className="px-2.5 py-1 text-[10px] border border-cyber-line bg-cyber-line/10 hover:bg-cyber-line/30 text-cyber-line font-bold flex items-center gap-1 transition-colors disabled:opacity-40"
                          title={`發送請求 #${m.msgId} 設為 ${targetHz} Hz`}
                        >
                          <Send className="w-2.5 h-2.5" />
                          設定
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Custom Message ID Row */}
        <div className="border border-cyber-border/70 p-2.5 bg-black/60 mb-3 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-cyber-muted text-[10px] font-bold">自訂 MSG ID:</span>
            <input
              type="number"
              placeholder="e.g. 30 (ATTITUDE)"
              value={customMsgId}
              onChange={(e) => setCustomMsgId(e.target.value)}
              className="w-36 bg-black border border-cyber-border px-2 py-1 text-xs text-cyber-line focus:outline-none focus:border-cyber-line"
            />
            <span className="text-cyber-muted text-[10px] font-bold ml-2">頻率 (Hz):</span>
            <input
              type="number"
              min="0"
              max="50"
              value={customHz}
              onChange={(e) => setCustomHz(Number(e.target.value))}
              className="w-16 bg-black border border-cyber-border px-2 py-1 text-xs text-center text-cyber-line focus:outline-none focus:border-cyber-line"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => {
                const id = Number(customMsgId);
                if (id > 0) handleRequestOneShot(id);
              }}
              disabled={!isConnected || !customMsgId}
              className="px-2.5 py-1 text-xs border border-cyber-border hover:border-cyber-line text-cyber-muted hover:text-cyber-line disabled:opacity-40"
            >
              單次 1x
            </button>
            <button
              onClick={() => {
                const id = Number(customMsgId);
                if (id > 0) handleSendRate(id, customHz);
              }}
              disabled={!isConnected || !customMsgId}
              className="px-3 py-1 text-xs border border-cyber-line bg-cyber-line/10 hover:bg-cyber-line/20 text-cyber-line font-bold flex items-center gap-1 disabled:opacity-40"
            >
              <Send className="w-3 h-3" />
              發送請求
            </button>
          </div>
        </div>

        {/* Action Status Log */}
        {actionLog && (
          <div className="p-2 border border-cyber-border bg-black/80 text-[11px] text-cyber-line flex items-center gap-2 mb-3">
            <CheckCircle className="w-3.5 h-3.5 text-cyber-line shrink-0" />
            <span className="truncate">{actionLog}</span>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-cyber-border pt-3">
          <div className="text-[11px] text-cyber-muted flex items-center gap-1">
            <Clock className="w-3 h-3 text-cyber-dim" />
            連線狀態: {isConnected ? <span className="text-cyber-line font-bold">已連線 (可發送)</span> : <span className="text-red-400 font-bold">未連線</span>}
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 border border-cyber-border hover:border-cyber-line text-cyber-muted hover:text-cyber-line text-xs transition-colors"
          >
            關閉視窗
          </button>
        </div>
      </div>
    </div>
  );
};
