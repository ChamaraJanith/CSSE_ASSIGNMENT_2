import React from 'react';

const FullZoneMap = () => {
  const mapRef = React.useRef(null);
  const mapInstance = React.useRef(null);

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
      // Small timeout to ensure DOM is ready if script was already loaded
      setTimeout(initMap, 100);
    }

    function initMap() {
      if (mapInstance.current) {
        mapInstance.current.remove();
      }
      if (!mapRef.current || !window.L) return;
      
      const L = window.L;
      
      // Default to a central park location (e.g. Yala National Park coords)
      const map = L.map(mapRef.current).setView([6.3812, 81.4287], 11);
      mapInstance.current = map;
      
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
      }).addTo(map);
      
      // Draw zones
      const zones = [
        { name: 'Zone 1 - High Risk', color: '#ef4444', bounds: [[6.35, 81.4], [6.45, 81.5]] },
        { name: 'Zone 2 - Buffer', color: '#f59e0b', bounds: [[6.25, 81.3], [6.35, 81.45]] },
        { name: 'Zone 3 - Safe', color: '#10b981', bounds: [[6.4, 81.2], [6.5, 81.35]] }
      ];

      zones.forEach(zone => {
        L.rectangle(zone.bounds, { color: zone.color, weight: 2, fillOpacity: 0.2 })
         .addTo(map)
         .bindTooltip(`<b>${zone.name}</b>`, { permanent: false, direction: "center" });
      });

      // Add headquarters marker
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
  }, []);

  return (
    <div className="dashboard-card-full" style={{ position: 'relative', zIndex: 10 }}>
      <div className="card-header">
        <h2>Interactive Zone Map</h2>
        <p>Monitor wildlife zones, park boundaries, and high-risk areas in real-time.</p>
      </div>
      <div style={{ marginTop: '20px', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', overflow: 'hidden' }}>
        <div ref={mapRef} style={{ width: '100%', height: '600px', zIndex: 1, position: 'relative' }}></div>
      </div>
    </div>
  );
};

export default FullZoneMap;
