import React from 'react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import EvidenceReviewManager from '../EvidenceReviewManager';
import { apiService } from '../../../services/api';
import {
  apiError, confirmationRequiredResult, detail, escalatedResult, previousUnknownReview, queueItems, reviewResult,
} from './fixtures';

vi.mock('../../../services/api', () => ({
  apiService: {
    getEvidenceReviewQueue: vi.fn(),
    getEvidenceDetail: vi.fn(),
    submitEvidenceReview: vi.fn(),
  },
}));

const JUSTIFICATION = 'Person carrying a rifle-shaped object at night';

const renderManager = async () => {
  const user = userEvent.setup();
  render(<EvidenceReviewManager />);
  await screen.findByRole('table');
  return user;
};

// Opens evidence from the queue and, unless told otherwise, lets its image load
const openEvidence = async (user, imageCode, evidence, { loadImage = true } = {}) => {
  apiService.getEvidenceDetail.mockResolvedValueOnce({ data: evidence });
  const action = evidence.isReviewable ? 'Review' : 'View';
  await user.click(screen.getByRole('button', { name: `${action} ${imageCode}` }));
  const image = await screen.findByAltText(`Camera-trap evidence ${imageCode}`);
  if (loadImage) fireEvent.load(image);
  return image;
};

const confirmReviewButton = () => screen.getByRole('button', { name: /Confirm Review/ });
const confirmEscalationButton = () => screen.getByRole('button', { name: /Confirm Escalation/ });

const startSuspiciousEscalation = async (user, imageCode, evidence) => {
  await openEvidence(user, imageCode, evidence);
  apiService.submitEvidenceReview.mockResolvedValueOnce({ data: confirmationRequiredResult(evidence.id) });
  await user.click(screen.getByRole('radio', { name: /Suspicious Person/ }));
  await user.click(confirmReviewButton());
  return screen.findByRole('dialog');
};

beforeEach(() => {
  vi.clearAllMocks();
  apiService.getEvidenceReviewQueue.mockResolvedValue({ data: queueItems });
});

