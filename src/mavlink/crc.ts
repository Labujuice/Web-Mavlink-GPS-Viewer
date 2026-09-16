// MAVLink CRC-16 (X.25) Implementation & CRC_EXTRA Definitions

export function crcAccumulate(byte: number, crc: number): number {
  let tmp = byte ^ (crc & 0xff);
  tmp ^= (tmp << 4) & 0xff;
  crc = (crc >> 8) ^ (tmp << 8) ^ (tmp << 3) ^ (tmp >> 4);
  return crc & 0xffff;
}

export function crcInit(): number {
  return 0xffff;
}

export function crcCalculate(bytes: Uint8Array, crcExtra: number = 0): number {
  let crc = crcInit();
  for (let i = 0; i < bytes.length; i++) {
    crc = crcAccumulate(bytes[i], crc);
  }
  if (crcExtra !== 0) {
    crc = crcAccumulate(crcExtra, crc);
  }
  return crc;
}

// Standard MAVLink CRC_EXTRA seeds for GPS & relevant messages
export const MAVLINK_MESSAGE_CRCS: Record<number, { name: string; crc: number; minLength: number }> = {
  0:   { name: 'HEARTBEAT', crc: 50, minLength: 9 },
  24:  { name: 'GPS_RAW_INT', crc: 24, minLength: 30 },
  25:  { name: 'GPS_STATUS', crc: 23, minLength: 101 },
  33:  { name: 'GLOBAL_POSITION_INT', crc: 104, minLength: 28 },
  66:  { name: 'REQUEST_DATA_STREAM', crc: 148, minLength: 6 },
  76:  { name: 'COMMAND_LONG', crc: 152, minLength: 33 },
  77:  { name: 'COMMAND_ACK', crc: 143, minLength: 3 },
  113: { name: 'HIL_GPS', crc: 124, minLength: 36 },
  124: { name: 'GPS2_RAW', crc: 87, minLength: 35 },
  127: { name: 'GPS_RTK', crc: 25, minLength: 35 },
  128: { name: 'GPS2_RTK', crc: 226, minLength: 35 },
  232: { name: 'GPS_INPUT', crc: 151, minLength: 63 },
  253: { name: 'STATUSTEXT', crc: 83, minLength: 51 },
};
