import React from 'react';
import { TrajectoryPoint } from '../types/mavlink';
import { exportToCsv, exportToGeoJson, exportToKml, triggerDownload } from '../utils/geo';
import { X, FileSpreadsheet, Globe, MapPin } from 'lucide-react';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  points: TrajectoryPoint[];
}

export const ExportModal: React.FC<ExportModalProps> = ({ isOpen, onClose, points }) => {
  if (!isOpen) return null;

  const timestampStr = new Date().toISOString().replace(/[:.]/g, '-');

  const handleExportCsv = () => {
    const csv = exportToCsv(points);
    triggerDownload(csv, `mav_gps_track_${timestampStr}.csv`, 'text/csv');
    onClose();
  };

  const handleExportGeoJson = () => {
    const geojson = exportToGeoJson(points);
    triggerDownload(geojson, `mav_gps_track_${timestampStr}.geojson`, 'application/geo+json');
    onClose();
  };

  const handleExportKml = () => {
    const kml = exportToKml(points);
    triggerDownload(kml, `mav_gps_track_${timestampStr}.kml`, 'application/vnd.google-earth.kml+xml');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[2000] bg-black/80 flex items-center justify-center p-4">
      <div className="bg-cyber-black border border-cyber-line corner-box w-full max-w-md p-5 text-mono text-cyber-text shadow-[0_0_20px_rgba(0,255,102,0.2)]">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-cyber-border pb-3 mb-4">
          <div className="text-sm font-bold text-cyber-line tracking-wider flex items-center gap-2">
            EXPORT FLIGHT TRAJECTORY
          </div>
          <button onClick={onClose} className="text-cyber-muted hover:text-cyber-line">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Info */}
        <div className="text-xs text-cyber-muted mb-4 border border-cyber-border/60 p-2.5 bg-cyber-dark/60">
          <div>TOTAL RECORDED POINTS: <span className="text-cyber-line font-bold">{points.length}</span></div>
          {points.length > 0 && (
            <div className="text-[11px] text-cyber-dim mt-1">
              From: {new Date(points[0].timestamp).toLocaleTimeString()} to {new Date(points[points.length - 1].timestamp).toLocaleTimeString()}
            </div>
          )}
        </div>

        {/* Export Options */}
        <div className="space-y-2.5 mb-5">
          <button
            onClick={handleExportCsv}
            disabled={points.length === 0}
            className="w-full border border-cyber-border hover:border-cyber-line p-3 flex items-center justify-between text-xs bg-cyber-dark hover:bg-cyber-line/10 transition-colors disabled:opacity-40"
          >
            <div className="flex items-center gap-2.5">
              <FileSpreadsheet className="w-4 h-4 text-cyber-line" />
              <div className="text-left">
                <div className="font-bold text-cyber-line">CSV SPREADSHEET (.csv)</div>
                <div className="text-[10px] text-cyber-dim">Raw GNSS coordinates, DOP, fix types & speed</div>
              </div>
            </div>
            <span className="text-[10px] text-cyber-muted font-bold">EXPORT</span>
          </button>

          <button
            onClick={handleExportGeoJson}
            disabled={points.length === 0}
            className="w-full border border-cyber-border hover:border-cyber-line p-3 flex items-center justify-between text-xs bg-cyber-dark hover:bg-cyber-line/10 transition-colors disabled:opacity-40"
          >
            <div className="flex items-center gap-2.5">
              <Globe className="w-4 h-4 text-cyber-line" />
              <div className="text-left">
                <div className="font-bold text-cyber-line">GeoJSON (.geojson)</div>
                <div className="text-[10px] text-cyber-dim">Standard GIS vector format (QGIS, Mapbox)</div>
              </div>
            </div>
            <span className="text-[10px] text-cyber-muted font-bold">EXPORT</span>
          </button>

          <button
            onClick={handleExportKml}
            disabled={points.length === 0}
            className="w-full border border-cyber-border hover:border-cyber-line p-3 flex items-center justify-between text-xs bg-cyber-dark hover:bg-cyber-line/10 transition-colors disabled:opacity-40"
          >
            <div className="flex items-center gap-2.5">
              <MapPin className="w-4 h-4 text-cyber-line" />
              <div className="text-left">
                <div className="font-bold text-cyber-line">Google Earth KML (.kml)</div>
                <div className="text-[10px] text-cyber-dim">3D flight path for Google Earth visualization</div>
              </div>
            </div>
            <span className="text-[10px] text-cyber-muted font-bold">EXPORT</span>
          </button>
        </div>

        {/* Close Button */}
        <div className="flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 border border-cyber-border hover:border-cyber-line text-cyber-muted hover:text-cyber-line text-xs transition-colors"
          >
            CLOSE
          </button>
        </div>
      </div>
    </div>
  );
};