describe('EvidenceReviewManager - classification flow', () => {
  test('loads the full queue once with status ALL', async () => {
    await renderManager();
    expect(apiService.getEvidenceReviewQueue).toHaveBeenCalledTimes(1);
    expect(apiService.getEvidenceReviewQueue).toHaveBeenCalledWith('ALL');
  });

  test('shows the evidence summary, image and metadata with "Not recorded" for missing values', async () => {
    const user = await renderManager();
    await openEvidence(user, 'IMG-YALA02-0001', detail(3));

    expect(screen.getByText('Classify Evidence')).toBeInTheDocument();
    expect(screen.getByText('Evidence Summary')).toBeInTheDocument();
    const summary = screen.getAllByRole('definition');
    const text = summary.map((node) => node.textContent);
    expect(text).toEqual(expect.arrayContaining([
      'IMG-YALA02-0001', 'CT-YALA-02', 'Katagamuwa Sanctuary Boundary Fence, Yala National Park (Ruhuna)',
      '02 Oct 2026, 18:35', 'Bushnell Core DS-4K', 'MOTION', '26.0 °C', 'Unreviewed',
    ]));
    expect(text.filter((value) => value === 'Not recorded')).toHaveLength(2);
  });

  test('incomplete metadata shows a warning listing missing fields but does not block review', async () => {
    const user = await renderManager();
    await openEvidence(user, 'IMG-YALA02-0001', detail(3));

    const warning = screen.getByRole('alert');
    expect(warning).toHaveTextContent('Incomplete Metadata');
    expect(warning).toHaveTextContent('Latitude not recorded');
    expect(warning).toHaveTextContent('Longitude not recorded');
    await user.click(screen.getByRole('radio', { name: /Wildlife Species/ }));
    expect(confirmReviewButton()).toBeEnabled();
  });

  test('Confirm Review stays disabled until a classification is selected', async () => {
    const user = await renderManager();
    await openEvidence(user, 'IMG-WILP01-0001', detail(5));
    expect(confirmReviewButton()).toBeDisabled();
    await user.click(screen.getByRole('radio', { name: /Unknown/ }));
    expect(confirmReviewButton()).toBeEnabled();
  });

  test('Cancel returns to the queue without any review request', async () => {
    const user = await renderManager();
    await openEvidence(user, 'IMG-YALA02-0001', detail(3));
    await user.click(screen.getByRole('radio', { name: /Wildlife Species/ }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(await screen.findByText('Camera-Trap Evidence Review')).toBeInTheDocument();
    expect(apiService.submitEvidenceReview).not.toHaveBeenCalled();
  });

  test('Wildlife Species review sends classification and notes, then shows Reviewed with no alert', async () => {
    const user = await renderManager();
    await openEvidence(user, 'IMG-YALA02-0001', detail(3));
    apiService.submitEvidenceReview.mockResolvedValueOnce({
      data: reviewResult(3, { classification: 'WILDLIFE_SPECIES', reviewStatus: 'REVIEWED', review: { id: 12, notes: 'Leopard resting on rock' } }),
    });

    await user.click(screen.getByRole('radio', { name: /Wildlife Species/ }));
    await user.type(screen.getByRole('textbox', { name: /Notes/ }), 'Leopard resting on rock');
    await user.click(confirmReviewButton());

    expect(apiService.submitEvidenceReview).toHaveBeenCalledWith(3, { classification: 'WILDLIFE_SPECIES', notes: 'Leopard resting on rock' });
    expect(await screen.findByText('Review Completed')).toBeInTheDocument();
    expect(screen.getByText('Reviewed')).toBeInTheDocument();
    expect(screen.getByText(/No threat alert was created/)).toBeInTheDocument();
    expect(screen.getByText('Leopard resting on rock')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /View Alert/ })).not.toBeInTheDocument();
  });

  test('Unknown review shows Needs Further Review, keeps it for secondary review, and Back to Review Queue refreshes', async () => {
    const user = await renderManager();
    await openEvidence(user, 'IMG-YALA02-0001', detail(3));
    apiService.submitEvidenceReview.mockResolvedValueOnce({
      data: reviewResult(3, { classification: 'UNKNOWN', reviewStatus: 'NEEDS_FURTHER_REVIEW' }),
    });

    await user.click(screen.getByRole('radio', { name: /Unknown/ }));
    await user.click(confirmReviewButton());

    expect(apiService.submitEvidenceReview).toHaveBeenCalledWith(3, { classification: 'UNKNOWN', notes: '' });
    expect(await screen.findByText('Needs Further Review')).toBeInTheDocument();
    expect(screen.getByText(/remains in the review queue for secondary review/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Back to Review Queue/ }));
    await waitFor(() => expect(apiService.getEvidenceReviewQueue).toHaveBeenCalledTimes(2));
  });

  test('NEEDS_FURTHER_REVIEW evidence is marked as a secondary review and shows the previous review', async () => {
    const user = await renderManager();
    await openEvidence(user, 'IMG-WILP01-0001', detail(5, { reviews: [previousUnknownReview] }));

    expect(screen.getByText(/Secondary review: this evidence was previously classified as Unknown/)).toBeInTheDocument();
    expect(screen.getByText('Previous review')).toBeInTheDocument();
    expect(screen.getByText('Notes: Indistinct shape behind foliage')).toBeInTheDocument();
  });

  test('already-reviewed evidence opens read-only with its review and linked threat alert', async () => {
    const user = await renderManager();
    await user.click(screen.getByRole('tab', { name: /^Reviewed/ }));
    await openEvidence(user, 'IMG-YALA01-0002', detail(2, {
      reviews: [{ id: 3, classification: 'SUSPICIOUS_PERSON', escalationJustification: 'Rifle seen', createdAt: '2026-10-07T03:00:00+00:00' }],
      threatAlerts: [{ id: 1, evidenceReviewId: 3, cameraTrapImageId: 2, status: 'OPEN' }],
    }));

    expect(screen.getByText('Evidence Details')).toBeInTheDocument();
    expect(screen.queryByRole('radio')).not.toBeInTheDocument();
    expect(screen.getByText(/already been reviewed/)).toBeInTheDocument();
    expect(screen.getByText('Threat Alert #1 (OPEN)')).toBeInTheDocument();
  });
});

