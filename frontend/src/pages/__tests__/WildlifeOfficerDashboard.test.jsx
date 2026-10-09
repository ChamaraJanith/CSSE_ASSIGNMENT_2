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

  test('Review Queue navigation renders the UC02 review queue instead of the under-construction placeholder', async () => {
    const user = renderDashboard();
    await user.click(screen.getByText('Review Queue'));

    expect(await screen.findByText('Camera-Trap Evidence Review')).toBeInTheDocument();
    expect(apiService.getEvidenceReviewQueue).toHaveBeenCalledWith('ALL');
    expect(screen.queryByText('This module is under construction.')).not.toBeInTheDocument();
  });

  test('existing shell navigation is unchanged: Overview by default and other modules still under construction', async () => {
    const user = renderDashboard();
    expect(screen.getByText('Wildlife Officer Overview')).toBeInTheDocument();
    expect(apiService.getEvidenceReviewQueue).not.toHaveBeenCalled();

    await user.click(screen.getByText('Settings'));
    expect(screen.getByText('This module is under construction.')).toBeInTheDocument();
  });

  test('shell shows the Wildlife Officer title and role, with the active item tracking navigation', async () => {
    const user = renderDashboard();
    expect(screen.getByText('Wildlife Officer Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Wildlife Officer')).toBeInTheDocument();
    expect(screen.queryByText('Ranger Dashboard')).not.toBeInTheDocument();
    expect(screen.getByText('Dashboard').closest('li')).toHaveClass('active');

    await user.click(screen.getByText('Review Queue'));
    expect(screen.getByText('Review Queue').closest('li')).toHaveClass('active');
    expect(screen.getByText('Dashboard').closest('li')).not.toHaveClass('active');
  });
});
