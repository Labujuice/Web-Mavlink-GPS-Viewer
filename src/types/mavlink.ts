// MAVLink GPS Message Types & Telemetry Models

export enum GpsFixType {
  NO_GPS = 0,
  NO_FIX = 1,
  FIX_2D = 2,
  FIX_3D = 3,
  DGPS = 4,
  RTK_FLOAT = 5,
  RTK_FIXED = 6,
  STATIC = 7,
  PPP = 8,
}

export interface GpsRawIntMsg {
  time_usec: number;
  fix_type: GpsFixType;
  lat: number; // degE7
  lon: number; // degE7
  alt: number; // mm (MSL)
  eph: number; // HDOP * 100
  epv: number; // VDOP * 100
  vel: number; // cm/s
  cog: number; // cdeg
  satellites_visible: number;
  alt_ellipsoid?: number; // mm
  h_acc?: number; // mm
  v_acc?: number; // mm
  vel_acc?: number; // mm
  hdg_acc?: number; // degE5
  yaw?: number; // cdeg
}

export interface GpsStatusMsg {
  satellites_visible: number;
  satellite_prn: number[]; // up to 20
  satellite_used: number[]; // 0 or 1
  satellite_elevation: number[]; // deg (0-90)
  satellite_azimuth: number[]; // deg (0-255 mapped to 0-360)
  satellite_snr: number[]; // dB
}

export interface GlobalPositionIntMsg {
  time_boot_ms: number;
  lat: number; // degE7
  lon: number; // degE7
  alt: number; // mm
  relative_alt: number; // mm
  vx: number; // cm/s
  vy: number; // cm/s
  vz: number; // cm/s
  hdg: number; // cdeg
}

export interface GpsRtkMsg {
  time_last_baseline_ms: number;
  rtk_receiver_id: number;
  wn: number;
  tow: number;
  rtk_health: number;
  rtk_rate: number;
  nsats: number;
  baseline_a_mm: number;
  baseline_b_mm: number;
  baseline_c_mm: number;
  accuracy: number;
  iar_num_hypotheses: number;
}

export interface GpsInputMsg {
  time_usec: number;
  gps_id: number;
  ignore_flags: number;
  time_week_ms: number;
  time_week: number;
  fix_type: number;
  lat: number;
  lon: number;
  alt: number;
  hdop: number;
  vdop: number;
  vn: number;
  ve: number;
  vd: number;
  speed_accuracy: number;
  horiz_accuracy: number;
  vert_accuracy: number;
  satellites_visible: number;
  yaw: number;
}

export interface StatusTextMsg {
  severity: number;
  text: string;
  id?: number;
  chunk_seq?: number;
}

export enum MavResult {
  ACCEPTED = 0,
  TEMPORARILY_REJECTED = 1,
  DENIED = 2,
  UNSUPPORTED = 3,
  FAILED = 4,
  IN_PROGRESS = 5,
  CANCELLED = 6,
}

export interface CommandAckMsg {
  command: number;
  result: MavResult;
  resultText: string;
  progress?: number;
  result_param2?: number;
  target_system?: number;
  target_component?: number;
}

export interface DecodedMavPacket {
  msgId: number;
  msgName: string;
  sysId: number;
  compId: number;
  seq: number;
  timestamp: number;
  payload: Record<string, any>;
  rawBytes?: Uint8Array;
}

export interface SatelliteInfo {
  prn: number;
  used: boolean;
  elevation: number; // 0 to 90 deg
  azimuth: number;   // 0 to 360 deg
  snr: number;       // dB-Hz (0 to 99)
}

export interface TrajectoryPoint {
  lat: number;
  lon: number;
  alt: number;
  timestamp: number;
  heading?: number;
  fixType?: GpsFixType;
  sats?: number;
  speed?: number;
}

export interface EnuPoint {
  x: number; // East in meters
  y: number; // North in meters
  r: number; // Radial error in meters sqrt(x^2 + y^2)
  timestamp: number;
}

export interface CepStats {
  count: number;
  refLat: number;
  refLon: number;
  cep50: number; // 50% radius in meters
  r95: number;   // 95% radius in meters
  drms2: number; // 2DRMS in meters
  maxError: number;
  stdX: number;
  stdY: number;
}