describe('EvidenceReviewManager - image loading failure', () => {
  test('a failed image blocks Confirm Review and Back to Review Queue returns without a review', async () => {
    const user = await renderManager();
    const image = await openEvidence(user, 'IMG-WILP01-0002', detail(6), { loadImage: false });
    fireEvent.error(image);

    expect(screen.getByText('Image could not be loaded')).toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: /Wildlife Species/ }));
    expect(confirmReviewButton()).toBeDisabled();
    expect(screen.getByText('The image must load before this evidence can be reviewed.')).toBeInTheDocument();

    await user.click(within(screen.getByText('Image could not be loaded').closest('div')).getByRole('button', { name: /Back to Review Queue/ }));
    expect(await screen.findByText('Camera-Trap Evidence Review')).toBeInTheDocument();
    expect(apiService.submitEvidenceReview).not.toHaveBeenCalled();
  });

  test('Retry after an image failure re-enables review once the image loads', async () => {
    const user = await renderManager();
    const image = await openEvidence(user, 'IMG-WILP01-0002', detail(6), { loadImage: false });
    fireEvent.error(image);
    await user.click(screen.getByRole('radio', { name: /Unknown/ }));

    await user.click(screen.getByRole('button', { name: /Retry/ }));
    fireEvent.load(screen.getByAltText('Camera-trap evidence IMG-WILP01-0002'));
    expect(confirmReviewButton()).toBeEnabled();
  });
});

describe('EvidenceReviewManager - suspicious escalation', () => {
  test('first Suspicious Person submission is unconfirmed and opens the escalation confirmation', async () => {
    const user = await renderManager();
    const dialog = await startSuspiciousEscalation(user, 'IMG-WILP01-0001', detail(5));

    expect(apiService.submitEvidenceReview).toHaveBeenCalledTimes(1);
    expect(apiService.submitEvidenceReview).toHaveBeenCalledWith(5, { classification: 'SUSPICIOUS_PERSON', notes: '' });
    expect(within(dialog).getByText('Escalate Suspicious Evidence')).toBeInTheDocument();
    expect(within(dialog).getByText(/Confirming will create a Threat Alert/)).toBeInTheDocument();
    expect(within(dialog).getByText('IMG-WILP01-0001')).toBeInTheDocument();
    expect(within(dialog).getByText('HIGH')).toBeInTheDocument();
    expect(within(dialog).getByText('Park Anti-Poaching Response Team')).toBeInTheDocument();
    expect(within(dialog).getByText(/shown for information only and are not recorded/)).toBeInTheDocument();
  });

  test('Confirm Escalation requires a non-whitespace justification', async () => {
    const user = await renderManager();
    await startSuspiciousEscalation(user, 'IMG-WILP01-0001', detail(5));

    expect(confirmEscalationButton()).toBeDisabled();
    await user.type(screen.getByRole('textbox', { name: /Escalation Justification/ }), '    ');
    expect(confirmEscalationButton()).toBeDisabled();
    await user.type(screen.getByRole('textbox', { name: /Escalation Justification/ }), 'Rifle visible');
    expect(confirmEscalationButton()).toBeEnabled();
  });

  test('incomplete metadata is repeated in the modal and must be acknowledged before escalation', async () => {
    const user = await renderManager();
    const dialog = await startSuspiciousEscalation(user, 'IMG-YALA02-0001', detail(3));

    expect(within(dialog).getByText('Incomplete Metadata')).toBeInTheDocument();
    await user.type(within(dialog).getByRole('textbox', { name: /Escalation Justification/ }), JUSTIFICATION);
    expect(confirmEscalationButton()).toBeDisabled();
    await user.click(within(dialog).getByRole('checkbox', { name: 'I have reviewed the incomplete metadata' }));
    expect(confirmEscalationButton()).toBeEnabled();
  });

  test('Cancel closes the escalation without a second request and nothing is escalated', async () => {
    const user = await renderManager();
    await startSuspiciousEscalation(user, 'IMG-WILP01-0001', detail(5));
    await user.type(screen.getByRole('textbox', { name: /Escalation Justification/ }), JUSTIFICATION);

    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByText('Classify Evidence')).toBeInTheDocument();
    expect(apiService.submitEvidenceReview).toHaveBeenCalledTimes(1);
  });

  test('confirmed escalation sends only the backend contract fields and shows the linked Threat Alert', async () => {
    const user = await renderManager();
    await startSuspiciousEscalation(user, 'IMG-WILP01-0001', detail(5));
    apiService.submitEvidenceReview.mockResolvedValueOnce({ data: escalatedResult(5, JUSTIFICATION) });

    await user.type(screen.getByRole('textbox', { name: /Escalation Justification/ }), JUSTIFICATION);
    await user.click(confirmEscalationButton());

    expect(apiService.submitEvidenceReview).toHaveBeenLastCalledWith(5, {
      classification: 'SUSPICIOUS_PERSON', notes: '', escalationConfirmed: true, escalationJustification: JUSTIFICATION,
    });
    expect(await screen.findByText('Review Completed')).toBeInTheDocument();
    expect(screen.getByText('Reviewed – Escalated')).toBeInTheDocument();
    expect(screen.getByText('#3')).toBeInTheDocument();
    expect(screen.getByText('Linked to Image')).toBeInTheDocument();
  });

  test('View Alert shows the alert details returned by the review', async () => {
    const user = await renderManager();
    await startSuspiciousEscalation(user, 'IMG-WILP01-0001', detail(5));
    apiService.submitEvidenceReview.mockResolvedValueOnce({ data: escalatedResult(5, JUSTIFICATION) });
    await user.type(screen.getByRole('textbox', { name: /Escalation Justification/ }), JUSTIFICATION);
    await user.click(confirmEscalationButton());

    await user.click(await screen.findByRole('button', { name: /View Alert/ }));
    const details = screen.getByRole('region', { name: 'Threat alert details' });
    expect(within(details).getByText('Threat Alert #3')).toBeInTheDocument();
    expect(within(details).getByText('OPEN')).toBeInTheDocument();
    expect(within(details).getByText('IMG-WILP01-0001 (image #5)')).toBeInTheDocument();
    expect(within(details).getByText(JUSTIFICATION)).toBeInTheDocument();
  });
});

