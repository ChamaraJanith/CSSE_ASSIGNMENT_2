import React from 'react';
import { describe, test, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import EvidenceReviewQueue from '../EvidenceReviewQueue';
import { generateQueueItems, queueItems } from './fixtures';

const renderQueue = (props = {}) => {
  const handlers = { onRetry: vi.fn(), onSelect: vi.fn() };
  const view = render(<EvidenceReviewQueue items={queueItems} loading={false} error={null} notice={null} {...handlers} {...props} />);
  return { ...handlers, ...view };
};

const rowCodes = () => within(screen.getByRole('table'))
  .getAllByRole('row').slice(1)
  .map((row) => within(row).getAllByRole('cell')[1].querySelector('.er-code').textContent);

const pagination = () => screen.queryByRole('navigation', { name: 'Review queue pagination' });

// 12 unreviewed (IMG-U-01..12) + 7 reviewed (IMG-R-01..07); higher numbers are newer captures
const unreviewedMany = generateQueueItems(12, { prefix: 'U' });
const reviewedMany = generateQueueItems(7, { prefix: 'R', reviewStatus: 'REVIEWED', idOffset: 200 });
const manyItems = [...unreviewedMany, ...reviewedMany];

describe('EvidenceReviewQueue', () => {
  test('renders the wireframe title and columns with the Unreviewed tab selected by default', () => {
    renderQueue();
    expect(screen.getByText('Camera-Trap Evidence Review')).toBeInTheDocument();
    ['Thumbnail', 'Evidence ID', 'Camera ID', 'Location', 'Capture Time', 'Review Status', 'Action']
      .forEach((column) => expect(screen.getByRole('columnheader', { name: column })).toBeInTheDocument());
    expect(screen.getByRole('tab', { name: /Unreviewed/ })).toHaveAttribute('aria-selected', 'true');
    expect(screen.queryByRole('button', { name: /Refresh/ })).not.toBeInTheDocument();
  });

  test('search and status filter sit in the same control row as the tabs', () => {
    renderQueue();
    const controls = screen.getByRole('tablist').parentElement;
    expect(within(controls).getByRole('searchbox', { name: 'Search Evidence' })).toBeInTheDocument();
    expect(within(controls).getByRole('combobox', { name: 'Status filter' })).toBeInTheDocument();
  });

  test('Unreviewed tab lists UNREVIEWED and NEEDS_FURTHER_REVIEW evidence with Review actions and full row details', () => {
    renderQueue();
    expect(rowCodes()).toEqual(['IMG-WILP01-0002', 'IMG-WILP01-0001', 'IMG-YALA02-0001']);

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

    expect(rowCodes()).toEqual(['IMG-YALA01-0002', 'IMG-YALA01-0001', 'IMG-YALA02-0002']);
    expect(screen.getByRole('button', { name: 'View IMG-YALA01-0002' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Review IMG/ })).not.toBeInTheDocument();
    expect(within(screen.getByRole('table')).getAllByText('Reviewed – Escalated')).toHaveLength(2);
  });

  test('All tab lists every evidence item across pages', async () => {
    const user = userEvent.setup();
    renderQueue();
    await user.click(screen.getByRole('tab', { name: /^All/ }));
    expect(rowCodes()).toEqual(['IMG-WILP01-0002', 'IMG-WILP01-0001', 'IMG-YALA02-0001', 'IMG-YALA01-0002', 'IMG-YALA01-0001']);
    expect(screen.getByText('Showing 1 to 5 of 6 results')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Next page' }));
    expect(rowCodes()).toEqual(['IMG-YALA02-0002']);
    expect(screen.getByText('Showing 6 to 6 of 6 results')).toBeInTheDocument();
  });

  test('search filters by evidence, camera or location', async () => {
    const user = userEvent.setup();
    renderQueue();
    await user.type(screen.getByRole('searchbox', { name: 'Search Evidence' }), 'ct-wilp');
    expect(rowCodes()).toEqual(['IMG-WILP01-0002', 'IMG-WILP01-0001']);
  });

  test('status filter narrows the current tab to one status', async () => {
    const user = userEvent.setup();
    renderQueue();
    await user.selectOptions(screen.getByRole('combobox', { name: 'Status filter' }), 'NEEDS_FURTHER_REVIEW');
    expect(rowCodes()).toEqual(['IMG-WILP01-0001']);
  });

  test('search and status filter work together', async () => {
    const user = userEvent.setup();
    renderQueue();
    await user.selectOptions(screen.getByRole('combobox', { name: 'Status filter' }), 'UNREVIEWED');
    expect(rowCodes()).toEqual(['IMG-WILP01-0002', 'IMG-YALA02-0001']);

    await user.type(screen.getByRole('searchbox', { name: 'Search Evidence' }), 'katagamuwa');
    expect(rowCodes()).toEqual(['IMG-YALA02-0001']);
    expect(screen.getByText('Showing 1 to 1 of 1 results')).toBeInTheDocument();
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

  test('selecting View on reviewed evidence passes the evidence item to the flow', async () => {
    const user = userEvent.setup();
    const { onSelect } = renderQueue();
    await user.click(screen.getByRole('tab', { name: /^Reviewed/ }));
    await user.click(screen.getByRole('button', { name: 'View IMG-YALA01-0002' }));
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 2, imageCode: 'IMG-YALA01-0002' }));
  });

  test('shows loading and empty states', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<EvidenceReviewQueue items={[]} loading error={null} onRetry={vi.fn()} onSelect={vi.fn()} />);
    expect(screen.getByRole('status')).toHaveTextContent('Loading camera-trap evidence');
    unmount();

    renderQueue();
    await user.type(screen.getByRole('searchbox', { name: 'Search Evidence' }), 'no-such-evidence');
    expect(screen.getByText('No camera-trap evidence matches the current view.')).toBeInTheDocument();
    expect(screen.queryByText(/^Showing/)).not.toBeInTheDocument();
    expect(pagination()).not.toBeInTheDocument();
  });

  test('shows an API error with Retry', async () => {
    const user = userEvent.setup();
    const { onRetry } = renderQueue({ items: [], error: 'Unable to reach the evidence review service.' });
    expect(screen.getByRole('alert')).toHaveTextContent('Unable to reach the evidence review service.');
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});

describe('EvidenceReviewQueue - sorting', () => {
  test('newest captured evidence appears first', () => {
    renderQueue({ items: [...unreviewedMany].reverse() });
    expect(rowCodes()).toEqual(['IMG-U-12', 'IMG-U-11', 'IMG-U-10', 'IMG-U-09', 'IMG-U-08']);
  });

  test('evidence with a missing capture time is listed last without breaking the queue', async () => {
    const user = userEvent.setup();
    renderQueue();
    await user.click(screen.getByRole('tab', { name: /^Reviewed/ }));
    const rows = within(screen.getByRole('table')).getAllByRole('row').slice(1);
    expect(within(rows[2]).getByText('IMG-YALA02-0002')).toBeInTheDocument();
    expect(within(rows[2]).getByText('Not recorded')).toBeInTheDocument();
  });
});

describe('EvidenceReviewQueue - pagination', () => {
  test('shows 5 results per page with a results footer and page controls', () => {
    renderQueue({ items: manyItems });
    expect(rowCodes()).toHaveLength(5);
    expect(screen.getByText('Showing 1 to 5 of 12 results')).toBeInTheDocument();
    const nav = pagination();
    ['Page 1', 'Page 2', 'Page 3'].forEach((name) => expect(within(nav).getByRole('button', { name })).toBeInTheDocument());
    expect(within(nav).getByRole('button', { name: 'Page 1' })).toHaveAttribute('aria-current', 'page');
    expect(within(nav).getByRole('button', { name: 'Previous page' })).toBeDisabled();
  });

  test('a single page of results shows the footer but no pagination controls', () => {
    renderQueue();
    expect(screen.getByText('Showing 1 to 3 of 3 results')).toBeInTheDocument();
    expect(pagination()).not.toBeInTheDocument();
  });

  test('Next page and Previous page move between pages', async () => {
    const user = userEvent.setup();
    renderQueue({ items: manyItems });

    await user.click(screen.getByRole('button', { name: 'Next page' }));
    expect(rowCodes()).toEqual(['IMG-U-07', 'IMG-U-06', 'IMG-U-05', 'IMG-U-04', 'IMG-U-03']);
    expect(screen.getByText('Showing 6 to 10 of 12 results')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Next page' }));
    expect(rowCodes()).toEqual(['IMG-U-02', 'IMG-U-01']);
    expect(screen.getByText('Showing 11 to 12 of 12 results')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next page' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Previous page' }));
    expect(rowCodes()).toEqual(['IMG-U-07', 'IMG-U-06', 'IMG-U-05', 'IMG-U-04', 'IMG-U-03']);
  });

  test('a page number button jumps directly to that page', async () => {
    const user = userEvent.setup();
    renderQueue({ items: manyItems });
    await user.click(screen.getByRole('button', { name: 'Page 3' }));
    expect(rowCodes()).toEqual(['IMG-U-02', 'IMG-U-01']);
    expect(screen.getByRole('button', { name: 'Page 3' })).toHaveAttribute('aria-current', 'page');
  });

  test('changing tab resets to page 1', async () => {
    const user = userEvent.setup();
    renderQueue({ items: manyItems });
    await user.click(screen.getByRole('button', { name: 'Page 2' }));

    await user.click(screen.getByRole('tab', { name: /^All/ }));
    expect(screen.getByText('Showing 1 to 5 of 19 results')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Page 1' })).toHaveAttribute('aria-current', 'page');
  });

  test('changing the search resets to page 1', async () => {
    const user = userEvent.setup();
    renderQueue({ items: manyItems });
    await user.click(screen.getByRole('button', { name: 'Page 2' }));

    await user.type(screen.getByRole('searchbox', { name: 'Search Evidence' }), 'IMG-U');
    expect(screen.getByText('Showing 1 to 5 of 12 results')).toBeInTheDocument();
    expect(rowCodes()[0]).toBe('IMG-U-12');
  });

  test('changing the status filter resets to page 1', async () => {
    const user = userEvent.setup();
    renderQueue({ items: manyItems });
    await user.click(screen.getByRole('button', { name: 'Page 3' }));

    await user.selectOptions(screen.getByRole('combobox', { name: 'Status filter' }), 'UNREVIEWED');
    expect(screen.getByText('Showing 1 to 5 of 12 results')).toBeInTheDocument();
  });

  test('when fewer results remain, a page that no longer exists falls back to the last valid page', async () => {
    const user = userEvent.setup();
    const { rerender, onRetry, onSelect } = renderQueue({ items: manyItems });
    await user.click(screen.getByRole('button', { name: 'Page 3' }));

    rerender(<EvidenceReviewQueue items={unreviewedMany.slice(0, 7)} loading={false} error={null} notice={null} onRetry={onRetry} onSelect={onSelect} />);
    expect(screen.getByText('Showing 6 to 7 of 7 results')).toBeInTheDocument();
    expect(rowCodes()).toEqual(['IMG-U-02', 'IMG-U-01']);

    await user.click(screen.getByRole('button', { name: 'Previous page' }));
    expect(screen.getByText('Showing 1 to 5 of 7 results')).toBeInTheDocument();
  });
});
