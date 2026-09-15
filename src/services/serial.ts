// Web Serial API Driver for MAVLink GPS Stream

export class WebSerialService {
  private port: any = null;
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
    return 'serial' in navigator;
  }

  public isConnected(): boolean {
    return this.port !== null && this.isReading;
  }

  public async connect(baudRate: number = 115200): Promise<boolean> {
    if (!WebSerialService.isSupported()) {
      throw new Error('Web Serial API 在此瀏覽器中不被支援，請使用 Chrome、Edge 或 Chromium 核心瀏覽器。');
    }

    try {
      // Prompt user to select serial port
      this.port = await (navigator as any).serial.requestPort();
      await this.port.open({ baudRate, bufferSize: 8192 });

      this.isReading = true;
      this.startReading();
      return true;
    } catch (err: any) {
      this.disconnect();
      if (err.name !== 'NotFoundError') {
        // NotFoundError is when user simply cancels port picker dialog
        if (this.onErrorCallback) this.onErrorCallback(err);
      }
      return false;
    }
  }

  private async startReading(): Promise<void> {
    while (this.port && this.port.readable && this.isReading) {
      try {
        this.reader = this.port.readable.getReader();
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

    if (this.port) {
      try {
        await this.port.close();
      } catch {}
      this.port = null;
    }

    if (this.onDisconnectCallback) {
      this.onDisconnectCallback();
    }
  }
}
