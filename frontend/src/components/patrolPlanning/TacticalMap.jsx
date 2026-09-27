import React, { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Layers, MapPin, Navigation, Radio, Compass, ShieldAlert, Eye } from 'lucide-react';

export default function TacticalMap({ route, riskZones = [], rangers = [], selectedRanger = null }) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const [layerType, setLayerType] = useState('satellite'); // 'satellite' or 'tactical'

  const checkpoints = route?.checkpoints && route.checkpoints.length > 0 ? route.checkpoints : [
    { name: 'WP-01 Alpha Depot', lat: 6.4020, lng: 81.5120, order: 1 },
    { name: 'WP-02 Fordable River Crossing', lat: 6.4150, lng: 81.5280, order: 2 },
    { name: 'WP-03 Waterhole 4 Sanctuary', lat: 6.4280, lng: 81.5450, order: 3 },
    { name: 'WP-04 Northern Ridge Outpost', lat: 6.4390, lng: 81.5600, order: 4 }
  ];

  const defaultCenter = [checkpoints[1]?.lat || 6.4150, checkpoints[1]?.lng || 81.5280];

  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Destroy existing instance if any
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    // 1. Initialize Leaflet Map centered on Yala National Park, Sri Lanka
    const map = L.map(mapContainerRef.current, {
      center: defaultCenter,
      zoom: 13,
      zoomControl: false,
      attributionControl: false
    });
    mapInstanceRef.current = map;

    // Add zoom control at bottom-right
    L.control.zoom({ position: 'bottomright' }).addTo(map);

    // 2. Base Tile Layers (Real Satellite vs Tactical Dark Topo)
    let tileLayer;
    if (layerType === 'satellite') {
      // Real Esri World Imagery (High-Resolution Satellite of Yala National Park)
      tileLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 18
      });
    } else {
      // CartoDB Dark Matter / Tactical Grid
      tileLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 18,
        subdomains: 'abcd'
      });
    }
    tileLayer.addTo(map);

    // 3. Draw Patrol Route Polyline across waypoints
    const routeCoords = checkpoints.map(wp => [wp.lat, wp.lng]);
    const routePolyline = L.polyline(routeCoords, {
      color: '#10b981',
      weight: 4,
      dashArray: '8, 8',
      opacity: 0.9
    }).addTo(map);

    // Fit map bounds to route
    map.fitBounds(routePolyline.getBounds(), { padding: [40, 40] });

    // 4. Draw Critical Threat Zone Circle (around WP-03 Waterhole)
    const threatCenter = [checkpoints[2]?.lat || 6.4280, checkpoints[2]?.lng || 81.5450];
    const threatCircle = L.circle(threatCenter, {
      color: '#ef4444',
      fillColor: '#ef4444',
      fillOpacity: 0.22,
      radius: 1200,
      weight: 2,
      dashArray: '6, 6'
    }).addTo(map);

    threatCircle.bindPopup(`
      <div style="font-family: Inter, sans-serif; color: #020806; font-size: 12px; padding: 4px;">
        <strong style="color: #dc2626;">⚠️ CRITICAL THREAT HOTSPOT</strong><br/>
        Zone: Northern River Basin Buffer<br/>
        Threat: Wire Snares & Acoustic Spikes<br/>
        Coordinates: 06°25'40"N, 81°32'42"E
      </div>
    `);

    // 5. Custom Waypoint Marker Icons
    checkpoints.forEach((wp, idx) => {
      const isThreatPoint = idx === 2;
      const markerHtml = `
        <div style="
          width: ${isThreatPoint ? 26 : 22}px;
          height: ${isThreatPoint ? 26 : 22}px;
          border-radius: 50%;
          background: ${isThreatPoint ? '#ef4444' : '#10b981'};
          border: 2px solid #ffffff;
          box-shadow: 0 0 12px ${isThreatPoint ? 'rgba(239, 68, 68, 0.8)' : 'rgba(16, 185, 129, 0.8)'};
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-weight: 800;
          font-size: 11px;
        ">
          ${wp.order || idx + 1}
        </div>
      `;

      const customIcon = L.divIcon({
        className: 'custom-wp-pin',
        html: markerHtml,
        iconSize: [26, 26],
        iconAnchor: [13, 13]
      });

      const marker = L.marker([wp.lat, wp.lng], { icon: customIcon }).addTo(map);
      marker.bindPopup(`
        <div style="font-family: Inter, sans-serif; color: #020806; font-size: 12px; padding: 4px;">
          <strong style="color: #059669;">${wp.name}</strong><br/>
          GPS: ${wp.lat.toFixed(4)}°N, ${wp.lng.toFixed(4)}°E<br/>
          Order: Checkpoint #${wp.order || idx + 1} of ${checkpoints.length}
        </div>
      `);
    });

    // 6. Draw Selected Ranger Live Location Pin (if provided)
    if (selectedRanger) {
      const rangerLat = selectedRanger.current_lat || 6.4010;
      const rangerLng = selectedRanger.current_lng || 81.5050;

      const rangerHtml = `
        <div style="
          padding: 4px 8px;
          background: #022c22;
          border: 1px solid #10b981;
          border-radius: 6px;
          color: #34d399;
          font-size: 10px;
          font-weight: 700;
          white-space: nowrap;
          box-shadow: 0 0 10px rgba(16, 185, 129, 0.5);
          display: flex;
          align-items: center;
          gap: 4px;
        ">
          <span style="width: 6px; height: 6px; border-radius: 50%; background: #34d399; display: inline-block;"></span>
          ${selectedRanger.full_name}
        </div>
      `;

      const rangerIcon = L.divIcon({
        className: 'ranger-live-pin',
        html: rangerHtml,
        iconAnchor: [40, 15]
      });

      L.marker([rangerLat, rangerLng], { icon: rangerIcon })
        .addTo(map)
        .bindPopup(`<strong>${selectedRanger.full_name}</strong><br/>Status: Available (ETA ~12m)`);
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [route, layerType, selectedRanger]);

  return (
    <div style={{
      position: 'relative',
      width: '100%',
      height: '350px',
      borderRadius: '12px',
      overflow: 'hidden',
      border: '1px solid rgba(52, 211, 153, 0.25)',
      boxShadow: '0 6px 24px rgba(0, 0, 0, 0.5)'
    }}>
      {/* Real Leaflet Map Canvas */}
      <div ref={mapContainerRef} style={{ width: '100%', height: '100%' }} />

      {/* Top Header Badge */}
      <div style={{
        position: 'absolute',
        top: 12,
        left: 12,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        background: 'rgba(3, 14, 10, 0.85)',
        padding: '6px 12px',
        borderRadius: '8px',
        border: '1px solid rgba(52, 211, 153, 0.25)',
        fontSize: '0.74rem',
        color: '#cbd5e1',
        zIndex: 500,
        backdropFilter: 'blur(8px)'
      }}>
        <Navigation size={13} color="#34d399" />
        <span style={{ color: '#fff', fontWeight: 700 }}>{route?.route_name || 'Sector 7B - Northern River Basin'}</span>
        <span style={{ color: 'rgba(255,255,255,0.3)' }}>|</span>
        <span style={{ fontFamily: 'monospace', color: '#94a3b8' }}>Yala NP Ruhuna (06°24'N / 81°32'E)</span>
      </div>

      {/* Real Map Layer Switcher (Satellite vs Tactical Dark) */}
      <div style={{
        position: 'absolute',
        top: 12,
        right: 12,
        display: 'flex',
        gap: 6,
        zIndex: 500
      }}>
        <button
          onClick={() => setLayerType('satellite')}
          style={{
            background: layerType === 'satellite' ? '#10b981' : 'rgba(3, 14, 10, 0.85)',
            color: layerType === 'satellite' ? '#020907' : '#94a3b8',
            border: '1px solid rgba(52, 211, 153, 0.4)',
            padding: '5px 10px',
            borderRadius: '6px',
            fontSize: '0.72rem',
            cursor: 'pointer',
            fontWeight: 700,
            backdropFilter: 'blur(8px)',
            transition: 'all 0.15s ease'
          }}
        >
          Real Satellite (Esri)
        </button>

        <button
          onClick={() => setLayerType('tactical')}
          style={{
            background: layerType === 'tactical' ? '#10b981' : 'rgba(3, 14, 10, 0.85)',
            color: layerType === 'tactical' ? '#020907' : '#94a3b8',
            border: '1px solid rgba(52, 211, 153, 0.4)',
            padding: '5px 10px',
            borderRadius: '6px',
            fontSize: '0.72rem',
            cursor: 'pointer',
            fontWeight: 700,
            backdropFilter: 'blur(8px)',
            transition: 'all 0.15s ease'
          }}
        >
          Tactical Dark Grid
        </button>
      </div>

      {/* Bottom GIS Legend */}
      <div style={{
        position: 'absolute',
        bottom: 10,
        left: 12,
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        background: 'rgba(3, 14, 10, 0.85)',
        padding: '5px 12px',
        borderRadius: '6px',
        border: '1px solid rgba(255,255,255,0.08)',
        fontSize: '0.7rem',
        color: '#94a3b8',
        zIndex: 500,
        backdropFilter: 'blur(8px)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981', display: 'inline-block' }}></span>
          <span>Waypoints 1-4</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444', display: 'inline-block' }}></span>
          <span>Critical Threat Hotspot</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ width: 14, height: 2, background: '#10b981', display: 'inline-block' }}></span>
          <span>Patrol Trajectory ({route?.distance_km || 18.4} km)</span>
        </div>
      </div>
    </div>
  );
}
