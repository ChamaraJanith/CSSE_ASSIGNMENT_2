import React from 'react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import L from 'leaflet';
import RiskZoneMap from '../RiskZoneMap';
import { PARK, RISK_ZONES, WILPATTU_PARK, WILPATTU_ZONES } from './fixtures';

// The Leaflet API is replaced by recording fakes and the tests assert what the component asks
// Leaflet to draw (centre, radius, fit, clean-up). Real-Leaflet behaviour is covered by
// RiskZoneMap.leaflet.test.jsx.
const leaflet = vi.hoisted(() => {
  const layer = (kind, center, options) => {
    const shape = {
      kind,
      center,
      options,
      bindTooltip: vi.fn(() => shape),
      addTo: vi.fn(() => shape),
      // As in real Leaflet: a path only has bounds once it is on a loaded map, which the
      // RiskZoneMap map is not before its first fitBounds
      getBounds: vi.fn(() => {
        throw new TypeError("Cannot read properties of undefined (reading 'layerPointToLatLng')");
      }),
    };
    return shape;
  };
  const state = { maps: [], groups: [] };
  const api = {
    map: vi.fn(() => {
      const map = { remove: vi.fn(), fitBounds: vi.fn(), setView: vi.fn(), invalidateSize: vi.fn() };
      state.maps.push(map);
      return map;
    }),
    tileLayer: vi.fn((url, options) => ({ url, options, addTo: vi.fn() })),
    layerGroup: vi.fn(() => {
      const group = { clearLayers: vi.fn() };
      group.addTo = vi.fn(() => group);
      state.groups.push(group);
      return group;
    }),
    circle: vi.fn((center, options) => layer('circle', center, options)),
    circleMarker: vi.fn((center, options) => layer('circleMarker', center, options)),
    marker: vi.fn(),
    // LatLng.toBounds(sizeInMeters) needs no map; the fake records the centre and box size
    latLng: vi.fn((center) => ({ toBounds: vi.fn((sizeInMeters) => ({ center, sizeInMeters })) })),
  };
  return { state, api };
});

vi.mock('leaflet', () => ({ default: leaflet.api }));
vi.mock('leaflet/dist/leaflet.css', () => ({}));

const currentMap = () => leaflet.state.maps[leaflet.state.maps.length - 1];
const circles = () => L.circle.mock.results.map((result) => result.value);
// The highlighted circle is the one drawn with the selected zone's solid, heavy stroke
const highlighted = () => circles().filter((shape) => shape.options.weight === 3);
const faint = () => circles().filter((shape) => shape.options.dashArray);
// Bounds the component fitted: the selected zone's centre and diameter (2 x radius) in metres
const fittedBounds = () => currentMap().fitBounds.mock.calls.map(([bounds]) => bounds);
const expectNoPathBoundsRead = () => {
  [...L.circle.mock.results, ...L.circleMarker.mock.results].forEach(({ value }) => expect(value.getBounds).not.toHaveBeenCalled());
};

beforeEach(() => {
  vi.clearAllMocks();
  leaflet.state.maps.length = 0;
  leaflet.state.groups.length = 0;
});

