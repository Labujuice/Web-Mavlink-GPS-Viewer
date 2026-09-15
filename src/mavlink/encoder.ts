// MAVLink Message Packet Encoder (v1 format for broad autopilot compatibility)
import { crcCalculate, MAVLINK_MESSAGE_CRCS } from './crc';

/**
 * Encode a MAVLink v1 packet
 */
export function encodeMavlinkV1Packet(
  msgId: number,
  payload: Uint8Array,
  seq: number = 0,
  sysId: number = 255, // Standard GCS System ID
  compId: number = 190 // Standard GCS Component ID
): Uint8Array {
  const meta = MAVLINK_MESSAGE_CRCS[msgId];
  const crcExtra = meta ? meta.crc : 0;

  const len = payload.length;
  // Header: STX (1), LEN (1), SEQ (1), SYSID (1), COMPID (1), MSGID (1) = 6 bytes
  const packet = new Uint8Array(6 + len + 2);

  packet[0] = 0xfe; // MAVLink v1 STX
  packet[1] = len;
  packet[2] = seq & 0xff;
  packet[3] = sysId & 0xff;
  packet[4] = compId & 0xff;
  packet[5] = msgId & 0xff;

  // Copy payload
  packet.set(payload, 6);

  // Calculate CRC over header (without STX) + payload + crcExtra
  const crcData = new Uint8Array(5 + len);
  crcData.set(packet.subarray(1, 6), 0);
  crcData.set(payload, 5);

  const crc = crcCalculate(crcData, crcExtra);

  // Append CRC (little-endian)
  packet[6 + len] = crc & 0xff;
  packet[6 + len + 1] = (crc >> 8) & 0xff;

  return packet;
}

/**
 * Encode COMMAND_LONG (#76)
 * Payload layout:
 * - param1: float (offset 0)
 * - param2: float (offset 4)
 * - param3: float (offset 8)
 * - param4: float (offset 12)
 * - param5: float (offset 16)
 * - param6: float (offset 20)
 * - param7: float (offset 24)
 * - command: uint16 (offset 28)
 * - target_system: uint8 (offset 30)
 * - target_component: uint8 (offset 31)
 * - confirmation: uint8 (offset 32)
 * Total: 33 bytes
 */
export function encodeCommandLong(
  command: number,
  params: number[], // param1 to param7
  seq: number = 0,
  targetSys: number = 1,
  targetComp: number = 1
): Uint8Array {
  const payload = new Uint8Array(33);
  const view = new DataView(payload.buffer);

  for (let i = 0; i < 7; i++) {
    view.setFloat32(i * 4, params[i] || 0, true);
  }

  view.setUint16(28, command, true);
  view.setUint8(30, targetSys);
  view.setUint8(31, targetComp);
  view.setUint8(32, 0); // confirmation

  return encodeMavlinkV1Packet(76, payload, seq);
}

/**
 * Encode MAV_CMD_SET_MESSAGE_INTERVAL (#511)
 * Param 1: Message ID
 * Param 2: Interval in microseconds (-1 to disable, 1000000/hz for active)
 */
export function encodeSetMessageInterval(
  msgId: number,
  hz: number,
  seq: number = 0,
  targetSys: number = 1,
  targetComp: number = 1
): Uint8Array {
  const intervalUs = hz <= 0 ? -1.0 : Math.round(1000000.0 / hz);
  const params = [msgId, intervalUs, 0, 0, 0, 0, 0];
  return encodeCommandLong(511, params, seq, targetSys, targetComp);
}

/**
 * Encode MAV_CMD_REQUEST_MESSAGE (#512) for one-shot requests
 * Param 1: Message ID
 */
export function encodeRequestMessage(
  msgId: number,
  seq: number = 0,
  targetSys: number = 1,
  targetComp: number = 1
): Uint8Array {
  const params = [msgId, 0, 0, 0, 0, 0, 0];
  return encodeCommandLong(512, params, seq, targetSys, targetComp);
}

/**
 * Encode GCS HEARTBEAT (#0)
 * Sends standard 1Hz Ground Control Station heartbeat to keep connection alive
 */
export function encodeHeartbeat(
  seq: number = 0,
  sysId: number = 255,
  compId: number = 190
): Uint8Array {
  const payload = new Uint8Array(9);
  const view = new DataView(payload.buffer);
  view.setUint32(0, 0, true); // custom_mode
  view.setUint8(4, 6);        // type: MAV_TYPE_GCS
  view.setUint8(5, 8);        // autopilot: MAV_AUTOPILOT_INVALID
  view.setUint8(6, 0);        // base_mode
  view.setUint8(7, 4);        // system_status: MAV_STATE_ACTIVE
  view.setUint8(8, 3);        // mavlink_version
  return encodeMavlinkV1Packet(0, payload, seq, sysId, compId);
}

/**
 * Encode REQUEST_DATA_STREAM (#66) for legacy / stream-group requests
 */
export function encodeRequestDataStream(
  streamId: number,
  rateHz: number,
  startStop: number = 1,
  seq: number = 0,
  targetSys: number = 1,
  targetComp: number = 1
): Uint8Array {
  const payload = new Uint8Array(6);
  const view = new DataView(payload.buffer);
  view.setUint16(0, rateHz, true);
  view.setUint8(2, targetSys);
  view.setUint8(3, targetComp);
  view.setUint8(4, streamId);
  view.setUint8(5, startStop);
  return encodeMavlinkV1Packet(66, payload, seq);
}
