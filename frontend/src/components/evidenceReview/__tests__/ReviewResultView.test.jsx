import React from 'react';
import { describe, test, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ReviewResultView from '../ReviewResultView';
import { detail, escalatedResult, reviewResult } from './fixtures';

const JUSTIFICATION = 'Person carrying a rifle-shaped object at night';

const OUTCOMES = {
  wildlife: () => [reviewResult(3, { classification: 'WILDLIFE_SPECIES', reviewStatus: 'REVIEWED' }), detail(3)],
  unknown: () => [reviewResult(5, { classification: 'UNKNOWN', reviewStatus: 'NEEDS_FURTHER_REVIEW' }), detail(5)],
  escalated: () => [escalatedResult(5, JUSTIFICATION), detail(5)],
};

const renderResult = (outcome) => {
  const [result, evidence] = OUTCOMES[outcome]();
  const onBackToQueue = vi.fn();
  const { container } = render(<ReviewResultView result={result} evidence={evidence} onBackToQueue={onBackToQueue} />);
  return { user: userEvent.setup(), onBackToQueue, container };
};

const banner = () => screen.getByRole('status', { name: 'Review result' });
const evidenceColumn = () => screen.getByLabelText('Evidence details');
const outcomeColumn = () => screen.getByLabelText('Review outcome');
const field = (column, label) => within(column).getByText(label, { selector: 'dt' }).nextElementSibling;
const viewAlertButton = () => screen.queryByRole('button', { name: /View Alert/ });
const alertInfoBanner = () => screen.queryByRole('note', { name: 'Threat alert information' });

describe('ReviewResultView - success banner', () => {
  test('shows a large check, "Review Completed", the status badge and the success message', () => {
    const { container } = renderResult('wildlife');
    const resultBanner = banner();
    expect(resultBanner).toHaveClass('er-result-banner');
    expect(container.querySelector('.er-result-icon svg')).toHaveAttribute('aria-hidden', 'true');
    expect(within(resultBanner).getByRole('heading', { level: 2, name: 'Review Completed' })).toBeInTheDocument();
    expect(resultBanner).toHaveTextContent('The evidence has been reviewed and recorded successfully.');
  });

  test.each([
    ['wildlife', 'Reviewed', 'er-status-reviewed', /recorded as wildlife\. No threat alert was created/],
    ['unknown', 'Needs Further Review', 'er-status-needs-further-review', /remains in the review queue for secondary review/],
    ['escalated', 'Reviewed – Escalated', 'er-status-reviewed-escalated', /Threat Alert was created and linked/],
  ])('%s outcome shows the "%s" status as text, not only color', (outcome, label, className, message) => {
    renderResult(outcome);
    const badge = within(banner()).getByText(label);
    expect(badge).toHaveClass('er-status-badge', className);
    expect(banner()).toHaveTextContent(message);
    expect(within(outcomeColumn()).getByText(label)).toHaveClass(className);
  });
});

describe('ReviewResultView - two-column Review Summary', () => {
  test('left column holds Evidence ID, Camera ID, Location and Captured', () => {
    renderResult('escalated');
    const summary = screen.getByRole('region', { name: 'Review Summary' });
    expect(within(summary).getAllByRole('definition').length).toBeGreaterThanOrEqual(8);
    expect(evidenceColumn().parentElement).toHaveClass('er-result-grid');
    expect(within(evidenceColumn()).getAllByRole('term').map((node) => node.textContent))
      .toEqual(['Evidence ID', 'Camera ID', 'Location', 'Captured']);
    expect(field(evidenceColumn(), 'Evidence ID')).toHaveTextContent('IMG-WILP01-0001');
    expect(field(evidenceColumn(), 'Camera ID')).toHaveTextContent('CT-WILP-01');
    expect(field(evidenceColumn(), 'Location')).toHaveTextContent('Kokmote River Buffer Trail, Wilpattu National Park');
    expect(field(evidenceColumn(), 'Captured')).toHaveTextContent('03 Oct 2026, 04:20');
  });

  test('right column holds Classification, Review Status, Threat Alert ID and Linked to Image when an alert exists', () => {
    renderResult('escalated');
    expect(within(outcomeColumn()).getAllByRole('term').map((node) => node.textContent))
      .toEqual(['Classification', 'Review Status', 'Threat Alert ID', 'Linked to Image']);
    expect(field(outcomeColumn(), 'Classification')).toHaveTextContent('Suspicious Person');
    expect(field(outcomeColumn(), 'Review Status')).toHaveTextContent('Reviewed – Escalated');
    expect(field(outcomeColumn(), 'Threat Alert ID')).toHaveTextContent('TA-2026-0003');
    expect(field(outcomeColumn(), 'Linked to Image')).toHaveTextContent('Yes (IMG-WILP01-0001)');
  });

  test.each(['wildlife', 'unknown'])('%s outcome has no Threat Alert ID or Linked to Image rows', (outcome) => {
    renderResult(outcome);
    expect(within(outcomeColumn()).getAllByRole('term').map((node) => node.textContent))
      .toEqual(['Classification', 'Review Status']);
    expect(screen.queryByText(/TA-/)).not.toBeInTheDocument();
  });

  test('Suspicious Person uses the danger classification tag; other classifications are neutral', () => {
    renderResult('escalated');
    const suspicious = within(outcomeColumn()).getByText('Suspicious Person');
    expect(suspicious).toHaveClass('er-classification-tag');
    expect(suspicious).not.toHaveClass('er-classification-tag-neutral');
  });

  test.each([['wildlife', 'Wildlife Species'], ['unknown', 'Unknown']])('%s classification shows "%s" with neutral styling', (outcome, label) => {
    renderResult(outcome);
    expect(within(outcomeColumn()).getByText(label)).toHaveClass('er-classification-tag', 'er-classification-tag-neutral');
  });
});

describe('ReviewResultView - Threat Alert', () => {
  test('shows the information banner linking the alert to the original camera-trap image', () => {
    renderResult('escalated');
    const info = alertInfoBanner();
    expect(info).toHaveTextContent('A threat alert has been created and is linked to the original camera-trap image.');
    expect(info).toHaveTextContent('TA-2026-0003 linked to IMG-WILP01-0001');
  });

  test.each(['wildlife', 'unknown'])('%s outcome shows no alert banner, alert ID or View Alert action', (outcome) => {
    renderResult(outcome);
    expect(alertInfoBanner()).not.toBeInTheDocument();
    expect(viewAlertButton()).not.toBeInTheDocument();
    expect(screen.queryByText('Linked to Image')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Back to Review Queue/ })).toBeInTheDocument();
  });

  test('View Alert expands the existing alert details and Close collapses them', async () => {
    const { user } = renderResult('escalated');
    expect(screen.queryByRole('region', { name: 'Threat alert details' })).not.toBeInTheDocument();
    expect(viewAlertButton()).toHaveAttribute('aria-expanded', 'false');

    await user.click(viewAlertButton());
    const details = screen.getByRole('region', { name: 'Threat alert details' });
    expect(viewAlertButton()).toHaveAttribute('aria-expanded', 'true');
    expect(viewAlertButton()).toHaveAttribute('aria-controls', details.id);
    expect(within(details).getByText('Threat Alert TA-2026-0003')).toBeInTheDocument();
    expect(field(details, 'Alert Record')).toHaveTextContent('#3');
    expect(field(details, 'Alert Status')).toHaveTextContent('OPEN');
    expect(field(details, 'Linked Image')).toHaveTextContent('IMG-WILP01-0001 (image #5)');
    expect(field(details, 'Evidence Review')).toHaveTextContent('#11');
    expect(field(details, 'Justification')).toHaveTextContent(JUSTIFICATION);

    await user.click(screen.getByRole('button', { name: 'Close alert details' }));
    expect(screen.queryByRole('region', { name: 'Threat alert details' })).not.toBeInTheDocument();
  });
});

