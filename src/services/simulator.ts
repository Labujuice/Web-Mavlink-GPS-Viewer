import { DecodedMavPacket, GpsFixType } from '../types/mavlink';

export type SimulatorMode = 'stationary' | 'orbit';

export class GpsSimulator {
  private timer: any = null;
  private running: boolean = false;
  private onPacketCallback: (packet: DecodedMavPacket) => void;

  // Base coordinates (e.g. Taipei 101 area)
  private baseLat = 25.033964;
  private baseLon = 121.564468;
  private baseAlt = 35.0; // meters

  private currentLat = this.baseLat;
  private currentLon = this.baseLon;
  private currentAlt = this.baseAlt;
  private angle = 0;
  private seq = 0;

  public mode: SimulatorMode = 'stationary';
  public fixType: GpsFixType = GpsFixType.RTK_FIXED;

  constructor(onPacket: (packet: DecodedMavPacket) => void) {
    this.onPacketCallback = onPacket;
  }

  public isRunning(): boolean {
    return this.running;
  }

  public start(): void {
    if (this.running) return;
    this.running = true;
    this.seq = 0;
    this.angle = 0;

    let tickCount = 0;
    this.timer = setInterval(() => {
      tickCount++;
      this.stepSimulation(tickCount);
    }, 200); // 5Hz update rate
  }

  public stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.running = false;
  }

  private stepSimulation(tick: number): void {
    const now = Date.now();

    // Movement calculation
    if (this.mode === 'orbit') {
      this.angle += 0.05;
      const radius = 0.0008; // ~80 meters radius
      this.currentLat = this.baseLat + Math.sin(this.angle) * radius;
      this.currentLon = this.baseLon + Math.cos(this.angle) * radius * 1.1;
      this.currentAlt = this.baseAlt + Math.sin(this.angle * 2) * 5;
    } else {
      // Stationary with realistic GNSS multipath/atmospheric noise (for CEP analysis)
      const noiseRadius = this.fixType === GpsFixType.RTK_FIXED ? 0.0000002 : 0.000002; // ~2cm for RTK, ~20cm for 3D
      const noiseLat = (Math.random() - 0.5) * noiseRadius;
      const noiseLon = (Math.random() - 0.5) * noiseRadius;
      this.currentLat = this.baseLat + noiseLat;
      this.currentLon = this.baseLon + noiseLon;
      this.currentAlt = this.baseAlt + (Math.random() - 0.5) * 0.1;
    }

    // 1. Emit GPS_RAW_INT (#24) at 5Hz
    const eph = this.fixType === GpsFixType.RTK_FIXED ? 65 : 120; // HDOP 0.65 or 1.2
    const epv = this.fixType === GpsFixType.RTK_FIXED ? 80 : 150;
    const groundSpeed = this.mode === 'orbit' ? 450 : Math.floor(Math.random() * 5); // cm/s
    const cog = Math.round((((this.angle + Math.PI / 2) * 180) / Math.PI) * 100) % 36000;

    const rawIntPayload = {
      time_usec: now * 1000,
      fix_type: this.fixType,
      lat: Math.round(this.currentLat * 1e7),
      lon: Math.round(this.currentLon * 1e7),
      alt: Math.round(this.currentAlt * 1e3),
      eph,
      epv,
      vel: groundSpeed,
      cog,
      satellites_visible: 18,
      alt_ellipsoid: Math.round((this.currentAlt - 15) * 1e3),
      h_acc: this.fixType === GpsFixType.RTK_FIXED ? 18 : 1200,
      v_acc: this.fixType === GpsFixType.RTK_FIXED ? 28 : 2100,
      vel_acc: 50,
      hdg_acc: 10000,
      yaw: cog,
    };

    this.onPacketCallback({
      msgId: 24,
      msgName: 'GPS_RAW_INT',
      sysId: 1,
      compId: 1,
      seq: this.seq++ % 256,
      timestamp: now,
      payload: rawIntPayload,
    });

    // 2. Emit GLOBAL_POSITION_INT (#33) at 5Hz
    this.onPacketCallback({
      msgId: 33,
      msgName: 'GLOBAL_POSITION_INT',
      sysId: 1,
      compId: 1,
      seq: this.seq++ % 256,
      timestamp: now,
      payload: {
        time_boot_ms: tick * 200,
        lat: Math.round(this.currentLat * 1e7),
        lon: Math.round(this.currentLon * 1e7),
        alt: Math.round(this.currentAlt * 1e3),
        relative_alt: Math.round((this.currentAlt - this.baseAlt) * 1e3),
        vx: Math.round(Math.cos(this.angle) * 300),
        vy: Math.round(Math.sin(this.angle) * 300),
        vz: 0,
        hdg: Math.round((cog / 100) % 360),
      },
    });

    // 3. Emit GPS_STATUS (#25) at 1Hz (every 5 ticks)
    if (tick % 5 === 0) {
      const prns = [3, 4, 7, 8, 9, 14, 16, 21, 22, 27, 28, 30, 31, 120, 129, 134, 136, 140, 0, 0];
      const used = [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 1, 1, 0, 0, 0, 0, 0];
      const elevations = [72, 65, 54, 48, 42, 38, 32, 28, 25, 20, 18, 15, 12, 10, 8, 5, 4, 3, 0, 0];
      const azimuths = [45, 110, 180, 240, 310, 15, 80, 135, 195, 270, 340, 50, 125, 210, 290, 20, 95, 160, 0, 0];
      const snrs = prns.map((_, i) => (elevations[i] > 0 ? Math.round(25 + (elevations[i] / 90) * 22 + (Math.random() - 0.5) * 4) : 0));

      this.onPacketCallback({
        msgId: 25,
        msgName: 'GPS_STATUS',
        sysId: 1,
        compId: 1,
        seq: this.seq++ % 256,
        timestamp: now,
        payload: {
          satellites_visible: 18,
          satellite_prn: prns,
          satellite_used: used,
          satellite_elevation: elevations,
          satellite_azimuth: azimuths,
          satellite_snr: snrs,
        },
      });
    }

    // 4. Emit GPS_RTK (#127) at 1Hz if in RTK mode
    if (tick % 5 === 0 && (this.fixType === GpsFixType.RTK_FIXED || this.fixType === GpsFixType.RTK_FLOAT)) {
      this.onPacketCallback({
        msgId: 127,
        msgName: 'GPS_RTK',
        sysId: 1,
        compId: 1,
        seq: this.seq++ % 256,
        timestamp: now,
        payload: {
          time_last_baseline_ms: tick * 200,
          rtk_receiver_id: 1,
          wn: 2280,
          tow: 345600,
          rtk_health: 1,
          rtk_rate: 5,
          nsats: 16,
          baseline_a_mm: 12450,
          baseline_b_mm: -8230,
          baseline_c_mm: 4120,
          accuracy: this.fixType === GpsFixType.RTK_FIXED ? 14 : 350,
          iar_num_hypotheses: 1,
        },
      });
    }
  }
}
