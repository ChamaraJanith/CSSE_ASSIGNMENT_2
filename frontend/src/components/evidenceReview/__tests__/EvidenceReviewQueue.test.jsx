import React from 'react';
import { describe, test, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import EvidenceReviewQueue from '../EvidenceReviewQueue';
import { queueItems } from './fixtures';

const renderQueue = (props = {}) => {
  const handlers = { onRetry: vi.fn(), onSelect: vi.fn() };
  render(<EvidenceReviewQueue items={queueItems} loading={false} error={null} notice={null} {...handlers} {...props} />);
  return handlers;
};

const rowCodes = () => within(screen.getByRole('table'))
  .getAllByRole('row').slice(1)
  .map((row) => within(row).getAllByRole('cell')[1].querySelector('.er-code').textContent);

describe('EvidenceReviewQueue', () => {
  test('renders the wireframe title and columns with the Unreviewed tab selected by default', () => {
    renderQueue();
    expect(screen.getByText('Camera-Trap Evidence Review')).toBeInTheDocument();
    ['Image', 'Evidence ID', 'Camera ID', 'Location', 'Capture Time', 'Review Status', 'Action']
      .forEach((column) => expect(screen.getByRole('columnheader', { name: column })).toBeInTheDocument());
    expect(screen.getByRole('tab', { name: /Unreviewed/ })).toHaveAttribute('aria-selected', 'true');
  });

  test('Unreviewed tab lists UNREVIEWED and NEEDS_FURTHER_REVIEW evidence with Review actions and full row details', () => {
    renderQueue();
    expect(rowCodes()).toEqual(['IMG-YALA02-0001', 'IMG-WILP01-0001', 'IMG-WILP01-0002']);

    const row = screen.getByRole('button', { name: 'Review IMG-WILP01-0001' }).closest('tr');
    expect(within(row).getByText('CT-WILP-01')).toBeInTheDocument();
    expect(within(row).getByText('Kokmote River Buffer Trail, Wilpattu National Park')).toBeInTheDocument();
    expect(within(row).getByText('03 Oct 2026, 04:20')).toBeInTheDocument();
    expect(within(row).getByText('Needs Further Review')).toBeInTheDocument();
    expect(within(row).getByAltText('Thumbnail of IMG-WILP01-0001')).toBeInTheDocument();
  });

  test('tab counts reflect the grouped statuses', () => {
    renderQueue();
    expect(screen.getByRole('tab', { name: 'Unreviewed 3' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Reviewed 3' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'All 6' })).toBeInTheDocument();
  });

  test('Reviewed tab lists REVIEWED and REVIEWED_ESCALATED evidence with View actions', async () => {
    const user = userEvent.setup();
    renderQueue();
    await user.click(screen.getByRole('tab', { name: /^Reviewed/ }));

    expect(rowCodes()).toEqual(['IMG-YALA01-0001', 'IMG-YALA01-0002', 'IMG-YALA02-0002']);
    expect(screen.getByRole('button', { name: 'View IMG-YALA01-0002' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Review IMG/ })).not.toBeInTheDocument();
    expect(within(screen.getByRole('table')).getAllByText('Reviewed – Escalated')).toHaveLength(2);
  });

  test('All tab lists every evidence item', async () => {
    const user = userEvent.setup();
    renderQueue();
    await user.click(screen.getByRole('tab', { name: /^All/ }));
    expect(rowCodes()).toHaveLength(6);
  });

  test('search filters by evidence, camera or location', async () => {
    const user = userEvent.setup();
    renderQueue();
    await user.type(screen.getByRole('searchbox', { name: 'Search Evidence' }), 'ct-wilp');
    expect(rowCodes()).toEqual(['IMG-WILP01-0001', 'IMG-WILP01-0002']);
  });

  test('status filter narrows the current tab to one status', async () => {
    const user = userEvent.setup();
    renderQueue();
    await user.selectOptions(screen.getByRole('combobox', { name: 'Status filter' }), 'NEEDS_FURTHER_REVIEW');
    expect(rowCodes()).toEqual(['IMG-WILP01-0001']);
  });

  test('flags evidence with incomplete metadata', () => {
    renderQueue();
    const row = screen.getByRole('button', { name: 'Review IMG-YALA02-0001' }).closest('tr');
    expect(within(row).getByText('Incomplete metadata')).toBeInTheDocument();
    const completeRow = screen.getByRole('button', { name: 'Review IMG-WILP01-0001' }).closest('tr');
    expect(within(completeRow).queryByText('Incomplete metadata')).not.toBeInTheDocument();
  });

  test('selecting Review passes the evidence item to the flow', async () => {
    const user = userEvent.setup();
    const { onSelect } = renderQueue();
    await user.click(screen.getByRole('button', { name: 'Review IMG-YALA02-0001' }));
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 3, imageCode: 'IMG-YALA02-0001' }));
  });

  test('shows loading and empty states', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<EvidenceReviewQueue items={[]} loading error={null} onRetry={vi.fn()} onSelect={vi.fn()} />);
    expect(screen.getByRole('status')).toHaveTextContent('Loading camera-trap evidence');
    unmount();

    renderQueue();
    await user.type(screen.getByRole('searchbox', { name: 'Search Evidence' }), 'no-such-evidence');
    expect(screen.getByText('No camera-trap evidence matches the current view.')).toBeInTheDocument();
  });

  test('shows an API error with Retry', async () => {
    const user = userEvent.setup();
    const { onRetry } = renderQueue({ items: [], error: 'Unable to reach the evidence review service.' });
    expect(screen.getByRole('alert')).toHaveTextContent('Unable to reach the evidence review service.');
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