describe('RiskZoneMap', () => {
  test('creates one Leaflet map with an attributed tile layer and a layer group for the zones', () => {
    render(<RiskZoneMap selectedZone={RISK_ZONES[0]} riskZones={RISK_ZONES} parkName={PARK.name} />);

    expect(L.map).toHaveBeenCalledTimes(1);
    expect(L.map.mock.calls[0][0]).toBe(screen.getByTestId('risk-zone-map'));
    expect(L.tileLayer.mock.calls[0][1].attribution).toMatch(/Esri/);
    expect(L.layerGroup).toHaveBeenCalledTimes(1);
    expect(L.marker).not.toHaveBeenCalled();
  });

  test('draws the selected zone at its stored [lat, lng] with radius = radiusKm * 1000 and fits the view to it', () => {
    render(<RiskZoneMap selectedZone={RISK_ZONES[0]} riskZones={RISK_ZONES} parkName={PARK.name} />);

    expect(highlighted()).toHaveLength(1);
    const [selected] = highlighted();
    expect(selected.center).toEqual([6.4128, 81.5342]);
    expect(selected.options.radius).toBe(3200);
    expect(L.latLng).toHaveBeenCalledWith([6.4128, 81.5342]);
    expect(fittedBounds()).toEqual([{ center: [6.4128, 81.5342], sizeInMeters: 6400 }]);
    expect(currentMap().fitBounds).toHaveBeenCalledWith(expect.any(Object), { padding: [24, 24] });
    expect(screen.getByText('RZ-YALA-01')).toBeInTheDocument();
    expect(screen.getByText('Radius 3.2 km')).toBeInTheDocument();
  });

  test("draws the park's other zones faintly from their own coordinates", () => {
    render(<RiskZoneMap selectedZone={RISK_ZONES[0]} riskZones={RISK_ZONES} parkName={PARK.name} />);

    expect(faint()).toHaveLength(1);
    expect(faint()[0].center).toEqual([6.3845, 81.487]);
    expect(faint()[0].options.radius).toBe(2800);
    expect(faint()[0].options.fillOpacity).toBeLessThan(highlighted()[0].options.fillOpacity);
  });

  test('changing the selected zone clears and redraws the circles and refits, without a new map', () => {
    const { rerender } = render(<RiskZoneMap selectedZone={RISK_ZONES[0]} riskZones={RISK_ZONES} parkName={PARK.name} />);
    const [group] = leaflet.state.groups;
    vi.mocked(L.circle).mockClear();
    currentMap().fitBounds.mockClear();

    rerender(<RiskZoneMap selectedZone={RISK_ZONES[1]} riskZones={RISK_ZONES} parkName={PARK.name} />);

    expect(L.map).toHaveBeenCalledTimes(1);
    expect(group.clearLayers).toHaveBeenCalledTimes(2);
    expect(highlighted()).toHaveLength(1);
    expect(highlighted()[0].center).toEqual([6.3845, 81.487]);
    expect(highlighted()[0].options.radius).toBe(2800);
    expect(faint()[0].center).toEqual([6.4128, 81.5342]);
    expect(fittedBounds()).toEqual([{ center: [6.3845, 81.487], sizeInMeters: 5600 }]);
    expectNoPathBoundsRead();
  });

  test('fits the view from the zone centre and diameter, never from a circle that is not yet on a loaded map', () => {
    render(<RiskZoneMap selectedZone={RISK_ZONES[0]} riskZones={RISK_ZONES} parkName={PARK.name} />);

    expect(currentMap().fitBounds).toHaveBeenCalledTimes(1);
    expectNoPathBoundsRead();
  });

  test("uses another park's real coordinates (Wilpattu), with no Yala geography", () => {
    render(<RiskZoneMap selectedZone={WILPATTU_ZONES[1]} riskZones={WILPATTU_ZONES} parkName={WILPATTU_PARK.name} />);

    expect(highlighted()[0].center).toEqual([8.421, 80.062]);
    expect(highlighted()[0].options.radius).toBe(2500);
    expect(fittedBounds()).toEqual([{ center: [8.421, 80.062], sizeInMeters: 5000 }]);
    const drawnCentres = [...L.circle.mock.calls, ...L.circleMarker.mock.calls].map(([center]) => center);
    drawnCentres.forEach(([lat]) => expect(lat).toBeGreaterThan(8));
  });

  test('a null radius does not crash: the centre is shown and the view is centred on it', () => {
    const zone = { ...RISK_ZONES[0], radiusKm: null };
    render(<RiskZoneMap selectedZone={zone} riskZones={[zone, RISK_ZONES[1]]} parkName={PARK.name} />);

    expect(highlighted()).toHaveLength(0);
    expect(currentMap().fitBounds).not.toHaveBeenCalled();
    expect(currentMap().setView).toHaveBeenCalledWith([6.4128, 81.5342], expect.any(Number));
    expect(L.circleMarker.mock.calls.some(([center]) => center[0] === 6.4128 && center[1] === 81.5342)).toBe(true);
    expect(screen.getByText('Radius not recorded')).toBeInTheDocument();
  });

  test('a selected zone without a stored location explains it instead of drawing a guessed position', () => {
    const zone = { ...RISK_ZONES[0], centerLat: null };
    render(<RiskZoneMap selectedZone={zone} riskZones={[zone]} parkName={PARK.name} />);

    expect(L.circle).not.toHaveBeenCalled();
    expect(currentMap().fitBounds).not.toHaveBeenCalled();
    expect(currentMap().setView).not.toHaveBeenCalled();
    expect(screen.getByRole('status')).toHaveTextContent('location of this risk zone is not recorded');
  });

  test('removes the Leaflet map on unmount', () => {
    const { unmount } = render(<RiskZoneMap selectedZone={RISK_ZONES[0]} riskZones={RISK_ZONES} parkName={PARK.name} />);
    const map = currentMap();
    expect(map.remove).not.toHaveBeenCalled();

    unmount();

    expect(map.remove).toHaveBeenCalledTimes(1);
  });
});
