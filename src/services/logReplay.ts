// Log Replay Service for .tlog and binary MAVLink streams

export class LogReplayService {
  private fileBuffer: Uint8Array | null = null;
  private timer: any = null;
  private isPlaying: boolean = false;
  private offset: number = 0;
  private playbackSpeed: number = 1.0;
  private onDataCallback: (chunk: Uint8Array) => void;
  private onProgressCallback?: (progress: number, currentOffset: number, total: number) => void;
  private onFinishedCallback?: () => void;

  constructor(
    onData: (chunk: Uint8Array) => void,
    onProgress?: (progress: number, currentOffset: number, total: number) => void,
    onFinished?: () => void
  ) {
    this.onDataCallback = onData;
    this.onProgressCallback = onProgress;
    this.onFinishedCallback = onFinished;
  }

  public loadFile(buffer: ArrayBuffer): void {
    this.pause();
    this.fileBuffer = new Uint8Array(buffer);
    this.offset = 0;
    if (this.onProgressCallback) {
      this.onProgressCallback(0, 0, this.fileBuffer.length);
    }
  }

  public play(): void {
    if (!this.fileBuffer || this.isPlaying) return;
    this.isPlaying = true;

    const CHUNK_SIZE = 256;
    const intervalMs = Math.max(10, Math.floor(50 / this.playbackSpeed));

    this.timer = setInterval(() => {
      if (!this.fileBuffer || !this.isPlaying) return;

      if (this.offset >= this.fileBuffer.length) {
        this.pause();
        if (this.onFinishedCallback) this.onFinishedCallback();
        return;
      }

      const nextOffset = Math.min(this.offset + CHUNK_SIZE, this.fileBuffer.length);
      const chunk = this.fileBuffer.slice(this.offset, nextOffset);
      this.offset = nextOffset;

      this.onDataCallback(chunk);

      if (this.onProgressCallback) {
        const prog = (this.offset / this.fileBuffer.length) * 100;
        this.onProgressCallback(prog, this.offset, this.fileBuffer.length);
      }
    }, intervalMs);
  }

  public pause(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.isPlaying = false;
  }

  public seek(percentage: number): void {
    if (!this.fileBuffer) return;
    const targetOffset = Math.floor((percentage / 100) * this.fileBuffer.length);
    this.offset = Math.min(Math.max(0, targetOffset), this.fileBuffer.length);
    if (this.onProgressCallback) {
      this.onProgressCallback(percentage, this.offset, this.fileBuffer.length);
    }
  }

  public setSpeed(speed: number): void {
    this.playbackSpeed = speed;
    if (this.isPlaying) {
      this.pause();
      this.play();
    }
  }

  public getIsPlaying(): boolean {
    return this.isPlaying;
  }

  public hasFile(): boolean {
    return this.fileBuffer !== null;
  }
}
