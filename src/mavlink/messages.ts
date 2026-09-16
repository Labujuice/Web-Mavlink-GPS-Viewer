import {
  GpsFixType,
  GpsRawIntMsg,
  GpsStatusMsg,
  GlobalPositionIntMsg,
  GpsRtkMsg,
  StatusTextMsg,
  CommandAckMsg,
  MavResult,
} from '../types/mavlink';

// Safe DataView helper to avoid out-of-bounds errors on truncated packets
class BufferReader {
  private view: DataView;
  private len: number;

  constructor(buffer: Uint8Array) {
    this.view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
    this.len = buffer.byteLength;
  }

  getUint8(offset: number): number {
    return offset < this.len ? this.view.getUint8(offset) : 0;
  }

  getInt8(offset: number): number {
    return offset < this.len ? this.view.getInt8(offset) : 0;
  }

  getUint16(offset: number): number {
    return offset + 2 <= this.len ? this.view.getUint16(offset, true) : 0;
  }

  getInt16(offset: number): number {
    return offset + 2 <= this.len ? this.view.getInt16(offset, true) : 0;
  }

  getUint32(offset: number): number {
    return offset + 4 <= this.len ? this.view.getUint32(offset, true) : 0;
  }

  getInt32(offset: number): number {
    return offset + 4 <= this.len ? this.view.getInt32(offset, true) : 0;
  }

  getBigUint64(offset: number): number {
    if (offset + 8 <= this.len) {
      try {
        return Number(this.view.getBigUint64(offset, true));
      } catch {
        return this.view.getUint32(offset, true);
      }
    }
    return 0;
  }

  getString(offset: number, length: number): string {
    const end = Math.min(offset + length, this.len);
    let str = '';
    for (let i = offset; i < end; i++) {
      const code = this.view.getUint8(i);
      if (code === 0) break;
      str += String.fromCharCode(code);
    }
    return str.trim();
  }
}

export function decodeGpsRawInt(payload: Uint8Array): GpsRawIntMsg {
  const r = new BufferReader(payload);
  const msg: GpsRawIntMsg = {
    time_usec: r.getBigUint64(0),
    lat: r.getInt32(8),
    lon: r.getInt32(12),
    alt: r.getInt32(16),
    eph: r.getUint16(20),
    epv: r.getUint16(22),
    vel: r.getUint16(24),
    cog: r.getUint16(26),
    fix_type: r.getUint8(28) as GpsFixType,
    satellites_visible: r.getUint8(29),
  };

  // MAVLink 2 extensions
  if (payload.length >= 34) msg.alt_ellipsoid = r.getInt32(30);
  if (payload.length >= 38) msg.h_acc = r.getUint32(34);
  if (payload.length >= 42) msg.v_acc = r.getUint32(38);
  if (payload.length >= 46) msg.vel_acc = r.getUint32(42);
  if (payload.length >= 50) msg.hdg_acc = r.getUint32(46);
  if (payload.length >= 52) msg.yaw = r.getUint16(50);

  return msg;
}

export function decodeGpsStatus(payload: Uint8Array): GpsStatusMsg {
  const r = new BufferReader(payload);
  const satsVisible = r.getUint8(0);
  const prns: number[] = [];
  const used: number[] = [];
  const elevations: number[] = [];
  const azimuths: number[] = [];
  const snrs: number[] = [];

  for (let i = 0; i < 20; i++) {
    const prn = r.getUint8(1 + i);
    prns.push(prn);
    used.push(r.getUint8(21 + i));
    elevations.push(r.getUint8(41 + i));
    // Azimuth in MAVLink is 0-255 scaled to 0-360 degrees
    const azRaw = r.getUint8(61 + i);
    azimuths.push(Math.round((azRaw * 360) / 256));
    snrs.push(r.getUint8(81 + i));
  }

  return {
    satellites_visible: satsVisible,
    satellite_prn: prns,
    satellite_used: used,
    satellite_elevation: elevations,
    satellite_azimuth: azimuths,
    satellite_snr: snrs,
  };
}

export function decodeGlobalPositionInt(payload: Uint8Array): GlobalPositionIntMsg {
  const r = new BufferReader(payload);
  return {
    time_boot_ms: r.getUint32(0),
    lat: r.getInt32(4),
    lon: r.getInt32(8),
    alt: r.getInt32(12),
    relative_alt: r.getInt32(16),
    vx: r.getInt16(20),
    vy: r.getInt16(22),
    vz: r.getInt16(24),
    hdg: r.getUint16(26),
  };
}

export function decodeGpsRtk(payload: Uint8Array): GpsRtkMsg {
  const r = new BufferReader(payload);
  return {
    time_last_baseline_ms: r.getUint32(0),
    rtk_receiver_id: r.getUint8(4),
    wn: r.getUint16(5),
    tow: r.getUint32(7),
    rtk_health: r.getUint8(11),
    rtk_rate: r.getUint8(12),
    nsats: r.getUint8(13),
    baseline_a_mm: r.getInt32(14),
    baseline_b_mm: r.getInt32(18),
    baseline_c_mm: r.getInt32(22),
    accuracy: r.getUint32(26),
    iar_num_hypotheses: r.getInt32(30),
  };
}

export function decodeStatusText(payload: Uint8Array): StatusTextMsg {
  const r = new BufferReader(payload);
  return {
    severity: r.getUint8(0),
    text: r.getString(1, 50),
    id: payload.length >= 53 ? r.getUint16(51) : undefined,
    chunk_seq: payload.length >= 54 ? r.getUint8(53) : undefined,
  };
}

const MAV_RESULT_STRINGS: Record<number, string> = {
  0: 'ACCEPTED (已接受並執行)',
  1: 'TEMPORARILY_REJECTED (暫時拒絕)',
  2: 'DENIED (已被拒絕)',
  3: 'UNSUPPORTED (不支援此指令)',
  4: 'FAILED (執行失敗)',
  5: 'IN_PROGRESS (執行中)',
  6: 'CANCELLED (已取消)',
};

export function decodeCommandAck(payload: Uint8Array): CommandAckMsg {
  const r = new BufferReader(payload);
  const command = r.getUint16(0);
  const result = r.getUint8(2) as MavResult;
  const resultText = MAV_RESULT_STRINGS[result] || `UNKNOWN (${result})`;

  const msg: CommandAckMsg = {
    command,
    result,
    resultText,
  };

  // MAVLink 2 extension fields
  if (payload.length >= 4) msg.progress = r.getUint8(3);
  if (payload.length >= 8) msg.result_param2 = r.getInt32(4);
  if (payload.length >= 9) msg.target_system = r.getUint8(8);
  if (payload.length >= 10) msg.target_component = r.getUint8(9);

  return msg;
}
