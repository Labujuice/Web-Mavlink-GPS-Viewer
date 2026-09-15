import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { TrajectoryPoint } from '../types/mavlink';
import { Crosshair, Layers } from 'lucide-react';

interface MapViewProps {
  points: TrajectoryPoint[];
  currentPoint: TrajectoryPoint | null;
}

export const MapView: React.FC<MapViewProps> = ({ points, currentPoint }) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const trajectoryLayerRef = useRef<L.Polyline | null>(null);
  const vehicleMarkerRef = useRef<L.Marker | null>(null);

  const [followVehicle, setFollowVehicle] = useState<boolean>(true);
  const [mapType, setMapType] = useState<'dark' | 'osm' | 'satellite'>('dark');
  const tileLayerRef = useRef<L.TileLayer | null>(null);

  const tileUrls = {
    dark: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    osm: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    satellite: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
  };

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const initialLat = currentPoint ? currentPoint.lat : 25.033964;
    const initialLon = currentPoint ? currentPoint.lon : 121.564468;

    const map = L.map(mapContainerRef.current, {
      center: [initialLat, initialLon],
      zoom: 17,
      zoomControl: false,
      attributionControl: true,
    });

    tileLayerRef.current = L.tileLayer(tileUrls.dark, {
      maxZoom: 20,
      attribution: '&copy; CartoDB & OpenStreetMap',
    }).addTo(map);

    // Add green trajectory line
    trajectoryLayerRef.current = L.polyline([], {
      color: '#00ff66',
      weight: 3,
      opacity: 0.85,
    }).addTo(map);

    // Custom SVG Vehicle Heading Arrow
    const vehicleIcon = L.divIcon({
      className: 'vehicle-marker',
      html: `
        <div style="width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; transform: rotate(${currentPoint?.heading || 0}deg);">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <polygon points="12,2 22,22 12,17 2,22" fill="#00ff66" stroke="#ffffff" stroke-width="1.5" />
          </svg>
        </div>
      `,
      iconSize: [28, 28],
      iconAnchor: [14, 14],
    });

    vehicleMarkerRef.current = L.marker([initialLat, initialLon], {
      icon: vehicleIcon,
    }).addTo(map);

    mapInstanceRef.current = map;

    const resizeObserver = new ResizeObserver(() => {
      map.invalidateSize();
    });
    if (mapContainerRef.current) {
      resizeObserver.observe(mapContainerRef.current);
    }

    return () => {
      resizeObserver.disconnect();
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update Tile Layer when mapType changes
  useEffect(() => {
    if (!mapInstanceRef.current || !tileLayerRef.current) return;
    tileLayerRef.current.setUrl(tileUrls[mapType]);
  }, [mapType]);

  // Update Trajectory & Marker
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    // Update Polyline
    if (trajectoryLayerRef.current) {
      const latlngs: L.LatLngExpression[] = points.map((p) => [p.lat, p.lon]);
      trajectoryLayerRef.current.setLatLngs(latlngs);
    }

    // Update Vehicle Marker
    if (currentPoint && vehicleMarkerRef.current) {
      vehicleMarkerRef.current.setLatLng([currentPoint.lat, currentPoint.lon]);

      const heading = currentPoint.heading || 0;
      const vehicleIcon = L.divIcon({
        className: 'vehicle-marker',
        html: `
          <div style="width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; transform: rotate(${heading}deg);">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <polygon points="12,2 22,22 12,17 2,22" fill="#00ff66" stroke="#ffffff" stroke-width="1.5" />
            </svg>
          </div>
        `,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      });
      vehicleMarkerRef.current.setIcon(vehicleIcon);

      if (followVehicle) {
        mapInstanceRef.current.panTo([currentPoint.lat, currentPoint.lon], {
          animate: true,
          duration: 0.2,
        });
      }
    }
  }, [points, currentPoint, followVehicle]);

  return (
    <div className="relative w-full h-full bg-cyber-black border border-cyber-border corner-box overflow-hidden">
      {/* Map Canvas */}
      <div ref={mapContainerRef} className="w-full h-full" />

      {/* Floating HUD Map Controls */}
      <div className="absolute top-2 right-2 z-[1000] flex items-center gap-1.5 bg-black/80 border border-cyber-border p-1">
        {/* Layer Switcher */}
        <div className="flex items-center gap-1 border-r border-cyber-border pr-1">
          <Layers className="w-3 h-3 text-cyber-muted" />
          <select
            value={mapType}
            onChange={(e) => setMapType(e.target.value as any)}
            className="bg-transparent text-cyber-line text-[10px] font-mono focus:outline-none cursor-pointer"
          >
            <option value="dark" className="bg-black text-cyber-line">DARK HUD</option>
            <option value="osm" className="bg-black text-cyber-line">STREET (OSM)</option>
            <option value="satellite" className="bg-black text-cyber-line">SATELLITE</option>
          </select>
        </div>

        {/* Follow Vehicle Toggle */}
        <button
          onClick={() => {
            setFollowVehicle(!followVehicle);
            if (!followVehicle && currentPoint && mapInstanceRef.current) {
              mapInstanceRef.current.setView([currentPoint.lat, currentPoint.lon], 18);
            }
          }}
          className={`px-1.5 py-0.5 text-[10px] font-mono border flex items-center gap-1 transition-colors ${
            followVehicle
              ? 'border-cyber-line text-cyber-line bg-cyber-line/10'
              : 'border-cyber-border text-cyber-muted hover:border-cyber-line hover:text-cyber-line'
          }`}
        >
          <Crosshair className="w-3 h-3" />
          FOLLOW: {followVehicle ? 'ON' : 'OFF'}
        </button>
      </div>

      {/* Trajectory Distance / Points Badge */}
      <div className="absolute bottom-2 left-2 z-[1000] bg-black/80 border border-cyber-border px-2 py-0.5 text-[10px] font-mono text-cyber-muted">
        TRACK POINTS: <span className="text-cyber-line font-bold">{points.length}</span>
      </div>
    </div>
  );
};
