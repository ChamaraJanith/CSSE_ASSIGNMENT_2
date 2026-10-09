import React from 'react';

const LeafletMap = ({ locations, incidentLocation }) => {
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
      initMap();
    }

    function initMap() {
      if (mapInstance.current) {
        mapInstance.current.remove();
      }
      if (!mapRef.current || !window.L || locations.length === 0) return;
      
      const L = window.L;
      const latest = locations[0];
      const lat = Number(latest.latitude);
      const lon = Number(latest.longitude);
      
      const map = L.map(mapRef.current).setView([lat, lon], 16);
      mapInstance.current = map;
      
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      }).addTo(map);
      
      if (locations.length > 1) {
        const latlngs = locations.map(loc => [Number(loc.latitude), Number(loc.longitude)]);
        L.polyline(latlngs, {color: '#ef4444', weight: 4, opacity: 0.7}).addTo(map);
      }
      
      const customIcon = L.icon({
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
      });

      L.marker([lat, lon], { icon: customIcon }).addTo(map)
        .bindPopup('<b>Latest Ranger Location</b>')
        .openPopup();
        
      // Incident Location Marker
      if (incidentLocation && incidentLocation.latitude && incidentLocation.longitude) {
        const incLat = Number(incidentLocation.latitude);
        const incLon = Number(incidentLocation.longitude);
        
        if (Number.isFinite(incLat) && Number.isFinite(incLon)) {
          const incIcon = L.icon({
            iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
            shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
            iconSize: [25, 41],
            iconAnchor: [12, 41],
            popupAnchor: [1, -34],
          });
          L.marker([incLat, incLon], { icon: incIcon }).addTo(map)
            .bindPopup('<b>Incident Location</b>');
        }
      }
    }
    
    return () => {
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
      }
    };
  }, [locations, incidentLocation]);

  return <div ref={mapRef} style={{ width: '100%', height: '250px', borderRadius: '8px', zIndex: 1 }}></div>;
};

export default LeafletMap;
