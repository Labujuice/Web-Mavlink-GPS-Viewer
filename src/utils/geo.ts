import { TrajectoryPoint, EnuPoint, CepStats } from '../types/mavlink';

const WGS84_A = 6378137.0; // Earth equatorial radius in meters

/**
 * Convert WGS84 (lat, lon) to Local ENU (x: East, y: North) in meters relative to (refLat, refLon)
 */
export function wgs84ToEnu(lat: number, lon: number, refLat: number, refLon: number): { x: number; y: number } {
  const dLat = ((lat - refLat) * Math.PI) / 180.0;
  const dLon = ((lon - refLon) * Math.PI) / 180.0;
  const latRad = (refLat * Math.PI) / 180.0;

  const x = dLon * WGS84_A * Math.cos(latRad);
  const y = dLat * WGS84_A;
  return { x, y };
}

/**
 * Calculate CEP statistics from points relative to reference point
 */
export function calculateCepStats(points: TrajectoryPoint[], manualRef?: { lat: number; lon: number }): CepStats {
  if (points.length === 0) {
    return {
      count: 0,
      refLat: 0,
      refLon: 0,
      cep50: 0,
      r95: 0,
      drms2: 0,
      maxError: 0,
      stdX: 0,
      stdY: 0,
    };
  }

  // Determine reference point: manual or mean of all points
  let refLat = 0;
  let refLon = 0;

  if (manualRef && manualRef.lat !== 0 && manualRef.lon !== 0) {
    refLat = manualRef.lat;
    refLon = manualRef.lon;
  } else {
    refLat = points.reduce((sum, p) => sum + p.lat, 0) / points.length;
    refLon = points.reduce((sum, p) => sum + p.lon, 0) / points.length;
  }

  const enuPoints: EnuPoint[] = [];
  let sumX = 0;
  let sumY = 0;
  let sumX2 = 0;
  let sumY2 = 0;
  let maxR = 0;

  for (const p of points) {
    const { x, y } = wgs84ToEnu(p.lat, p.lon, refLat, refLon);
    const r = Math.sqrt(x * x + y * y);
    enuPoints.push({ x, y, r, timestamp: p.timestamp });
    sumX += x;
    sumY += y;
    sumX2 += x * x;
    sumY2 += y * y;
    if (r > maxR) maxR = r;
  }

  const n = enuPoints.length;
  const meanX = sumX / n;
  const meanY = sumY / n;
  const varX = Math.max(0, sumX2 / n - meanX * meanX);
  const varY = Math.max(0, sumY2 / n - meanY * meanY);
  const stdX = Math.sqrt(varX);
  const stdY = Math.sqrt(varY);

  // 2DRMS = 2 * sqrt(sigma_x^2 + sigma_y^2)
  const drms2 = 2.0 * Math.sqrt(varX + varY);

  // Percentiles for CEP50 and R95
  const sortedRadii = enuPoints.map((p) => p.r).sort((a, b) => a - b);
  const idx50 = Math.floor(n * 0.5);
  const idx95 = Math.floor(n * 0.95);
  const cep50 = sortedRadii[Math.min(idx50, n - 1)] || 0;
  const r95 = sortedRadii[Math.min(idx95, n - 1)] || 0;

  return {
    count: n,
    refLat,
    refLon,
    cep50,
    r95,
    drms2,
    maxError: maxR,
    stdX,
    stdY,
  };
}

/**
 * Export trajectory points to CSV string
 */
export function exportToCsv(points: TrajectoryPoint[]): string {
  const header = 'Timestamp,ISO_Time,Latitude,Longitude,Altitude_m,FixType,Satellites,Speed_mps,Heading_deg\n';
  const rows = points.map((p) => {
    const iso = new Date(p.timestamp).toISOString();
    return `${p.timestamp},${iso},${p.lat.toFixed(7)},${p.lon.toFixed(7)},${p.alt.toFixed(2)},${p.fixType || 0},${p.sats || 0},${(p.speed || 0).toFixed(2)},${(p.heading || 0).toFixed(1)}`;
  });
  return header + rows.join('\n');
}

/**
 * Export trajectory points to GeoJSON string
 */
export function exportToGeoJson(points: TrajectoryPoint[]): string {
  const coordinates = points.map((p) => [p.lon, p.lat, p.alt]);
  const geojson = {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates,
        },
        properties: {
          name: 'MAVLink GPS Trajectory',
          pointCount: points.length,
          startTime: points.length > 0 ? new Date(points[0].timestamp).toISOString() : null,
          endTime: points.length > 0 ? new Date(points[points.length - 1].timestamp).toISOString() : null,
        },
      },
    ],
  };
  return JSON.stringify(geojson, null, 2);
}

/**
 * Export trajectory points to KML string
 */
export function exportToKml(points: TrajectoryPoint[]): string {
  const coordsStr = points.map((p) => `${p.lon},${p.lat},${p.alt}`).join('\n        ');
  return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>MAVLink GPS Flight Trajectory</name>
    <Style id="flightTrack">
      <LineStyle>
        <color>ff66ff00</color>
        <width>3</width>
      </LineStyle>
    </Style>
    <Placemark>
      <name>Track</name>
      <styleUrl>#flightTrack</styleUrl>
      <LineString>
        <altitudeMode>absolute</altitudeMode>
        <coordinates>
        ${coordsStr}
        </coordinates>
      </LineString>
    </Placemark>
  </Document>
</kml>`;
}

/**
 * Trigger browser file download
 */
export function triggerDownload(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
