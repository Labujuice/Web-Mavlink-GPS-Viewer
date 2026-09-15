import { crcCalculate, MAVLINK_MESSAGE_CRCS } from './crc';
import {
  decodeGpsRawInt,
  decodeGpsStatus,
  decodeGlobalPositionInt,
  decodeGpsRtk,
  decodeStatusText,
  decodeCommandAck,
} from './messages';
import { DecodedMavPacket } from '../types/mavlink';

enum ParserState {
  IDLE,
  GOT_STX,
  GOT_LEN,
  GOT_HEADER,
  GOT_PAYLOAD,
}

export class MavlinkDecoder {
  private buffer: number[] = [];
  private state: ParserState = ParserState.IDLE;
  private isV2: boolean = false;
  private payloadLen: number = 0;
  private seq: number = 0;
  private sysId: number = 0;
  private compId: number = 0;
  private msgId: number = 0;
  private payload: number[] = [];
  private headerBytes: number[] = [];

  public onPacket?: (packet: DecodedMavPacket) => void;

  public feed(chunk: Uint8Array): void {
    for (let i = 0; i < chunk.length; i++) {
      this.parseByte(chunk[i]);
    }
  }

  private parseByte(byte: number): void {
    switch (this.state) {
      case ParserState.IDLE:
        if (byte === 0xfd) {
          // MAVLink v2
          this.isV2 = true;
          this.state = ParserState.GOT_STX;
          this.headerBytes = [byte];
        } else if (byte === 0xfe) {
          // MAVLink v1
          this.isV2 = false;
          this.state = ParserState.GOT_STX;
          this.headerBytes = [byte];
        }
        break;

      case ParserState.GOT_STX:
        this.payloadLen = byte;
        this.headerBytes.push(byte);
        this.buffer = [];
        this.state = ParserState.GOT_LEN;
        break;

      case ParserState.GOT_LEN:
        this.headerBytes.push(byte);
        if (this.isV2) {
          // MAVLink v2 header is 10 bytes: STX, LEN, INC_FLAGS, CMP_FLAGS, SEQ, SYSID, COMPID, MSGID (3 bytes)
          if (this.headerBytes.length === 10) {
            this.seq = this.headerBytes[4];
            this.sysId = this.headerBytes[5];
            this.compId = this.headerBytes[6];
            this.msgId = this.headerBytes[7] | (this.headerBytes[8] << 8) | (this.headerBytes[9] << 16);
            this.payload = [];
            this.state = this.payloadLen > 0 ? ParserState.GOT_HEADER : ParserState.GOT_PAYLOAD;
          }
        } else {
          // MAVLink v1 header is 6 bytes: STX, LEN, SEQ, SYSID, COMPID, MSGID (1 byte)
          if (this.headerBytes.length === 6) {
            this.seq = this.headerBytes[2];
            this.sysId = this.headerBytes[3];
            this.compId = this.headerBytes[4];
            this.msgId = this.headerBytes[5];
            this.payload = [];
            this.state = this.payloadLen > 0 ? ParserState.GOT_HEADER : ParserState.GOT_PAYLOAD;
          }
        }
        break;

      case ParserState.GOT_HEADER:
        this.payload.push(byte);
        if (this.payload.length >= this.payloadLen) {
          this.state = ParserState.GOT_PAYLOAD;
          this.buffer = [];
        }
        break;

      case ParserState.GOT_PAYLOAD:
        this.buffer.push(byte);
        if (this.buffer.length === 2) {
          // Checksum arrived (2 bytes: low, high)
          const receivedCrc = this.buffer[0] | (this.buffer[1] << 8);
          this.verifyAndDispatch(receivedCrc);
          this.reset();
        }
        break;
    }
  }

  private reset(): void {
    this.state = ParserState.IDLE;
    this.buffer = [];
    this.headerBytes = [];
    this.payload = [];
  }

  private verifyAndDispatch(receivedCrc: number): void {
    // Check CRC
    const msgMeta = MAVLINK_MESSAGE_CRCS[this.msgId];
    const crcExtra = msgMeta ? msgMeta.crc : 0;

    // CRC is computed over header (excluding STX) + payload + CRC_EXTRA
    const dataForCrc = new Uint8Array(this.headerBytes.length - 1 + this.payload.length);
    for (let i = 1; i < this.headerBytes.length; i++) {
      dataForCrc[i - 1] = this.headerBytes[i];
    }
    const offset = this.headerBytes.length - 1;
    for (let i = 0; i < this.payload.length; i++) {
      dataForCrc[offset + i] = this.payload[i];
    }

    const computedCrc = crcCalculate(dataForCrc, crcExtra);
    const isValidCrc = computedCrc === receivedCrc;
    if (msgMeta && !isValidCrc) {
      // Ignore corrupted known packets
      return;
    }

    // We process even if unknown message, but for known GPS messages we unpack
    const payloadBytes = new Uint8Array(this.payload);
    let decodedPayload: Record<string, any> = {};
    const msgName = msgMeta ? msgMeta.name : `MSG_${this.msgId}`;

    switch (this.msgId) {
      case 24: // GPS_RAW_INT
      case 124: // GPS2_RAW
        decodedPayload = decodeGpsRawInt(payloadBytes);
        break;
      case 25: // GPS_STATUS
        decodedPayload = decodeGpsStatus(payloadBytes);
        break;
      case 33: // GLOBAL_POSITION_INT
        decodedPayload = decodeGlobalPositionInt(payloadBytes);
        break;
      case 127: // GPS_RTK
      case 128: // GPS2_RTK
        decodedPayload = decodeGpsRtk(payloadBytes);
        break;
      case 253: // STATUSTEXT
        decodedPayload = decodeStatusText(payloadBytes);
        break;
      case 77: // COMMAND_ACK
        decodedPayload = decodeCommandAck(payloadBytes);
        break;
      default:
        // Raw bytes payload
        decodedPayload = { rawLen: payloadBytes.length };
        break;
    }

    if (this.onPacket) {
      this.onPacket({
        msgId: this.msgId,
        msgName,
        sysId: this.sysId,
        compId: this.compId,
        seq: this.seq,
        timestamp: Date.now(),
        payload: decodedPayload,
        rawBytes: payloadBytes,
      });
    }
  }
}
