import React from 'react';
import { describe, test, expect, vi, beforeAll, afterAll, afterEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import L from 'leaflet';
import RuleDetailsView from '../RuleDetailsView';
import {
  OPTIONS, PARK, RISK_ZONES, UDAWALAWE_PARK, UDAWALAWE_ZONES, WILPATTU_PARK, WILPATTU_ZONES, ruleInZone,
} from './fixtures';

// The View Details dialog with the REAL RiskZoneMap and the REAL Leaflet library (as in
// RiskZoneMap.leaflet.test.jsx). jsdom has no layout, so the map container gets a fixed size here.
const CONTAINER_SIZE = { clientWidth: 600, clientHeight: 260 };

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

const renderDetails = (park, zones, zone) => {
  const createMap = vi.spyOn(L, 'map');
  const rule = ruleInZone(park, zone);
  const view = render(
    <RuleDetailsView
      rule={rule}
      parkName={park.name}
      riskZones={zones}
      options={OPTIONS}
      onAction={vi.fn()}
      onClose={vi.fn()}
    />,
  );
  return { ...view, rule, createMap, map: () => createMap.mock.results[0]?.value };
};

// The selected zone is drawn as the only circle with the heavy solid stroke
const selectedCircles = (map) => {
  const found = [];
  map.eachLayer((layer) => {
    if (layer instanceof L.Circle && layer.options.weight === 3) found.push(layer);
  });
  return found;
};

describe('RuleDetailsView risk-zone map with real Leaflet', () => {
  test.each([
    ['Yala', PARK, RISK_ZONES, RISK_ZONES[0], 6.4128, 81.5342, 3200, '#ef4444'],
    ['Wilpattu', WILPATTU_PARK, WILPATTU_ZONES, WILPATTU_ZONES[1], 8.421, 80.062, 2500, '#f59e0b'],
    ['Udawalawe', UDAWALAWE_PARK, UDAWALAWE_ZONES, UDAWALAWE_ZONES[1], 6.495, 80.875, 2200, '#06b6d4'],
  ])('%s: draws the rule\'s zone at its stored centre and radius with its severity colour', (_name, park, zones, zone, lat, lng, radius, colour) => {
    const { createMap, map } = renderDetails(park, zones, zone);

    expect(createMap).toHaveBeenCalledTimes(1);
    expect(map()._loaded).toBe(true);
    expect(map().getCenter().lat).toBeCloseTo(lat, 3);
    expect(map().getCenter().lng).toBeCloseTo(lng, 3);

    const circles = selectedCircles(map());
    expect(circles).toHaveLength(1);
    expect(circles[0].getLatLng().lat).toBeCloseTo(lat, 4);
    expect(circles[0].getLatLng().lng).toBeCloseTo(lng, 4);
    expect(circles[0].getRadius()).toBe(radius);
    expect(circles[0].options.color).toBe(colour);

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByTestId('risk-zone-map')).toHaveAttribute('aria-label', `Map of ${zone.zoneCode} – ${zone.zoneName} in ${park.name}`);
    expect(within(dialog).getByText(`Radius ${zone.radiusKm} km`)).toBeInTheDocument();
  });

  test('another park never shows Yala geography', () => {
    const { map } = renderDetails(UDAWALAWE_PARK, UDAWALAWE_ZONES, UDAWALAWE_ZONES[0]);
    const yala = RISK_ZONES.map((zone) => [zone.centerLat, zone.centerLng]);
    map().eachLayer((layer) => {
      if (!(layer instanceof L.CircleMarker)) return;
      const { lat, lng } = layer.getLatLng();
      yala.forEach(([yalaLat, yalaLng]) => expect([lat, lng]).not.toEqual([yalaLat, yalaLng]));
    });
    expect(map().getCenter().lat).toBeCloseTo(6.442, 3);
    expect(map().getCenter().lng).toBeCloseTo(80.892, 3);
  });

  test('a zone without a recorded radius shows its centre only, without crashing', () => {
    const zone = { ...UDAWALAWE_ZONES[0], radiusKm: null };
    const { map } = renderDetails(UDAWALAWE_PARK, [zone, UDAWALAWE_ZONES[1]], zone);

    expect(selectedCircles(map())).toHaveLength(0);
    expect(map().getCenter().lat).toBeCloseTo(6.442, 3);
    expect(screen.getByText('Radius not recorded')).toBeInTheDocument();
  });

  test('a zone without stored coordinates explains it and draws nothing for it', () => {
    const zone = { ...WILPATTU_ZONES[0], centerLat: null, centerLng: null };
    const { map } = renderDetails(WILPATTU_PARK, [zone, WILPATTU_ZONES[1]], zone);

    expect(selectedCircles(map())).toHaveLength(0);
    expect(screen.getByText('The location of this risk zone is not recorded, so it cannot be shown on the map.')).toBeInTheDocument();
    // The rest of the details are still shown
    expect(screen.getByText('RZ-WILP-01 – Kokmote Sandstone River Buffer')).toBeInTheDocument();
  });

  test('closing the dialog (unmount) removes the Leaflet map', () => {
    const { map, unmount } = renderDetails(PARK, RISK_ZONES, RISK_ZONES[1]);
    const remove = vi.spyOn(map(), 'remove');

    expect(() => unmount()).not.toThrow();
    expect(remove).toHaveBeenCalledTimes(1);
  });
});
