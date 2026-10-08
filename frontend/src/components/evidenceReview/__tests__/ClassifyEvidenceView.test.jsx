import React, { useState } from 'react';
import { describe, test, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ClassifyEvidenceView from '../ClassifyEvidenceView';
import { IMAGE_STATUS } from '../evidenceReviewUtils';
import { detail } from './fixtures';

// Holds classification / notes / image state the same way EvidenceReviewManager does
function Harness({ evidence, initialImageStatus = IMAGE_STATUS.LOADING, onConfirm, onCancel, onBackToQueue, submitting = false }) {
  const [classification, setClassification] = useState('');
  const [notes, setNotes] = useState('');
  const [imageStatus, setImageStatus] = useState(initialImageStatus);
  return (
    <>
      <ClassifyEvidenceView
        evidence={evidence}
        classification={classification}
        notes={notes}
        imageStatus={imageStatus}
        submitting={submitting}
        error={null}
        onClassificationChange={setClassification}
        onNotesChange={setNotes}
        onImageStatusChange={setImageStatus}
        onCancel={onCancel}
        onConfirm={() => onConfirm({ classification, notes })}
        onBackToQueue={onBackToQueue}
      />
      <output data-testid="classification">{classification}</output>
    </>
  );
}

const renderView = (evidence = detail(3), props = {}) => {
  const handlers = { onConfirm: vi.fn(), onCancel: vi.fn(), onBackToQueue: vi.fn() };
  render(<Harness evidence={evidence} {...handlers} {...props} />);
  return { user: userEvent.setup(), ...handlers };
};

const evidenceImage = (code = 'IMG-YALA02-0001') => screen.getByAltText(`Camera-trap evidence ${code}`);
const confirmButton = () => screen.getByRole('button', { name: /Confirm Review/ });
const summaryCard = () => screen.getByRole('region', { name: 'Evidence Summary' });
const radio = (name) => screen.getByRole('radio', { name });
const card = (name) => radio(name).closest('label');
const notesBox = () => screen.getByRole('textbox', { name: /Notes/ });

describe('ClassifyEvidenceView - Evidence Summary', () => {
  test('renders the summary card with image, Evidence ID, Camera ID, Location, Captured and Review Status', () => {
    renderView();
    const summary = summaryCard();
    expect(within(summary).getByAltText('Camera-trap evidence IMG-YALA02-0001')).toBeInTheDocument();

    const field = (label) => within(summary).getByText(label, { selector: 'dt' }).nextElementSibling;
    expect(field('Evidence ID')).toHaveTextContent('IMG-YALA02-0001');
    expect(field('Camera ID')).toHaveTextContent('CT-YALA-02');
    expect(field('Location')).toHaveTextContent('Katagamuwa Sanctuary Boundary Fence, Yala National Park (Ruhuna)');
    expect(field('Captured')).toHaveTextContent('02 Oct 2026, 18:35');
    expect(field('Review Status')).toHaveTextContent('Unreviewed');
  });

  test('keeps the remaining capture metadata as a secondary section', () => {
    renderView();
    const metadata = within(summaryCard()).getByText('Capture Metadata').parentElement;
    const field = (label) => within(metadata).getByText(label, { selector: 'dt' }).nextElementSibling;
    expect(field('Latitude')).toHaveTextContent('Not recorded');
    expect(field('Longitude')).toHaveTextContent('Not recorded');
    expect(field('Camera Model')).toHaveTextContent('Bushnell Core DS-4K');
    expect(field('Trigger Type')).toHaveTextContent('MOTION');
    expect(field('Ambient Temperature')).toHaveTextContent('26.0 °C');
  });

  test('incomplete metadata shows the warning with missing fields and that review can continue', () => {
    renderView();
    const warning = within(summaryCard()).getByRole('alert');
    expect(warning).toHaveTextContent('Incomplete Metadata');
    expect(warning).toHaveTextContent('Latitude not recorded');
    expect(warning).toHaveTextContent('Longitude not recorded');
    expect(warning).toHaveTextContent('You can still review this evidence.');
  });

  test('complete metadata shows no warning', () => {
    renderView(detail(5));
    expect(screen.queryByText('Incomplete Metadata')).not.toBeInTheDocument();
  });
});

describe('ClassifyEvidenceView - classification cards', () => {
  test('renders the three cards with title and description, none selected initially', () => {
    renderView();
    expect(screen.getByRole('group', { name: 'Classification' })).toBeInTheDocument();
    [
      ['Wildlife Species', /identifiable wildlife/],
      ['Suspicious Person', /suspicious activity/],
      ['Unknown', /Unable to classify the evidence with confidence/],
    ].forEach(([name, description]) => {
      expect(radio(name)).not.toBeChecked();
      expect(radio(name)).toHaveAccessibleDescription(description);
      expect(card(name).querySelector('svg')).not.toBeNull();
    });
  });

  test('clicking a card selects it, highlights it, and keeps only one selection', async () => {
    const { user } = renderView();

    await user.click(screen.getByText('Wildlife Species'));
    expect(radio('Wildlife Species')).toBeChecked();
    expect(card('Wildlife Species')).toHaveClass('selected');

    await user.click(screen.getByText(/suspicious activity/));
    expect(radio('Suspicious Person')).toBeChecked();
    expect(card('Suspicious Person')).toHaveClass('selected');
    expect(radio('Wildlife Species')).not.toBeChecked();
    expect(card('Wildlife Species')).not.toHaveClass('selected');
    expect(screen.getAllByRole('radio').filter((input) => input.checked)).toHaveLength(1);
  });

  test.each([
    ['Wildlife Species', 'WILDLIFE_SPECIES'],
    ['Suspicious Person', 'SUSPICIOUS_PERSON'],
    ['Unknown', 'UNKNOWN'],
  ])('%s maps to the backend value %s', async (name, value) => {
    const { user } = renderView();
    await user.click(radio(name));
    expect(screen.getByTestId('classification')).toHaveTextContent(value);
  });
});

describe('ClassifyEvidenceView - notes', () => {
  test('renders "Notes (optional)" with a counter starting at 0 / 500', () => {
    renderView();
    expect(notesBox()).toHaveValue('');
    expect(screen.getByText('(optional)')).toBeInTheDocument();
    expect(notesBox()).toHaveAccessibleDescription('0 / 500');
  });

  test('the counter updates while typing', async () => {
    const { user } = renderView();
    await user.type(notesBox(), 'Leopard');
    expect(notesBox()).toHaveAccessibleDescription('7 / 500');
  });

  test('input is limited to 500 characters', async () => {
    const { user } = renderView();
    expect(notesBox()).toHaveAttribute('maxLength', '500');
    await user.click(notesBox());
    await user.paste('x'.repeat(520));
    expect(notesBox().value).toHaveLength(500);
    expect(notesBox()).toHaveAccessibleDescription('500 / 500');
  });
});

describe('ClassifyEvidenceView - actions', () => {
  test('Confirm Review is disabled without a classification even when the image has loaded', () => {
    renderView(detail(3), { initialImageStatus: IMAGE_STATUS.LOADED });
    expect(confirmButton()).toBeDisabled();
  });

  test('Confirm Review stays disabled while the image has not loaded, then enables once it loads', async () => {
    const { user } = renderView();
    await user.click(radio('Unknown'));
    expect(confirmButton()).toBeDisabled();

    fireEvent.load(evidenceImage());
    expect(confirmButton()).toBeEnabled();
  });

  test('Confirm Review submits the selected classification and notes', async () => {
    const { user, onConfirm } = renderView();
    fireEvent.load(evidenceImage());
    await user.click(radio('Wildlife Species'));
    await user.type(notesBox(), 'Leopard resting on rock');
    await user.click(confirmButton());
    expect(onConfirm).toHaveBeenCalledWith({ classification: 'WILDLIFE_SPECIES', notes: 'Leopard resting on rock' });
  });

  test('Cancel returns to the queue without submitting', async () => {
    const { user, onCancel, onConfirm } = renderView();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  test('while submitting, the cards, notes and actions are locked', () => {
    renderView(detail(3), { initialImageStatus: IMAGE_STATUS.LOADED, submitting: true });
    expect(radio('Unknown')).toBeDisabled();
    expect(notesBox()).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Submitting/ })).toBeDisabled();
  });
});

