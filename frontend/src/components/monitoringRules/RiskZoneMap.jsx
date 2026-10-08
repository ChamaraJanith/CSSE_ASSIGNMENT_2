import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { formatZone, toZoneCircle } from './monitoringRuleUtils';

// Severity colours of the existing .badge-risk styles (PatrolPlanning.css)
const SEVERITY_COLOURS = {
  CRITICAL: '#ef4444',
  HIGH: '#f59e0b',
  MEDIUM: '#06b6d4',
  LOW: '#10b981',
};
const OTHER_ZONE_COLOUR = '#94a3b8';

// Zoom used when the selected zone has a centre but no recorded radius
const CENTRE_ONLY_ZOOM = 13;

const severityColour = (zone) => SEVERITY_COLOURS[zone.severityLevel] || SEVERITY_COLOURS.HIGH;

// Leaflet treats string tooltips as HTML; zone text from the database is set as plain text
const textTooltip = (text) => {
  const element = document.createElement('span');
  element.textContent = text;
  return element;
};

const formatCoordinate = (value, positive, negative) => `${Math.abs(value).toFixed(4)}°${value >= 0 ? positive : negative}`;

/**
 * UC04 Step 1 "Park Map / Risk Zone": a basemap with the selected park's risk zones drawn from
 * their stored centre and radius (risk_zones.center_lat / center_lng / radius_km). The selected
 * zone is highlighted and the view fits it; the park's other zones are drawn faintly for context.
 * No park boundary is drawn because none is stored.
 */
export default function RiskZoneMap({ selectedZone, riskZones, parkName }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const zonesLayerRef = useRef(null);

  const selectedCircle = toZoneCircle(selectedZone);

  // The Leaflet map is created once per mount and removed on unmount
  useEffect(() => {
    const map = L.map(containerRef.current, { scrollWheelZoom: false });
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 18,
      attribution: 'Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community',
    }).addTo(map);
    zonesLayerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      zonesLayerRef.current = null;
    };
  }, []);

  // Redraw the zones and refit the view whenever the selection or the park's zones change
  useEffect(() => {
    const map = mapRef.current;
    const layer = zonesLayerRef.current;
    if (!map || !layer) return;
    layer.clearLayers();

    (riskZones || []).forEach((zone) => {
      if (selectedZone && zone.id === selectedZone.id) return;
      const circle = toZoneCircle(zone);
      if (!circle) return;
      const style = { color: OTHER_ZONE_COLOUR, weight: 1, opacity: 0.7, fillColor: OTHER_ZONE_COLOUR, fillOpacity: 0.08, dashArray: '4, 6' };
      const shape = circle.radiusMeters
        ? L.circle(circle.center, { ...style, radius: circle.radiusMeters })
        : L.circleMarker(circle.center, { ...style, radius: 5 });
      shape.bindTooltip(textTooltip(formatZone(zone)), { direction: 'top', sticky: true }).addTo(layer);
    });

    const circle = toZoneCircle(selectedZone);
    if (!circle) return;
    const colour = severityColour(selectedZone);
    map.invalidateSize();

    if (circle.radiusMeters) {
      L.circle(circle.center, {
        radius: circle.radiusMeters, color: colour, weight: 3, opacity: 1, fillColor: colour, fillOpacity: 0.25,
      }).addTo(layer);
      // Bounds come from the zone itself: circle.getBounds() needs a loaded map, and the map only
      // loads once this first fitBounds gives it a view (there is no hard-coded initial view)
      map.fitBounds(L.latLng(circle.center).toBounds(circle.radiusMeters * 2), { padding: [24, 24] });
    } else {
      map.setView(circle.center, CENTRE_ONLY_ZOOM);
    }

    L.circleMarker(circle.center, { radius: 4, color: '#ffffff', weight: 2, fillColor: colour, fillOpacity: 1 })
      .bindTooltip(textTooltip(selectedZone.zoneCode), { permanent: true, direction: 'top', offset: [0, -6], className: 'mr-map-tooltip' })
      .addTo(layer);
  }, [riskZones, selectedZone]);

  return (
    <div className="mr-map">
      <div
        ref={containerRef}
        className="mr-map-canvas"
        aria-label={`Map of ${formatZone(selectedZone)} in ${parkName}`}
        data-testid="risk-zone-map"
      />
      {selectedCircle ? (
        <div className="mr-map-legend">
          <span className="mr-map-legend-item">
            <span className="mr-map-swatch" style={{ borderColor: severityColour(selectedZone) }} />
            <strong>{selectedZone.zoneCode}</strong>
          </span>
          <span className="mr-code">
            {formatCoordinate(selectedCircle.center[0], 'N', 'S')}, {formatCoordinate(selectedCircle.center[1], 'E', 'W')}
          </span>
          <span>{selectedCircle.radiusMeters ? `Radius ${selectedZone.radiusKm} km` : 'Radius not recorded'}</span>
          {(riskZones || []).length > 1 && (
            <span className="mr-map-legend-item">
              <span className="mr-map-swatch mr-map-swatch-other" /> Other zones in {parkName}
            </span>
          )}
        </div>
      ) : (
        <p className="mr-map-legend mr-muted" role="status">The location of this risk zone is not recorded, so it cannot be shown on the map.</p>
      )}
    </div>
  );
}
