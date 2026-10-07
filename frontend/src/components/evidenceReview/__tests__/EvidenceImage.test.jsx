import React from 'react';
import { describe, test, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import EvidenceImage from '../EvidenceImage';

const BROKEN_URL = 'https://camera-trap-feed.invalid/CT-WILP-01/IMG-WILP01-0002.jpg';

describe('EvidenceImage', () => {
  test('shows a loading state until the image loads, then reports it as loaded', () => {
    const onStatusChange = vi.fn();
    render(<EvidenceImage src="ok.jpg" alt="Evidence IMG-1" onStatusChange={onStatusChange} />);
    expect(screen.getByRole('status')).toHaveTextContent('Loading image');

    fireEvent.load(screen.getByAltText('Evidence IMG-1'));

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.getByAltText('Evidence IMG-1')).toBeVisible();
    expect(onStatusChange).toHaveBeenLastCalledWith('loaded');
  });

  test('a broken image URL shows a clear error with Retry and Back to Review Queue', () => {
    const onStatusChange = vi.fn();
    render(<EvidenceImage src={BROKEN_URL} alt="Evidence IMG-6" onStatusChange={onStatusChange} onBackToQueue={vi.fn()} />);

    fireEvent.error(screen.getByAltText('Evidence IMG-6'));

    expect(screen.getByRole('alert')).toHaveTextContent('Image could not be loaded');
    expect(screen.getByRole('button', { name: /Retry/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Back to Review Queue/ })).toBeInTheDocument();
    expect(onStatusChange).toHaveBeenLastCalledWith('error');
  });

  test('Retry reloads the image and can recover', async () => {
    const user = userEvent.setup();
    const onStatusChange = vi.fn();
    render(<EvidenceImage src="flaky.jpg" alt="Evidence IMG-3" onStatusChange={onStatusChange} />);
    fireEvent.error(screen.getByAltText('Evidence IMG-3'));

    await user.click(screen.getByRole('button', { name: /Retry/ }));
    expect(onStatusChange).toHaveBeenLastCalledWith('loading');
    expect(screen.getByRole('status')).toHaveTextContent('Loading image');

    fireEvent.load(screen.getByAltText('Evidence IMG-3'));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(onStatusChange).toHaveBeenLastCalledWith('loaded');
  });

  test('Back to Review Queue calls the provided handler', async () => {
    const user = userEvent.setup();
    const onBackToQueue = vi.fn();
    render(<EvidenceImage src={BROKEN_URL} alt="Evidence IMG-6" onBackToQueue={onBackToQueue} />);
    fireEvent.error(screen.getByAltText('Evidence IMG-6'));

    await user.click(screen.getByRole('button', { name: /Back to Review Queue/ }));
    expect(onBackToQueue).toHaveBeenCalledTimes(1);
  });

  test('a failed thumbnail falls back to an unavailable icon without action buttons', () => {
    render(<EvidenceImage variant="thumbnail" src={BROKEN_URL} alt="Thumbnail of IMG-6" />);
    fireEvent.error(screen.getByAltText('Thumbnail of IMG-6'));

    expect(screen.getByLabelText('Image unavailable')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