describe('ClassifyEvidenceView - image failure (EF1)', () => {
  test('a failed image shows Retry and Back to Review Queue and keeps Confirm Review disabled', async () => {
    const { user, onBackToQueue } = renderView(detail(6));
    fireEvent.error(evidenceImage('IMG-WILP01-0002'));
    await user.click(radio('Wildlife Species'));

    const failure = screen.getByText('Image could not be loaded').closest('div');
    expect(within(failure).getByRole('button', { name: /Retry/ })).toBeInTheDocument();
    expect(confirmButton()).toBeDisabled();
    expect(screen.getByText('The image must load before this evidence can be reviewed.')).toBeInTheDocument();

    await user.click(within(failure).getByRole('button', { name: /Back to Review Queue/ }));
    expect(onBackToQueue).toHaveBeenCalledTimes(1);
  });

  test('Retry followed by a successful load re-enables Confirm Review', async () => {
    const { user } = renderView(detail(6));
    fireEvent.error(evidenceImage('IMG-WILP01-0002'));
    await user.click(radio('Unknown'));

    await user.click(screen.getByRole('button', { name: /Retry/ }));
    fireEvent.load(evidenceImage('IMG-WILP01-0002'));
    expect(confirmButton()).toBeEnabled();
  });
});

describe('ClassifyEvidenceView - reviewed evidence', () => {
  test('already-reviewed evidence is read-only: summary shown, no cards, notes or Confirm Review', () => {
    renderView(detail(1), { initialImageStatus: IMAGE_STATUS.LOADED });
    expect(screen.getByText('Evidence Details')).toBeInTheDocument();
    expect(summaryCard()).toHaveTextContent('IMG-YALA01-0001');
    expect(screen.queryByRole('radio')).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: /Notes/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Confirm Review/ })).not.toBeInTheDocument();
    expect(screen.getByText(/already been reviewed/)).toBeInTheDocument();
  });
});