describe('ReviewResultView - actions', () => {
  test('Back to Review Queue is on the left and View Alert on the right', () => {
    renderResult('escalated');
    const actions = viewAlertButton().parentElement;
    expect(actions).toHaveClass('er-result-actions');
    expect(within(actions).getAllByRole('button').map((button) => button.textContent.trim()))
      .toEqual(['Back to Review Queue', 'View Alert']);
  });

  test.each(['wildlife', 'unknown', 'escalated'])('Back to Review Queue calls onBackToQueue for the %s outcome', async (outcome) => {
    const { user, onBackToQueue } = renderResult(outcome);
    await user.click(screen.getByRole('button', { name: /Back to Review Queue/ }));
    expect(onBackToQueue).toHaveBeenCalledTimes(1);
  });

  test('notes and incomplete metadata stay visible below the summary columns', () => {
    const [, evidence] = OUTCOMES.wildlife();
    const result = reviewResult(3, { classification: 'WILDLIFE_SPECIES', reviewStatus: 'REVIEWED', review: { id: 12, notes: 'Leopard resting on rock' } });
    render(<ReviewResultView result={result} evidence={evidence} onBackToQueue={vi.fn()} />);
    expect(screen.getByText('Leopard resting on rock')).toBeInTheDocument();
    expect(screen.getByText('Reviewed with incomplete metadata')).toBeInTheDocument();
  });
});
