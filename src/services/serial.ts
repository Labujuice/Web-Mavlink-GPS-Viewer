// Web Serial API Driver for MAVLink GPS Stream with Port Scanning & Identification

export interface SerialPortItem {
  id: string;
  port: any;
  displayName: string;
  usbVendorId?: number;
  usbProductId?: number;
}

// Device naming helper for common Flight Controller / GNSS UART adapters
function identifyUsbDevice(vid?: number, pid?: number): string {
  if (!vid) return 'Serial Port (Standard UART)';

  const vidHex = vid.toString(16).padStart(4, '0').toUpperCase();
  const pidHex = pid ? pid.toString(16).padStart(4, '0').toUpperCase() : '----';

  switch (vid) {
    case 0x0483:
      return `STMicro (Pixhawk / STM32 VCP) [${vidHex}:${pidHex}]`;
    case 0x26ac:
      return `3DR / Cube Autopilot [${vidHex}:${pidHex}]`;
    case 0x10c4:
      return `Silicon Labs CP210x UART [${vidHex}:${pidHex}]`;
    case 0x0403:
      return `FTDI USB-to-Serial [${vidHex}:${pidHex}]`;
    case 0x1a86:
      return `CH340/CH341 Serial [${vidHex}:${pidHex}]`;
    case 0x1546:
      return `u-blox GNSS Receiver [${vidHex}:${pidHex}]`;
    case 0x2e3c:
      return `Holybro Flight Controller [${vidHex}:${pidHex}]`;
    case 0x2341:
      return `Arduino / MCU Serial [${vidHex}:${pidHex}]`;
    default:
      return `USB Serial Device [${vidHex}:${pidHex}]`;
  }
}

export class WebSerialService {
  private activePort: any = null;
  private reader: any = null;
  private isReading: boolean = false;
  private onDataCallback: (chunk: Uint8Array) => void;
  private onErrorCallback?: (err: Error) => void;
  private onDisconnectCallback?: () => void;

  constructor(
    onData: (chunk: Uint8Array) => void,
    onError?: (err: Error) => void,
    onDisconnect?: () => void
  ) {
    this.onDataCallback = onData;
    this.onErrorCallback = onError;
    this.onDisconnectCallback = onDisconnect;
  }

  public static isSupported(): boolean {
    return typeof navigator !== 'undefined' && 'serial' in navigator;
  }

  public isConnected(): boolean {
    return this.activePort !== null && this.isReading;
  }

  /**
   * List all previously paired/authorized serial ports
   */
  public async getPairedPorts(): Promise<SerialPortItem[]> {
    if (!WebSerialService.isSupported()) return [];

    try {
      const ports = await (navigator as any).serial.getPorts();
      return ports.map((port: any, index: number) => {
        const info = port.getInfo ? port.getInfo() : {};
        const vid = info.usbVendorId;
        const pid = info.usbProductId;
        return {
          id: `port_${index}_${vid || 0}_${pid || 0}`,
          port,
          displayName: identifyUsbDevice(vid, pid),
          usbVendorId: vid,
          usbProductId: pid,
        };
      });
    } catch {
      return [];
    }
  }

  /**
   * Request user to pick a serial port from OS device list (e.g. /dev/ttyUSB0, COM3)
   */
  public async requestNewPort(): Promise<SerialPortItem | null> {
    if (!WebSerialService.isSupported()) {
      throw new Error('Web Serial API 在此瀏覽器不被支援，請使用 Chrome 或 Edge 瀏覽器。');
    }

    try {
      const port = await (navigator as any).serial.requestPort();
      const info = port.getInfo ? port.getInfo() : {};
      const vid = info.usbVendorId;
      const pid = info.usbProductId;
      return {
        id: `port_new_${vid || 0}_${pid || 0}`,
        port,
        displayName: identifyUsbDevice(vid, pid),
        usbVendorId: vid,
        usbProductId: pid,
      };
    } catch (err: any) {
      if (err.name !== 'NotFoundError') {
        if (this.onErrorCallback) this.onErrorCallback(err);
      }
      return null;
    }
  }

  /**
   * Connect to a specific port instance
   */
  public async connect(portInstance: any, baudRate: number = 115200): Promise<boolean> {
    if (!portInstance) {
      throw new Error('請先選擇有效的 Serial Port / COM 埠。');
    }

    try {
      this.activePort = portInstance;
      await this.activePort.open({ baudRate, bufferSize: 8192 });

      this.isReading = true;
      this.startReading();
      return true;
    } catch (err: any) {
      this.disconnect();
      if (this.onErrorCallback) this.onErrorCallback(err);
      return false;
    }
  }

  private async startReading(): Promise<void> {
    while (this.activePort && this.activePort.readable && this.isReading) {
      try {
        this.reader = this.activePort.readable.getReader();
        while (this.isReading) {
          const { value, done } = await this.reader.read();
          if (done) {
            break;
          }
          if (value && value.length > 0) {
            this.onDataCallback(value);
          }
        }
      } catch (err: any) {
        if (this.isReading && this.onErrorCallback) {
          this.onErrorCallback(err);
        }
      } finally {
        if (this.reader) {
          try {
            this.reader.releaseLock();
          } catch {}
          this.reader = null;
        }
      }
    }

    if (this.onDisconnectCallback) {
      this.onDisconnectCallback();
    }
  }

  public async disconnect(): Promise<void> {
    this.isReading = false;
    if (this.reader) {
      try {
        await this.reader.cancel();
      } catch {}
      this.reader = null;
    }

    if (this.activePort) {
      try {
        await this.activePort.close();
      } catch {}
      this.activePort = null;
    }

    if (this.onDisconnectCallback) {
      this.onDisconnectCallback();
    }
  }
}
