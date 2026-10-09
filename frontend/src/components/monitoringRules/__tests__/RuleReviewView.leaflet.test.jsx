import React from 'react';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, test, expect, vi, beforeAll, afterAll, afterEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import L from 'leaflet';
import RuleReviewView from '../RuleReviewView';
import { RULE_ACTIONS } from '../monitoringRuleUtils';
import {
  OPTIONS, PARK, RISK_ZONES, UDAWALAWE_PARK, UDAWALAWE_ZONES, WILPATTU_PARK, WILPATTU_ZONES,
} from './fixtures';

// The Step 3 review screen with the REAL RiskZoneMap and the REAL Leaflet library (as in
// RuleDetailsView.leaflet.test.jsx). jsdom has no layout, so the map container gets a fixed size here.
const CONTAINER_SIZE = { clientWidth: 600, clientHeight: 280 };

const PAGES_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'pages');
const monitoringRulesCss = readFileSync(join(PAGES_DIR, 'MonitoringRules.css'), 'utf8').replace(/\r\n/g, '\n');

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

// The validated (not yet saved) configuration the review screen receives
const reviewRule = (park, zone) => ({
  parkId: park.id,
  hazardType: 'POACHING_SNARING',
  riskZoneId: zone.id,
  alertPriority: 'HIGH',
  notificationRecipients: ['wildlife_officer', 'park_manager'],
  responseBehaviour: 'PLACEHOLDER_RESPONSE',
  notes: '',
});

const renderReview = (park, zones, zone, props = {}) => {
  const createMap = vi.spyOn(L, 'map');
  const handlers = { onBack: vi.fn(), onEdit: vi.fn(), onCreate: vi.fn() };
  const view = render(
    <RuleReviewView
      rule={reviewRule(park, zone)}
      parkName={park.name}
      riskZones={zones}
      options={OPTIONS}
      submittingAction={null}
      error={null}
      {...handlers}
      {...props}
    />,
  );
  return { ...view, ...handlers, createMap, map: () => createMap.mock.results[0]?.value };
};

const ruleDetails = () => screen.getByRole('region', { name: 'Rule Details' });
const mapCard = () => screen.getByRole('region', { name: 'Risk Zone Map' });

// The selected zone is drawn as the only circle with the heavy solid stroke
const selectedCircles = (map) => {
  const found = [];
  map.eachLayer((layer) => {
    if (layer instanceof L.Circle && layer.options.weight === 3) found.push(layer);
  });
  return found;
};

describe('RuleReviewView layout', () => {
  test('shows Rule Details first and the Risk Zone Map second, side by side in the review grid', () => {
    renderReview(PARK, RISK_ZONES, RISK_ZONES[1]);

    const grid = ruleDetails().parentElement;
    expect(grid).toHaveClass('mr-review-grid');
    expect([...grid.children]).toEqual([ruleDetails(), mapCard()]);
    expect(within(mapCard()).getByTestId('risk-zone-map')).toBeInTheDocument();
    // The map card belongs to the review, not the Step 1 configuration panel
    expect(screen.queryByRole('region', { name: 'Park map and risk zone' })).toBeNull();
  });

  test('the stylesheet places the cards in two columns and stacks them on smaller screens', () => {
    const rule = monitoringRulesCss.slice(monitoringRulesCss.indexOf('\n.mr-review-grid {'));
    expect(rule).toMatch(/^\n\.mr-review-grid \{[^}]*display: grid;[^}]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);/);

    const tablet = monitoringRulesCss.slice(monitoringRulesCss.indexOf('@media (max-width: 900px)'));
    expect(tablet).toMatch(/^@media \(max-width: 900px\) \{[^}]*\.mr-review-grid \{\s*grid-template-columns: 1fr;/);
  });
});

