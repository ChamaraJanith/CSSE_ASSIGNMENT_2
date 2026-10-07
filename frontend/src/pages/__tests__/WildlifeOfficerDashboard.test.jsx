import React from 'react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import WildlifeOfficerDashboard from '../WildlifeOfficerDashboard';
import { apiService } from '../../services/api';

vi.mock('../../supabaseClient', () => ({
  supabase: { auth: { getUser: vi.fn(), signOut: vi.fn() } },
}));

vi.mock('../../services/api', () => ({
  apiService: {
    getAllReports: vi.fn(),
    getEvidenceReviewQueue: vi.fn(),
    getEvidenceDetail: vi.fn(),
    submitEvidenceReview: vi.fn(),
  },
}));

const renderDashboard = () => {
  render(<MemoryRouter><WildlifeOfficerDashboard /></MemoryRouter>);
  return userEvent.setup();
};

describe('WildlifeOfficerDashboard - UC02 integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiService.getEvidenceReviewQueue.mockResolvedValue({ data: [] });
  });

  test('Evidence Review navigation renders the UC02 review queue instead of the under-construction placeholder', async () => {
    const user = renderDashboard();
    await user.click(screen.getByText('Evidence Review'));

    expect(await screen.findByText('Camera-Trap Evidence Review')).toBeInTheDocument();
    expect(apiService.getEvidenceReviewQueue).toHaveBeenCalledWith('ALL');
    expect(screen.queryByText('This module is under construction.')).not.toBeInTheDocument();
  });

  test('existing shell navigation is unchanged: Overview by default and other modules still under construction', async () => {
    const user = renderDashboard();
    expect(screen.getByText('Ranger Overview')).toBeInTheDocument();
    expect(apiService.getEvidenceReviewQueue).not.toHaveBeenCalled();

    await user.click(screen.getByText('Settings'));
    expect(screen.getByText('This module is under construction.')).toBeInTheDocument();
  });
});