describe('EvidenceReviewManager - API error handling', () => {
  test('400 on escalation is shown inside the modal', async () => {
    const user = await renderManager();
    await startSuspiciousEscalation(user, 'IMG-WILP01-0001', detail(5));
    apiService.submitEvidenceReview.mockRejectedValueOnce(
      apiError(400, 'An escalation justification is required to confirm escalation of suspicious evidence.'),
    );
    await user.type(screen.getByRole('textbox', { name: /Escalation Justification/ }), JUSTIFICATION);
    await user.click(confirmEscalationButton());

    expect(await within(screen.getByRole('dialog')).findByRole('alert'))
      .toHaveTextContent('An escalation justification is required');
  });

  test('401 while loading the queue shows a session-expired message', async () => {
    apiService.getEvidenceReviewQueue.mockRejectedValueOnce(apiError(401, 'Authentication required.'));
    render(<EvidenceReviewManager />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Your session has expired or you are not signed in.');
  });

  test('403 shows that UC02 is restricted to Wildlife Officers and Retry reloads', async () => {
    const user = userEvent.setup();
    apiService.getEvidenceReviewQueue.mockRejectedValueOnce(apiError(403, 'Access denied'));
    render(<EvidenceReviewManager />);
    expect(await screen.findByRole('alert')).toHaveTextContent('restricted to Wildlife Officers');

    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByRole('table')).toBeInTheDocument();
    expect(apiService.getEvidenceReviewQueue).toHaveBeenCalledTimes(2);
  });

  test('404 when opening evidence shows not found with Back to Review Queue', async () => {
    const user = await renderManager();
    apiService.getEvidenceDetail.mockRejectedValueOnce(apiError(404, 'Camera-trap evidence not found.'));
    await user.click(screen.getByRole('button', { name: 'Review IMG-YALA02-0001' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('could not be found');
    await user.click(screen.getByRole('button', { name: /Back to Review Queue/ }));
    expect(await screen.findByRole('table')).toBeInTheDocument();
  });

  test('409 returns to a refreshed queue explaining the evidence was already reviewed', async () => {
    const user = await renderManager();
    await openEvidence(user, 'IMG-YALA02-0001', detail(3));
    apiService.submitEvidenceReview.mockRejectedValueOnce(
      apiError(409, 'Evidence IMG-YALA02-0001 has already been reviewed (REVIEWED) and cannot be reviewed again.'),
    );
    await user.click(screen.getByRole('radio', { name: /Wildlife Species/ }));
    await user.click(confirmReviewButton());

    expect(await screen.findByText(/has already been reviewed/)).toBeInTheDocument();
    expect(screen.getByText('Camera-Trap Evidence Review')).toBeInTheDocument();
    await waitFor(() => expect(apiService.getEvidenceReviewQueue).toHaveBeenCalledTimes(2));
  });

  test('a network failure while submitting keeps the officer on the review with a clear message', async () => {
    const user = await renderManager();
    await openEvidence(user, 'IMG-YALA02-0001', detail(3));
    apiService.submitEvidenceReview.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    await user.click(screen.getByRole('radio', { name: /Unknown/ }));
    await user.click(confirmReviewButton());

    expect(await screen.findByText(/Unable to reach the evidence review service/)).toBeInTheDocument();
    expect(screen.getByText('Classify Evidence')).toBeInTheDocument();
    expect(confirmReviewButton()).toBeEnabled();
  });
});