describe('RuleReviewView risk-zone map with real Leaflet', () => {
  test.each([
    ['Yala', PARK, RISK_ZONES, RISK_ZONES[1], 6.3845, 81.487, 2800, '#f59e0b'],
    ['Wilpattu', WILPATTU_PARK, WILPATTU_ZONES, WILPATTU_ZONES[0], 8.492, 80.035, 3500, '#ef4444'],
    ['Udawalawe', UDAWALAWE_PARK, UDAWALAWE_ZONES, UDAWALAWE_ZONES[1], 6.495, 80.875, 2200, '#06b6d4'],
  ])('%s: highlights the selected zone at its stored centre and radius', (_name, park, zones, zone, lat, lng, radius, colour) => {
    const { createMap, map } = renderReview(park, zones, zone);

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

    expect(within(mapCard()).getByTestId('risk-zone-map'))
      .toHaveAttribute('aria-label', `Map of ${zone.zoneCode} – ${zone.zoneName} in ${park.name}`);
    expect(within(mapCard()).getByText(`Radius ${zone.radiusKm} km`)).toBeInTheDocument();
  });

  test('another park never shows Yala geography', () => {
    const { map } = renderReview(WILPATTU_PARK, WILPATTU_ZONES, WILPATTU_ZONES[1]);
    const yala = RISK_ZONES.map((zone) => [zone.centerLat, zone.centerLng]);
    map().eachLayer((layer) => {
      if (!(layer instanceof L.CircleMarker)) return;
      const { lat, lng } = layer.getLatLng();
      yala.forEach(([yalaLat, yalaLng]) => expect([lat, lng]).not.toEqual([yalaLat, yalaLng]));
    });
    expect(map().getCenter().lat).toBeCloseTo(8.421, 3);
    expect(map().getCenter().lng).toBeCloseTo(80.062, 3);
  });

  test('a zone without stored coordinates shows the location-unavailable state and draws nothing for it', () => {
    const zone = { ...UDAWALAWE_ZONES[0], centerLat: null, centerLng: null };
    const { map } = renderReview(UDAWALAWE_PARK, [zone, UDAWALAWE_ZONES[1]], zone);

    expect(selectedCircles(map())).toHaveLength(0);
    expect(within(mapCard()).getByText('The location of this risk zone is not recorded, so it cannot be shown on the map.'))
      .toBeInTheDocument();
    expect(within(ruleDetails()).getByText('RZ-UDAW-01 – Mau Ara Southern Fence Boundary')).toBeInTheDocument();
  });

  test('a zone missing from the park reference data shows a message instead of a guessed map', () => {
    const { createMap } = renderReview(PARK, RISK_ZONES, { id: 99 });

    expect(createMap).not.toHaveBeenCalled();
    expect(within(mapCard()).queryByTestId('risk-zone-map')).toBeNull();
    expect(within(mapCard()).getByText(`The location of this risk zone is not available for ${PARK.name}, so it cannot be shown on the map.`))
      .toBeInTheDocument();
  });

  test('leaving the review (unmount) removes the Leaflet map', () => {
    const { map, unmount } = renderReview(PARK, RISK_ZONES, RISK_ZONES[0]);
    const remove = vi.spyOn(map(), 'remove');

    expect(() => unmount()).not.toThrow();
    expect(remove).toHaveBeenCalledTimes(1);
  });
});

describe('RuleReviewView actions are unchanged by the map', () => {
  test('Edit, Back, Save as Draft and Activate Rule call their handlers', async () => {
    const user = userEvent.setup();
    const { onBack, onEdit, onCreate } = renderReview(PARK, RISK_ZONES, RISK_ZONES[1]);

    await user.click(screen.getByRole('button', { name: 'Edit' }));
    expect(onEdit).toHaveBeenCalledWith(1);
    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(onBack).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole('button', { name: 'Save as Draft' }));
    expect(onCreate).toHaveBeenLastCalledWith(RULE_ACTIONS.SAVE_DRAFT);
    await user.click(screen.getByRole('button', { name: 'Activate Rule' }));
    expect(onCreate).toHaveBeenLastCalledWith(RULE_ACTIONS.ACTIVATE);
    expect(screen.getByText('The configuration passed validation.')).toBeInTheDocument();
  });

  test('every action is disabled while saving, and the map stays shown', () => {
    renderReview(PARK, RISK_ZONES, RISK_ZONES[1], { submittingAction: RULE_ACTIONS.ACTIVATE });

    ['Edit', 'Back', 'Save as Draft', 'Activating…'].forEach((name) => {
      expect(screen.getByRole('button', { name })).toBeDisabled();
    });
    expect(within(mapCard()).getByTestId('risk-zone-map')).toBeInTheDocument();
  });

  test('editing a draft keeps Save Draft Changes as the only save, next to the map', () => {
    renderReview(PARK, RISK_ZONES, RISK_ZONES[1], { editing: true });

    expect(screen.getByRole('button', { name: 'Save Draft Changes' })).toBeEnabled();
    expect(screen.queryByRole('button', { name: 'Activate Rule' })).toBeNull();
    expect(within(mapCard()).getByTestId('risk-zone-map')).toBeInTheDocument();
  });
});
