import React from 'react';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, test, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RuleDetailsView from '../RuleDetailsView';
import RuleActivationDialog from '../RuleActivationDialog';
import { EXISTING_RULES, OPTIONS, PARK, RISK_ZONES } from './fixtures';

// Vitest does not process CSS imports (even ?raw returns ''), so the stylesheets are read from disk.
// The path is built from this file's location (Vite rewrites `new URL(..., import.meta.url)`).
const PAGES_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'pages');
const readStylesheet = (name) => readFileSync(join(PAGES_DIR, name), 'utf8').replace(/\r\n/g, '\n');
const monitoringRulesCss = readStylesheet('MonitoringRules.css');
const dashboardCss = readStylesheet('Dashboard.css');

// Leaflet cannot render in jsdom; the map itself is covered by RuleDetailsView.leaflet.test.jsx
vi.mock('../RiskZoneMap', () => ({ default: () => <div data-testid="risk-zone-map" /> }));

const ACTIVE_RULE = EXISTING_RULES[0];
const DRAFT_RULE = EXISTING_RULES[1];

// Renders a dialog where the app renders it: inside the UC04 container, whose z-index (10) is
// below the dashboard's sticky header (15)
const renderInsideUc04 = (dialog) => render(<div className="mr-container">{dialog}</div>);

const details = (props = {}) => (
  <RuleDetailsView
    rule={ACTIVE_RULE} parkName={PARK.name} riskZones={RISK_ZONES} options={OPTIONS}
    onAction={vi.fn()} onClose={vi.fn()} {...props}
  />
);

const confirmation = (props = {}) => (
  <RuleActivationDialog
    mode="ACTIVATE" rule={DRAFT_RULE} parkName={PARK.name} riskZones={RISK_ZONES} options={OPTIONS}
    pending={false} error={null} onCancel={vi.fn()} onConfirm={vi.fn()} {...props}
  />
);

const parts = (dialog) => ({
  header: dialog.querySelector(':scope > .mr-modal-header'),
  body: dialog.querySelector(':scope > .mr-modal-body'),
  footer: dialog.querySelector(':scope > .mr-modal-footer'),
});

// Declarations of the first top-level rule for `selector` in a stylesheet
const declarations = (css, selector) => {
  const start = css.indexOf(`\n${selector} {`);
  if (start === -1) throw new Error(`No rule for ${selector}`);
  const body = css.slice(css.indexOf('{', start) + 1, css.indexOf('}', start));
  return body.replace(/\/\*[\s\S]*?\*\//g, '').split(';').map((line) => line.trim()).filter(Boolean);
};
const valueOf = (css, selector, property) => declarations(css, selector)
  .filter((line) => line.startsWith(`${property}:`))
  .map((line) => line.slice(property.length + 1).trim());

describe('UC04 dialogs - rendered above the dashboard header', () => {
  test.each([
    ['rule details', details],
    ['activate confirmation', confirmation],
  ])('the %s dialog is portalled to document.body, outside the UC04 stacking context', (_name, dialogFor) => {
    const { container } = renderInsideUc04(dialogFor());
    const dialog = screen.getByRole('dialog');

    expect(dialog.closest('.mr-container')).toBeNull();
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    expect(dialog.parentElement).toHaveClass('mr-modal-backdrop');
    expect(dialog.parentElement.parentElement).toBe(document.body);
  });

  test('closing the dialog removes it from document.body', () => {
    const { rerender } = renderInsideUc04(details());
    expect(document.body.querySelector('.mr-modal-backdrop')).not.toBeNull();

    rerender(<div className="mr-container" />);
    expect(document.body.querySelector('.mr-modal-backdrop')).toBeNull();
  });
});

describe('UC04 dialogs - fixed header, scrollable body, fixed footer', () => {
  test('the details title and close button are in the header, outside the scrollable body', () => {
    renderInsideUc04(details());
    const dialog = screen.getByRole('dialog', { name: `Monitoring Rule #${ACTIVE_RULE.id}` });
    const { header, body, footer } = parts(dialog);

    expect([...dialog.children]).toEqual([header, body, footer]);
    expect(within(header).getByText(`Monitoring Rule #${ACTIVE_RULE.id}`)).toHaveAttribute('id', 'mr-details-title');
    expect(within(header).getByRole('button', { name: 'Close details' })).toBeEnabled();
    expect(body.contains(header)).toBe(false);

    // Everything else scrolls inside the body: details, map and history
    expect(within(body).getByRole('region', { name: 'Rule Information' })).toBeInTheDocument();
    expect(within(body).getByTestId('risk-zone-map')).toBeInTheDocument();
    expect(within(body).getByRole('region', { name: 'Status & History' })).toBeInTheDocument();

    // The actions and Close stay reachable in the footer
    expect(within(footer).getByRole('button', { name: 'Deactivate' })).toBeInTheDocument();
    expect(within(footer).getByRole('button', { name: 'Close' })).toHaveFocus();
  });

  test('both close controls of the details dialog close it', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderInsideUc04(details({ onClose }));

    await user.click(screen.getByRole('button', { name: 'Close details' }));
    await user.click(screen.getByRole('button', { name: 'Close' }));
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(3);
  });

  test('the confirmation keeps its title in the header and Cancel / confirm in the footer', () => {
    renderInsideUc04(confirmation({ error: { message: 'Conflict found.', errors: [], conflicts: [] } }));
    const dialog = screen.getByRole('dialog', { name: /Activate Monitoring Rule/ });
    const { header, body, footer } = parts(dialog);

    expect(within(header).getByText('Activate Monitoring Rule')).toBeInTheDocument();
    expect(within(body).getByRole('alert')).toHaveTextContent('Conflict found.');
    expect(within(footer).getByRole('button', { name: 'Cancel' })).toHaveFocus();
    expect(within(footer).getByRole('button', { name: 'Activate Rule' })).toBeEnabled();
  });

  test('while pending, Escape cannot close the confirmation', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    renderInsideUc04(confirmation({ pending: true, onCancel }));

    await user.keyboard('{Escape}');
    expect(onCancel).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
  });
});

