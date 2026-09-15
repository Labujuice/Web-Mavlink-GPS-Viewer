import React from 'react';
import { GpsFixType, GpsRawIntMsg, GlobalPositionIntMsg, GpsRtkMsg } from '../types/mavlink';

interface TelemetryBarProps {
  gpsRaw: GpsRawIntMsg | null;
  globalPos: GlobalPositionIntMsg | null;
  gpsRtk: GpsRtkMsg | null;
  usedSatsCount: number;
}

export const TelemetryBar: React.FC<TelemetryBarProps> = ({
  gpsRaw,
  globalPos,
  gpsRtk,
  usedSatsCount,
}) => {
  const fixType = gpsRaw ? gpsRaw.fix_type : GpsFixType.NO_GPS;

  const getFixBadge = (type: GpsFixType) => {
    switch (type) {
      case GpsFixType.RTK_FIXED:
        return { label: 'RTK FIXED', color: 'border-cyber-line text-cyber-line bg-cyber-line/10' };
      case GpsFixType.RTK_FLOAT:
        return { label: 'RTK FLOAT', color: 'border-amber-400 text-amber-400 bg-amber-950/20' };
      case GpsFixType.FIX_3D:
        return { label: '3D FIX', color: 'border-emerald-400 text-emerald-400 bg-emerald-950/20' };
      case GpsFixType.FIX_2D:
        return { label: '2D FIX', color: 'border-yellow-500 text-yellow-500 bg-yellow-950/20' };
      case GpsFixType.DGPS:
        return { label: 'DGPS', color: 'border-teal-400 text-teal-400 bg-teal-950/20' };
      default:
        return { label: 'NO FIX', color: 'border-red-500 text-red-500 bg-red-950/20' };
    }
  };

  const badge = getFixBadge(fixType);

  const lat = gpsRaw ? (gpsRaw.lat / 1e7).toFixed(7) : '---.-------';
  const lon = gpsRaw ? (gpsRaw.lon / 1e7).toFixed(7) : '---.-------';
  const altMsl = gpsRaw ? (gpsRaw.alt / 1e3).toFixed(2) : '---.--';
  const hdop = gpsRaw ? (gpsRaw.eph / 100).toFixed(2) : '--.--';
  const vdop = gpsRaw ? (gpsRaw.epv / 100).toFixed(2) : '--.--';
  const speedMps = gpsRaw ? (gpsRaw.vel / 100).toFixed(2) : '0.00';
  const speedKmh = gpsRaw ? ((gpsRaw.vel / 100) * 3.6).toFixed(1) : '0.0';
  const heading = gpsRaw ? (gpsRaw.cog / 100).toFixed(1) : (globalPos ? (globalPos.hdg / 100).toFixed(1) : '---.-');
  const hAccMm = gpsRaw && gpsRaw.h_acc ? (gpsRaw.h_acc / 1000).toFixed(3) : null;
  const satsTotal = gpsRaw ? gpsRaw.satellites_visible : 0;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 p-2 bg-cyber-black border-b border-cyber-border">
      {/* 1. GNSS FIX STATUS */}
      <div className="cyber-card p-2 corner-box flex flex-col justify-between">
        <div className="text-[10px] text-cyber-muted font-bold tracking-wider">GNSS FIX STATUS</div>
        <div className="my-1 flex items-center justify-between">
          <span className={`px-2 py-0.5 text-xs font-bold border ${badge.color} tracking-widest`}>
            {badge.label}
          </span>
          <span className="text-xs text-cyber-muted font-mono">
            {usedSatsCount}/{satsTotal} SAT
          </span>
        </div>
        <div className="text-[9px] text-cyber-dim truncate">
          {gpsRtk ? `BASE: #${gpsRtk.rtk_receiver_id} ACC:${gpsRtk.accuracy}mm` : 'STANDARD POSITIONING'}
        </div>
      </div>

      {/* 2. LATITUDE */}
      <div className="cyber-card p-2 corner-box flex flex-col justify-between">
        <div className="text-[10px] text-cyber-muted font-bold tracking-wider">LATITUDE (WGS84)</div>
        <div className="text-sm font-bold text-cyber-line text-glow font-mono my-1 tracking-tight">
          {lat}
        </div>
        <div className="text-[9px] text-cyber-dim">DEG (EPSG:4326)</div>
      </div>

      {/* 3. LONGITUDE */}
      <div className="cyber-card p-2 corner-box flex flex-col justify-between">
        <div className="text-[10px] text-cyber-muted font-bold tracking-wider">LONGITUDE (WGS84)</div>
        <div className="text-sm font-bold text-cyber-line text-glow font-mono my-1 tracking-tight">
          {lon}
        </div>
        <div className="text-[9px] text-cyber-dim">DEG (EPSG:4326)</div>
      </div>

      {/* 4. ALTITUDE */}
      <div className="cyber-card p-2 corner-box flex flex-col justify-between">
        <div className="text-[10px] text-cyber-muted font-bold tracking-wider">ALTITUDE (MSL)</div>
        <div className="text-base font-bold text-cyber-line text-glow font-mono my-0.5">
          {altMsl} <span className="text-xs font-normal text-cyber-muted">m</span>
        </div>
        <div className="text-[9px] text-cyber-dim">
          {gpsRaw?.alt_ellipsoid ? `ELLIPSOID: ${(gpsRaw.alt_ellipsoid / 1000).toFixed(1)}m` : 'MEAN SEA LEVEL'}
        </div>
      </div>

      {/* 5. HDOP & VDOP */}
      <div className="cyber-card p-2 corner-box flex flex-col justify-between">
        <div className="text-[10px] text-cyber-muted font-bold tracking-wider">DILUTION (HDOP / VDOP)</div>
        <div className="text-sm font-bold text-cyber-line font-mono my-1 flex items-baseline gap-2">
          <span>H: {hdop}</span>
          <span className="text-cyber-muted text-xs">V: {vdop}</span>
        </div>
        <div className="text-[9px] text-cyber-dim">
          {hAccMm ? `H-ACC: ${hAccMm}m` : 'DOP PRECISION'}
        </div>
      </div>

      {/* 6. GROUND SPEED */}
      <div className="cyber-card p-2 corner-box flex flex-col justify-between">
        <div className="text-[10px] text-cyber-muted font-bold tracking-wider">GROUND SPEED</div>
        <div className="text-base font-bold text-cyber-line text-glow font-mono my-0.5">
          {speedMps} <span className="text-xs font-normal text-cyber-muted">m/s</span>
        </div>
        <div className="text-[9px] text-cyber-dim">{speedKmh} km/h</div>
      </div>

      {/* 7. HEADING / COG */}
      <div className="cyber-card p-2 corner-box flex flex-col justify-between">
        <div className="text-[10px] text-cyber-muted font-bold tracking-wider">HEADING / COG</div>
        <div className="text-base font-bold text-cyber-line text-glow font-mono my-0.5">
          {heading}°
        </div>
        <div className="text-[9px] text-cyber-dim">COURSE OVER GROUND</div>
      </div>
    </div>
  );
};
