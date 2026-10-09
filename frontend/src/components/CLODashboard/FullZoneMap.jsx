import React, { useState } from 'react';

const FullZoneMap = () => {
  const mapRef = React.useRef(null);
  const mapInstance = React.useRef(null);
  
  // States for each zone's risk status
  const [zone1Status, setZone1Status] = useState('HIGH_RISK');
  const [zone2Status, setZone2Status] = useState('MEDIUM_RISK');
  const [zone3Status, setZone3Status] = useState('NO_RISK');

  const getStatusColor = (status) => {
    switch(status) {
      case 'HIGH_RISK': return '#ef4444'; // Red
      case 'MEDIUM_RISK': return '#f59e0b'; // Amber/Orange
      case 'NO_RISK': return '#10b981'; // Green
      default: return '#10b981';
    }
  };

  const getStatusLabel = (status) => {
    switch(status) {
      case 'HIGH_RISK': return 'High Risk';
      case 'MEDIUM_RISK': return 'Medium Risk';
      case 'NO_RISK': return 'No Risk';
      default: return 'No Risk';
    }
  };

  React.useEffect(() => {
    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link');
      link.id = 'leaflet-css';
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }

    if (!window.L) {
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      script.async = true;
      script.onload = initMap;
      document.body.appendChild(script);
    } else {
      setTimeout(initMap, 100);
    }

    function initMap() {
      if (mapInstance.current) {
        mapInstance.current.remove();
      }
      if (!mapRef.current || !window.L) return;
      
      const L = window.L;
      
      const map = L.map(mapRef.current).setView([6.3812, 81.4287], 11);
      mapInstance.current = map;
      
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
      }).addTo(map);
      
      const allZones = [
        { name: `Zone 1 - ${getStatusLabel(zone1Status)}`, color: getStatusColor(zone1Status), bounds: [[6.35, 81.4], [6.45, 81.5]] },
        { name: `Zone 2 - ${getStatusLabel(zone2Status)}`, color: getStatusColor(zone2Status), bounds: [[6.25, 81.3], [6.35, 81.45]] },
        { name: `Zone 3 - ${getStatusLabel(zone3Status)}`, color: getStatusColor(zone3Status), bounds: [[6.4, 81.2], [6.5, 81.35]] }
      ];

      allZones.forEach(zone => {
        L.rectangle(zone.bounds, { color: zone.color, weight: 2, fillOpacity: 0.3 })
         .addTo(map)
         .bindTooltip(`<b>${zone.name}</b>`, { permanent: false, direction: "center" });
      });

      const hqIcon = L.icon({
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
      });
      L.marker([6.3812, 81.4287], { icon: hqIcon }).addTo(map).bindPopup('<b>Park Headquarters</b>');
    }
    
    return () => {
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
      }
    };
  }, [zone1Status, zone2Status, zone3Status]);

  const StatusSelect = ({ label, value, onChange }) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      <label style={{ fontSize: '0.85rem', color: '#94a3b8' }}>{label}</label>
      <select 
        value={value} 
        onChange={onChange}
        style={{ padding: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: '6px' }}
      >
        <option style={{color: 'black'}} value="HIGH_RISK">High Risk</option>
        <option style={{color: 'black'}} value="MEDIUM_RISK">Medium Risk</option>
        <option style={{color: 'black'}} value="NO_RISK">No Risk</option>
      </select>
    </div>
  );

  return (
    <div className="dashboard-card-full" style={{ position: 'relative', zIndex: 10 }}>
      <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2>Interactive Zone Map</h2>
          <p>Monitor wildlife zones, park boundaries, and set risk areas in real-time.</p>
        </div>
        
        <div style={{ display: 'flex', gap: '16px', background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
          <StatusSelect label="Zone 1 Status" value={zone1Status} onChange={e => setZone1Status(e.target.value)} />
          <StatusSelect label="Zone 2 Status" value={zone2Status} onChange={e => setZone2Status(e.target.value)} />
          <StatusSelect label="Zone 3 Status" value={zone3Status} onChange={e => setZone3Status(e.target.value)} />
        </div>
      </div>
      <div style={{ marginTop: '20px', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', overflow: 'hidden' }}>
        <div ref={mapRef} style={{ width: '100%', height: '600px', zIndex: 1, position: 'relative' }}></div>
      </div>
    </div>
  );
};

export default FullZoneMap;
