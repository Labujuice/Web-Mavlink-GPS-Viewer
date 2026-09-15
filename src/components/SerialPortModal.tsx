import React, { useState, useEffect } from 'react';
import { SerialPortItem, WebSerialService } from '../services/serial';
import { X, Cpu, RefreshCw, Plus, Check, AlertCircle, Usb } from 'lucide-react';

interface SerialPortModalProps {
  isOpen: boolean;
  onClose: () => void;
  pairedPorts: SerialPortItem[];
  selectedPort: SerialPortItem | null;
  onSelectPort: (port: SerialPortItem) => void;
  onRequestNewPort: () => Promise<void>;
  onRefreshPorts: () => Promise<void>;
  serialBaud: number;
  setSerialBaud: (baud: number) => void;
  isConnected: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
}

export const SerialPortModal: React.FC<SerialPortModalProps> = ({
  isOpen,
  onClose,
  pairedPorts,
  selectedPort,
  onSelectPort,
  onRequestNewPort,
  onRefreshPorts,
  serialBaud,
  setSerialBaud,
  isConnected,
  onConnect,
  onDisconnect,
}) => {
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const isSupported = WebSerialService.isSupported();
  const baudRates = [9600, 19200, 38400, 57600, 115200, 230400, 460800, 921600];

  useEffect(() => {
    if (isOpen) {
      onRefreshPorts();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleScan = async () => {
    setIsScanning(true);
    await onRefreshPorts();
    setIsScanning(false);
  };

  return (
    <div className="fixed inset-0 z-[2000] bg-black/80 flex items-center justify-center p-4">
      <div className="bg-cyber-black border border-cyber-line corner-box w-full max-w-lg p-5 font-mono text-cyber-text shadow-[0_0_25px_rgba(0,255,102,0.25)]">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-cyber-border pb-3 mb-4">
          <div className="text-sm font-bold text-cyber-line tracking-wider flex items-center gap-2">
            <Usb className="w-4 h-4 text-cyber-line" />
            SERIAL / COM PORT 連線介面管理
          </div>
          <button onClick={onClose} className="text-cyber-muted hover:text-cyber-line">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Compatibility Check */}
        {!isSupported ? (
          <div className="mb-4 border border-red-800 bg-red-950/30 p-3 text-xs text-red-400 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold">瀏覽器不支援 Web Serial API</div>
              <div className="text-[11px] text-red-300 mt-1">
                當前瀏覽器不具備原生串口存取權限。請在 <strong>Google Chrome</strong>、<strong>Microsoft Edge</strong> 或 <strong>Opera/Brave</strong>（在 Linux、Windows 或 macOS）中開啟本頁面，並確保處於 <code>localhost</code> 或 <code>https://</code> 安全連線環境。
              </div>
            </div>
          </div>
        ) : (
          <div className="mb-4 border border-cyber-border/60 bg-cyber-dark/60 p-2.5 text-[11px] text-cyber-muted">
            ℹ️ <strong>Web Serial 通訊機制</strong>：點擊「新增 / 瀏覽本機 COM 埠」，瀏覽器將呼叫系統原生選單，直接存取本機 <code>/dev/ttyUSB*</code>、<code>/dev/ttyACM*</code> 或 Windows <code>COM1~COM32</code>。
          </div>
        )}

        {/* Port Selection Section */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-cyber-line uppercase tracking-wide">
              已配對 / 授權之 COM 埠 ({pairedPorts.length})
            </span>
            <div className="flex gap-2">
              <button
                onClick={handleScan}
                disabled={isScanning}
                className="px-2 py-0.5 text-[10px] border border-cyber-border hover:border-cyber-line text-cyber-muted hover:text-cyber-line flex items-center gap-1 transition-colors"
                title="重新整理已配對串口"
              >
                <RefreshCw className={`w-3 h-3 ${isScanning ? 'animate-spin' : ''}`} />
                重新整理
              </button>
              <button
                onClick={onRequestNewPort}
                className="px-2 py-0.5 text-[10px] border border-cyber-line bg-cyber-line/10 hover:bg-cyber-line/20 text-cyber-line font-bold flex items-center gap-1 transition-colors"
                title="開啟系統裝置選擇器"
              >
                <Plus className="w-3 h-3" />
                新增 / 瀏覽本機 COM 埠
              </button>
            </div>
          </div>

          {/* Port List */}
          <div className="border border-cyber-border bg-black/50 max-h-48 overflow-y-auto space-y-1 p-1">
            {pairedPorts.length === 0 ? (
              <div className="text-center py-6 text-xs text-cyber-dim">
                <div>尚未授權任何 COM 埠</div>
                <button
                  onClick={onRequestNewPort}
                  className="mt-2 text-[11px] underline text-cyber-line hover:text-white"
                >
                  點擊此處瀏覽並新增本機串口 (/dev/ttyUSB*, COMx)
                </button>
              </div>
            ) : (
              pairedPorts.map((p) => {
                const isSelected = selectedPort?.id === p.id;
                return (
                  <div
                    key={p.id}
                    onClick={() => !isConnected && onSelectPort(p)}
                    className={`p-2 border text-xs flex items-center justify-between cursor-pointer transition-colors ${
                      isSelected
                        ? 'border-cyber-line bg-cyber-line/20 text-cyber-line font-bold'
                        : 'border-cyber-border/40 hover:border-cyber-border text-cyber-muted hover:text-cyber-line bg-cyber-dark/40'
                    } ${isConnected ? 'cursor-not-allowed opacity-80' : ''}`}
                  >
                    <div className="flex items-center gap-2">
                      <Cpu className="w-4 h-4 text-cyber-line shrink-0" />
                      <div>
                        <div>{p.displayName}</div>
                        <div className="text-[10px] text-cyber-dim">
                          VID: 0x{p.usbVendorId?.toString(16).padStart(4, '0') || '----'} | PID: 0x{p.usbProductId?.toString(16).padStart(4, '0') || '----'}
                        </div>
                      </div>
                    </div>
                    {isSelected && (
                      <span className="flex items-center gap-1 text-[10px] text-cyber-line border border-cyber-line px-1.5 py-0.5">
                        <Check className="w-3 h-3" /> 已選擇
                      </span>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Connection Parameters */}
        <div className="grid grid-cols-2 gap-3 mb-5 border-t border-cyber-border pt-4">
          <div>
            <label className="text-[10px] text-cyber-muted block mb-1 font-bold uppercase">
              傳輸鮑率 (BAUD RATE)
            </label>
            <select
              value={serialBaud}
              onChange={(e) => setSerialBaud(Number(e.target.value))}
              disabled={isConnected}
              className="w-full bg-black text-cyber-line border border-cyber-border px-2.5 py-1.5 text-xs focus:outline-none focus:border-cyber-line cursor-pointer"
            >
              {baudRates.map((b) => (
                <option key={b} value={b}>
                  {b} bps {b === 115200 ? '(標準預設)' : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[10px] text-cyber-muted block mb-1 font-bold uppercase">
              資料位元 / 同位檢查
            </label>
            <div className="text-xs text-cyber-dim border border-cyber-border/60 px-2.5 py-1.5 bg-black/40">
              8 Data Bits, No Parity, 1 Stop Bit (8-N-1)
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center justify-between border-t border-cyber-border pt-4">
          <div className="text-[11px] text-cyber-muted">
            狀態: {isConnected ? (
              <span className="text-cyber-line font-bold">已連線</span>
            ) : (
              <span className="text-cyber-dim">未連線</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 border border-cyber-border hover:border-cyber-line text-cyber-muted hover:text-cyber-line text-xs transition-colors"
            >
              關閉視窗
            </button>

            {isConnected ? (
              <button
                onClick={() => {
                  onDisconnect();
                  onClose();
                }}
                className="px-4 py-1.5 border border-red-800 bg-red-950/40 text-red-400 hover:bg-red-900/60 text-xs font-bold transition-colors"
              >
                中斷連線 (DISCONNECT)
              </button>
            ) : (
              <button
                onClick={() => {
                  onConnect();
                  onClose();
                }}
                disabled={!selectedPort && pairedPorts.length === 0}
                className="px-4 py-1.5 border border-cyber-line bg-cyber-line/20 hover:bg-cyber-line/30 text-cyber-line text-xs font-bold transition-colors disabled:opacity-40"
              >
                立即連線 (CONNECT)
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
