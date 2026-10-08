import React from 'react';
import { describe, test, expect, vi, beforeAll, afterAll, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import L from 'leaflet';
import RiskZoneMap from '../RiskZoneMap';
import { PARK, RISK_ZONES } from './fixtures';

// Smoke test against the REAL Leaflet library (no Leaflet mock), so Leaflet's own lifecycle rules
// apply, e.g. layers added before the map has a view are only attached once it loads.
// jsdom has no layout, so the map container is given a fixed size for these tests only.
const CONTAINER_SIZE = { clientWidth: 600, clientHeight: 280 };

beforeAll(() => {
  Object.entries(CONTAINER_SIZE).forEach(([property, value]) => {
    Object.defineProperty(HTMLElement.prototype, property, { configurable: true, get: () => value });
  });
});

afterAll(() => {
  Object.keys(CONTAINER_SIZE).forEach((property) => {
    delete HTMLElement.prototype[property];
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

// The component keeps its map private; spying on L.map (calling through) exposes the real instance
const renderWithRealLeaflet = (zone) => {
  const createMap = vi.spyOn(L, 'map');
  const view = render(<RiskZoneMap selectedZone={zone} riskZones={RISK_ZONES} parkName={PARK.name} />);
  return { ...view, createMap, map: () => createMap.mock.results[0].value };
};

// Circles drawn by the component on the real map; the selected zone has the heavy solid stroke
const selectedCircles = (map) => {
  const found = [];
  map.eachLayer((layer) => {
    if (layer instanceof L.Circle && layer.options.weight === 3) found.push(layer);
  });
  return found;
};

describe('RiskZoneMap with real Leaflet', () => {
  test('initialises for RZ-YALA-01 without throwing and centres on the stored zone centre', () => {
    const { createMap, map } = renderWithRealLeaflet(RISK_ZONES[0]);

    expect(createMap).toHaveBeenCalledTimes(1);
    expect(map()._loaded).toBe(true);
    // The initial fit happens on a map that is not loaded yet, so it is applied synchronously
    expect(map().getCenter().lat).toBeCloseTo(6.4128, 3);
    expect(map().getCenter().lng).toBeCloseTo(81.5342, 3);

    const [circle] = selectedCircles(map());
    expect(selectedCircles(map())).toHaveLength(1);
    expect(circle.getLatLng().lat).toBeCloseTo(6.4128, 4);
    expect(circle.getLatLng().lng).toBeCloseTo(81.5342, 4);
    expect(circle.getRadius()).toBe(3200);
    // Once on the loaded map the circle has real bounds, and they contain the fitted view's centre
    expect(circle.getBounds().contains(map().getCenter())).toBe(true);
  });

  test('rerendering with RZ-YALA-02 redraws the selected circle on the same map without throwing', () => {
    const { createMap, map, rerender } = renderWithRealLeaflet(RISK_ZONES[0]);
    const firstMap = map();

    rerender(<RiskZoneMap selectedZone={RISK_ZONES[1]} riskZones={RISK_ZONES} parkName={PARK.name} />);

    expect(createMap).toHaveBeenCalledTimes(1);
    expect(map()).toBe(firstMap);
    expect(firstMap._loaded).toBe(true);
    // The pan to the new zone may be animated, so the drawn circle is checked rather than the view
    const circles = selectedCircles(firstMap);
    expect(circles).toHaveLength(1);
    expect(circles[0].getLatLng().lat).toBeCloseTo(6.3845, 4);
    expect(circles[0].getLatLng().lng).toBeCloseTo(81.487, 4);
    expect(circles[0].getRadius()).toBe(2800);
  });

  test('unmounting removes the real map without throwing', () => {
    const { map, unmount } = renderWithRealLeaflet(RISK_ZONES[0]);
    const remove = vi.spyOn(map(), 'remove');

    expect(() => unmount()).not.toThrow();
    expect(remove).toHaveBeenCalledTimes(1);
  });
});
