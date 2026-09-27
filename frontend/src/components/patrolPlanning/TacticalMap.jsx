import React, { useState } from 'react';
import { MapPin, Navigation, Radio, AlertTriangle, Shield, Eye, Layers } from 'lucide-react';

export default function TacticalMap({ route, riskZones = [], rangers = [], selectedRanger = null }) {
  const [mapMode, setMapMode] = useState('tactical'); // 'tactical' or 'satellite'
  const [activeTooltip, setActiveTooltip] = useState(null);

  const checkpoints = route?.checkpoints || [
    { name: 'WP-01 Alpha Depot', lat: 6.4020, lng: 81.5120, order: 1 },
    { name: 'WP-02 Fordable River Crossing', lat: 6.4150, lng: 81.5280, order: 2 },
    { name: 'WP-03 Waterhole 4 Sanctuary', lat: 6.4280, lng: 81.5450, order: 3 },
    { name: 'WP-04 Northern Ridge Outpost', lat: 6.4390, lng: 81.5600, order: 4 }
  ];

  return (
    <div style={{
      position: 'relative',
      width: '100%',
      height: '340px',
      background: mapMode === 'tactical' ? 'radial-gradient(circle at 50% 50%, #072a20 0%, #021a14 100%)' : '#031f18',
      borderRadius: '12px',
      border: '1px solid rgba(52, 211, 153, 0.3)',
      overflow: 'hidden',
      boxShadow: 'inset 0 0 40px rgba(0, 0, 0, 0.8)'
    }}>
      {/* Radar Grid Overlay */}
      <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
        <defs>
          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(52, 211, 153, 0.08)" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />
        
        {/* Topography Contour Lines (Simulated Tactical Terrain) */}
        <path d="M 30,180 Q 150,90 280,160 T 500,120 T 700,200" fill="none" stroke="rgba(52, 211, 153, 0.15)" strokeWidth="1.5" strokeDasharray="6 4" />
        <path d="M 20,240 Q 180,140 320,220 T 560,180 T 750,260" fill="none" stroke="rgba(52, 211, 153, 0.12)" strokeWidth="1.5" />
        <path d="M 50,110 Q 220,50 380,100 T 620,80" fill="none" stroke="rgba(245, 158, 11, 0.15)" strokeWidth="1" />

        {/* Patrol Route Path Connection Line */}
        <polyline
          points="80,260 210,180 370,140 540,100"
          fill="none"
          stroke="#10b981"
          strokeWidth="3.5"
          strokeDasharray="8 4"
        />

        {/* High Risk Zone Overlay (Circle Area) */}
        <circle cx="370" cy="140" r="75" fill="rgba(239, 68, 68, 0.15)" stroke="#ef4444" strokeWidth="1.5" strokeDasharray="4 4" />
      </svg>

      {/* Map Controls Header */}
      <div style={{
        position: 'absolute',
        top: 12,
        left: 12,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        background: 'rgba(2, 44, 34, 0.85)',
        padding: '6px 12px',
        borderRadius: '8px',
        border: '1px solid rgba(255,255,255,0.1)',
        fontSize: '0.75rem',
        color: '#94a3b8'
      }}>
        <Navigation size={14} color="#34d399" />
        <span style={{ color: '#fff', fontWeight: 600 }}>{route?.route_name || 'Sector 7B - Northern River Basin'}</span>
        <span>•</span>
        <span>Grid: 06°24'N / 81°32'E</span>
      </div>

      <div style={{ position: 'absolute', top: 12, right: 12, display: 'flex', gap: 6 }}>
        <button
          onClick={() => setMapMode('tactical')}
          style={{
            background: mapMode === 'tactical' ? '#10b981' : 'rgba(2, 44, 34, 0.8)',
            color: '#fff',
            border: '1px solid rgba(52, 211, 153, 0.4)',
            padding: '4px 10px',
            borderRadius: '6px',
            fontSize: '0.72rem',
            cursor: 'pointer',
            fontWeight: 600
          }}
        >
          Tactical Grid
        </button>
        <button
          onClick={() => setMapMode('satellite')}
          style={{
            background: mapMode === 'satellite' ? '#10b981' : 'rgba(2, 44, 34, 0.8)',
            color: '#fff',
            border: '1px solid rgba(52, 211, 153, 0.4)',
            padding: '4px 10px',
            borderRadius: '6px',
            fontSize: '0.72rem',
            cursor: 'pointer',
            fontWeight: 600
          }}
        >
          Satellite
        </button>
      </div>

      {/* Waypoints Rendered */}
      <div style={{ position: 'absolute', inset: 0 }}>
        {/* WP-01 */}
        <div style={{ position: 'absolute', left: '70px', top: '245px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ width: 14, height: 14, borderRadius: '50%', background: '#34d399', border: '2px solid #fff', boxShadow: '0 0 10px #34d399' }}></div>
          <span style={{ fontSize: '0.68rem', color: '#a7f3d0', fontWeight: 600, marginTop: 4, background: 'rgba(0,0,0,0.6)', padding: '2px 6px', borderRadius: 4 }}>
            WP-01 Depot
          </span>
        </div>

        {/* WP-02 */}
        <div style={{ position: 'absolute', left: '200px', top: '165px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ width: 14, height: 14, borderRadius: '50%', background: '#34d399', border: '2px solid #fff', boxShadow: '0 0 10px #34d399' }}></div>
          <span style={{ fontSize: '0.68rem', color: '#a7f3d0', fontWeight: 600, marginTop: 4, background: 'rgba(0,0,0,0.6)', padding: '2px 6px', borderRadius: 4 }}>
            WP-02 River Ford
          </span>
        </div>

        {/* WP-03 (Inside Threat Zone) */}
        <div style={{ position: 'absolute', left: '360px', top: '125px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ width: 18, height: 18, borderRadius: '50%', background: '#ef4444', border: '2px solid #fff', boxShadow: '0 0 14px #ef4444', animation: 'radarPulse 1.5s infinite' }}></div>
          <span style={{ fontSize: '0.68rem', color: '#fca5a5', fontWeight: 700, marginTop: 4, background: 'rgba(0,0,0,0.7)', padding: '2px 6px', borderRadius: 4 }}>
            ⚠️ WP-03 Waterhole (Acoustic Spike)
          </span>
        </div>

        {/* WP-04 */}
        <div style={{ position: 'absolute', left: '530px', top: '85px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ width: 14, height: 14, borderRadius: '50%', background: '#34d399', border: '2px solid #fff', boxShadow: '0 0 10px #34d399' }}></div>
          <span style={{ fontSize: '0.68rem', color: '#a7f3d0', fontWeight: 600, marginTop: 4, background: 'rgba(0,0,0,0.6)', padding: '2px 6px', borderRadius: 4 }}>
            WP-04 North Ridge
          </span>
        </div>

        {/* Selected Ranger Position Pin */}
        {selectedRanger && (
          <div style={{ position: 'absolute', left: '110px', top: '210px', display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(16, 185, 129, 0.9)', padding: '4px 8px', borderRadius: '6px', border: '1px solid #fff', boxShadow: '0 0 15px rgba(16,185,129,0.8)' }}>
            <Radio size={14} color="#fff" />
            <span style={{ fontSize: '0.72rem', color: '#fff', fontWeight: 700 }}>
              {selectedRanger.full_name} (ETA ~12m)
            </span>
          </div>
        )}
      </div>

      {/* Map Legend Footer */}
      <div style={{
        position: 'absolute',
        bottom: 10,
        left: 12,
        right: 12,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: 'rgba(2, 44, 34, 0.85)',
        padding: '6px 14px',
        borderRadius: '8px',
        border: '1px solid rgba(255,255,255,0.08)',
        fontSize: '0.72rem',
        color: '#94a3b8'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981', display: 'inline-block' }}></span>
            Planned Waypoint
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444', display: 'inline-block' }}></span>
            Critical Risk Zone
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 14, height: 2, background: '#10b981', display: 'inline-block' }}></span>
            Patrol Vector (18.4 km)
          </span>
        </div>
        <div>
          <span>Scale: 1:25,000 | Elevation: +142m MSL</span>
        </div>
      </div>
    </div>
  );
}
