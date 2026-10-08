import React, { useState } from 'react';
import { describe, test, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import EscalateEvidenceView from '../EscalateEvidenceView';
import { IMAGE_STATUS } from '../evidenceReviewUtils';
import { detail } from './fixtures';

// Holds justification / acknowledgement / image state the same way EvidenceReviewManager does
function Harness({ evidence, onConfirm, onCancel, onBackToQueue, submitting = false, error = null }) {
  const [justification, setJustification] = useState('');
  const [metadataAcknowledged, setMetadataAcknowledged] = useState(false);
  const [imageStatus, setImageStatus] = useState(IMAGE_STATUS.LOADING);
  return (
    <EscalateEvidenceView
      evidence={evidence}
      justification={justification}
      metadataAcknowledged={metadataAcknowledged}
      imageStatus={imageStatus}
      submitting={submitting}
      error={error}
      onJustificationChange={setJustification}
      onMetadataAcknowledgedChange={setMetadataAcknowledged}
      onImageStatusChange={setImageStatus}
      onCancel={onCancel}
      onConfirm={() => onConfirm({ justification })}
      onBackToQueue={onBackToQueue}
    />
  );
}

const renderView = (evidence = detail(5), { loadImage = true, ...props } = {}) => {
  const handlers = { onConfirm: vi.fn(), onCancel: vi.fn(), onBackToQueue: vi.fn() };
  render(<Harness evidence={evidence} {...handlers} {...props} />);
  if (loadImage) fireEvent.load(evidenceImage(evidence.imageCode));
  return { user: userEvent.setup(), ...handlers };
};

const evidenceImage = (code = 'IMG-WILP01-0001') => screen.getByAltText(`Camera-trap evidence ${code}`);
const confirmButton = () => screen.getByRole('button', { name: /Confirm Escalation/ });
const reasonBox = () => screen.getByRole('textbox', { name: /Escalation Reason/ });
const summaryCard = () => screen.getByRole('region', { name: 'Evidence Summary' });
const detailsCard = () => screen.getByRole('region', { name: 'Threat / Escalation Details' });
const counter = () => screen.getByText(/\/ 500$/);

describe('EscalateEvidenceView - layout', () => {
  test('renders as a page titled "Escalate Suspicious Evidence", not a modal dialog', () => {
    renderView();
    expect(screen.getByRole('heading', { level: 2, name: /Escalate Suspicious Evidence/ })).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  test('shows a red danger banner explaining that a threat alert will be created', () => {
    renderView();
    const banner = screen.getByRole('note', { name: 'Escalation warning' });
    expect(banner).toHaveClass('er-danger-banner');
    expect(banner).toHaveTextContent('You are escalating this evidence. Please confirm the details before creating a threat alert.');
    expect(banner).toHaveTextContent('Confirming will create a Threat Alert linked to the original camera-trap image.');
  });

  test('Evidence Summary card shows the image, Evidence ID, Camera ID, Location, Captured and Suspicious Person', () => {
    renderView();
    const summary = summaryCard();
    expect(within(summary).getByAltText('Camera-trap evidence IMG-WILP01-0001')).toBeInTheDocument();

    const field = (label) => within(summary).getByText(label, { selector: 'dt' }).nextElementSibling;
    expect(field('Evidence ID')).toHaveTextContent('IMG-WILP01-0001');
    expect(field('Camera ID')).toHaveTextContent('CT-WILP-01');
    expect(field('Location')).toHaveTextContent('Kokmote River Buffer Trail, Wilpattu National Park');
    expect(field('Captured')).toHaveTextContent('03 Oct 2026, 04:20');
    expect(field('Classification')).toHaveTextContent('Suspicious Person');
  });

  test('Threat Priority and Recipient / Team are required-looking read-only fields with High and Ranger Team', () => {
    renderView();
    const details = detailsCard();
    const priority = within(details).getByLabelText(/Threat Priority/);
    const recipient = within(details).getByLabelText(/Recipient \/ Team/);

    expect(priority).toHaveValue('High');
    expect(recipient).toHaveValue('Ranger Team');
    expect(priority).toHaveAttribute('readonly');
    expect(recipient).toHaveAttribute('readonly');
    expect(within(details).queryByRole('combobox')).not.toBeInTheDocument();
    expect(within(details).getAllByText('*')).toHaveLength(2);
  });

  test('Cancel is on the left and Confirm Escalation on the right of the bottom action bar', () => {
    renderView();
    const buttons = within(confirmButton().parentElement).getAllByRole('button');
    expect(buttons.map((button) => button.textContent.trim())).toEqual(['Cancel', 'Confirm Escalation']);
    expect(confirmButton().parentElement).toHaveClass('er-escalate-actions');
  });
});

describe('EscalateEvidenceView - Escalation Reason', () => {
  test('is labelled "Escalation Reason *" and the counter starts at 0 / 500', () => {
    renderView();
    expect(screen.getByText('Escalation Reason', { exact: false, selector: 'label' })).toHaveTextContent('Escalation Reason *');
    expect(reasonBox()).toBeRequired();
    expect(counter()).toHaveTextContent('0 / 500');
    expect(reasonBox()).toHaveAccessibleDescription('0 / 500');
  });

  test('the counter updates while typing', async () => {
    const { user } = renderView();
    await user.type(reasonBox(), 'Rifle');
    expect(counter()).toHaveTextContent('5 / 500');
  });

  test('input is limited to 500 characters', async () => {
    const { user } = renderView();
    expect(reasonBox()).toHaveAttribute('maxLength', '500');
    fireEvent.change(reasonBox(), { target: { value: 'x'.repeat(520) } });
    expect(reasonBox()).toHaveValue('x'.repeat(500));
    expect(counter()).toHaveTextContent('500 / 500');
    await user.type(reasonBox(), 'y');
    expect(reasonBox().value).toHaveLength(500);
  });

  test('Confirm Escalation is disabled for a blank or whitespace-only reason', async () => {
    const { user, onConfirm } = renderView();
    expect(confirmButton()).toBeDisabled();
    await user.type(reasonBox(), '    ');
    expect(confirmButton()).toBeDisabled();
    await user.click(confirmButton());
    expect(onConfirm).not.toHaveBeenCalled();
  });

  test('a valid reason enables Confirm Escalation and confirms with that reason', async () => {
    const { user, onConfirm } = renderView();
    await user.type(reasonBox(), 'Rifle visible');
    expect(confirmButton()).toBeEnabled();
    await user.click(confirmButton());
    expect(onConfirm).toHaveBeenCalledWith({ justification: 'Rifle visible' });
  });

  test('Cancel calls onCancel without confirming', async () => {
    const { user, onCancel, onConfirm } = renderView();
    await user.type(reasonBox(), 'Rifle visible');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });
});

describe('EscalateEvidenceView - incomplete metadata', () => {
  test('lists the missing metadata and requires the acknowledgement before confirming', async () => {
    const { user } = renderView(detail(3));
    const warning = within(detailsCard()).getByRole('alert');
    expect(warning).toHaveTextContent('Incomplete Metadata');
    expect(warning).toHaveTextContent('Latitude not recorded');
    expect(warning).toHaveTextContent('Longitude not recorded');

    await user.type(reasonBox(), 'Rifle visible');
    expect(confirmButton()).toBeDisabled();
    await user.click(screen.getByRole('checkbox', { name: 'I have reviewed the incomplete metadata' }));
    expect(confirmButton()).toBeEnabled();
  });

  test('complete metadata needs no acknowledgement', () => {
    renderView();
    expect(screen.queryByText('Incomplete Metadata')).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });
});

describe('EscalateEvidenceView - image loading', () => {
  test('Confirm Escalation stays disabled while the image is still loading', async () => {
    const { user } = renderView(detail(5), { loadImage: false });
    await user.type(reasonBox(), 'Rifle visible');
    expect(confirmButton()).toBeDisabled();
  });

  test('an image failure shows Retry and Back to Review Queue and blocks escalation', async () => {
    const { user, onBackToQueue, onConfirm } = renderView(detail(5), { loadImage: false });
    fireEvent.error(evidenceImage());
    await user.type(reasonBox(), 'Rifle visible');

    expect(screen.getByText('Image could not be loaded')).toBeInTheDocument();
    expect(screen.getByText('The image must load before evidence can be escalated.')).toBeInTheDocument();
    expect(confirmButton()).toBeDisabled();
    await user.click(confirmButton());
    expect(onConfirm).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: /Back to Review Queue/ }));
    expect(onBackToQueue).toHaveBeenCalledTimes(1);
  });

  test('Retry restores Confirm Escalation once the image loads', async () => {
    const { user } = renderView(detail(5), { loadImage: false });
    fireEvent.error(evidenceImage());
    await user.type(reasonBox(), 'Rifle visible');

    await user.click(screen.getByRole('button', { name: /Retry/ }));
    expect(confirmButton()).toBeDisabled();
    fireEvent.load(evidenceImage());
    expect(confirmButton()).toBeEnabled();
  });
});

describe('EscalateEvidenceView - submitting and errors', () => {
  test('while submitting, the form and both actions are disabled', () => {
    renderView(detail(5), { submitting: true });
    expect(screen.getByRole('button', { name: /Escalating…/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    expect(reasonBox()).toBeDisabled();
  });

  test('shows the error passed in by the manager', () => {
    renderView(detail(5), { error: 'The escalation was not recorded. Please try again.' });
    expect(screen.getByRole('alert')).toHaveTextContent('The escalation was not recorded. Please try again.');
  });
});