// jsdom does no layout, so the CSS that keeps the header visible is checked as a contract
describe('UC04 dialog stylesheet contract', () => {
  const headerZIndex = Number(valueOf(dashboardCss, '.top-header', 'z-index')[0]);
  const headerHeight = parseInt(valueOf(dashboardCss, '.top-header', 'height')[0], 10);

  test('the backdrop is fixed and stacked above the sticky dashboard header', () => {
    expect(valueOf(monitoringRulesCss, '.mr-modal-backdrop', 'position')).toEqual(['fixed']);
    expect(Number(valueOf(monitoringRulesCss, '.mr-modal-backdrop', 'z-index')[0])).toBeGreaterThan(headerZIndex);
  });

  test('the dialog starts below the dashboard header and is centred without flex top-clipping', () => {
    expect(parseInt(valueOf(monitoringRulesCss, '.mr-modal-backdrop', '--mr-modal-top')[0], 10)).toBeGreaterThan(headerHeight);
    expect(valueOf(monitoringRulesCss, '.mr-modal-backdrop', 'align-items')).toEqual([]);
    expect(valueOf(monitoringRulesCss, '.mr-modal.panel-card', 'margin')).toEqual(['auto']);
  });

  test('the dialog fits the viewport and only its body scrolls', () => {
    const maxHeights = valueOf(monitoringRulesCss, '.mr-modal.panel-card', 'max-height');
    expect(maxHeights.some((value) => value.includes('100dvh') && value.includes('var(--mr-modal-top)'))).toBe(true);
    expect(valueOf(monitoringRulesCss, '.mr-modal.panel-card', 'overflow')).toEqual(['hidden']);
    expect(valueOf(monitoringRulesCss, '.mr-modal-header', 'flex')).toEqual(['none']);
    expect(valueOf(monitoringRulesCss, '.mr-modal-footer', 'flex')).toEqual(['none']);
    expect(valueOf(monitoringRulesCss, '.mr-modal-body', 'overflow-y')).toEqual(['auto']);
    expect(valueOf(monitoringRulesCss, '.mr-modal-body', 'min-height')).toEqual(['0']);
  });

  test('small and short screens reduce the insets so the dialog still fits', () => {
    const small = monitoringRulesCss.slice(monitoringRulesCss.indexOf('@media (max-width: 600px)'));
    const short = monitoringRulesCss.slice(monitoringRulesCss.indexOf('@media (max-height: 560px)'));
    expect(small).toMatch(/\.mr-modal-backdrop \{\s*--mr-modal-top: 8px;\s*--mr-modal-edge: 8px;/);
    expect(short).toMatch(/\.mr-modal-backdrop \{\s*--mr-modal-top: 12px;\s*--mr-modal-edge: 12px;/);
  });
});
