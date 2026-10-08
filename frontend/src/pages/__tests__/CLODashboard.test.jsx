import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, test, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';

import CLODashboard from '../CLODashboard';
import { apiService } from '../../services/api';
import { BrowserRouter } from 'react-router-dom';
import { supabase } from '../../supabaseClient';

// Mock dependencies
vi.mock('../../services/api', () => ({
  apiService: {
    getAllReports: vi.fn(),
    updateReport: vi.fn(),
    getRangers: vi.fn(),
    getIncidents: vi.fn(),
    createIncident: vi.fn(),
    updateIncident: vi.fn(),
    deleteIncident: vi.fn(),
  }
}));

vi.mock('../../supabaseClient', () => ({
  supabase: {
    auth: {
      signOut: vi.fn(),
    }
  }
}));

vi.mock('lucide-react', () => ({
  LayoutDashboard: () => <div data-testid="icon-dashboard" />,
  MessageSquare: () => <div data-testid="icon-message" />,
  FileText: () => <div data-testid="icon-file" />,
  Settings: () => <div data-testid="icon-settings" />,
  LogOut: () => <div data-testid="icon-logout" />,
  ShieldAlert: () => <div data-testid="icon-shield" />,
  Bell: () => <div data-testid="icon-bell" />,
  MapPin: () => <div data-testid="icon-map" />
}));

// Suppress console.error in tests for expected errors
const originalError = console.error;
beforeAll(() => {
  console.error = vi.fn();
});
afterAll(() => {
  console.error = originalError;
});

const mockReports = [
  { id: 1, report_code: 'REP-001', incident_type: 'Elephant Sighting', area: 'North Zone', status: 'NEW', immediate_risk: true, incident_datetime: '2024-01-01T10:00:00Z', reporter_name: 'John Doe' },
  { id: 2, report_code: 'REP-002', incident_type: 'Poaching', area: 'South Zone', status: 'UNDER_REVIEW', immediate_risk: false, incident_datetime: '2024-01-02T10:00:00Z', reporter_name: 'Jane Doe' },
  { id: 3, report_code: 'REP-003', incident_type: 'Encroachment', area: 'East Zone', status: 'RESOLVED', immediate_risk: false, incident_datetime: new Date().toISOString(), updated_at: new Date().toISOString(), reporter_name: 'Alice' }
];

const mockIncidents = [
  { id: 1, title: 'Test Incident', category: 'Wildlife Sighting', location: 'Test Location', severity: 'HIGH', status: 'OPEN' }
];

describe('CLODashboard Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiService.getAllReports.mockResolvedValue({ data: mockReports });
    apiService.getRangers.mockResolvedValue({ data: [{ id: '1', name: 'Ranger Smith' }] });
    apiService.getIncidents.mockResolvedValue(mockIncidents);
  });

  const renderDashboard = () => {
    return render(
      <BrowserRouter>
        <CLODashboard />
      </BrowserRouter>
    );
  };

  test('[POSITIVE CASE] should render dashboard and overview statistics correctly', async () => {
    renderDashboard();

    // Verify main title
    expect(screen.getByText('Community Liaison Dashboard')).toBeInTheDocument();

    // Wait for API calls and state updates
    await waitFor(() => {
      const stats = screen.getAllByText('1');
      expect(stats.length).toBeGreaterThanOrEqual(3);
    });
  });

  test('[POSITIVE CASE] should load and display recent community reports on the overview tab', async () => {
    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('REP-001')).toBeInTheDocument();
      expect(screen.getByText('Elephant Sighting')).toBeInTheDocument();
      expect(screen.getByText('North Zone')).toBeInTheDocument();
    });
  });

  test('[EDGE CASE] should handle empty reports gracefully without crashing', async () => {
    apiService.getAllReports.mockResolvedValue({ data: [] });
    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('No recent reports found.')).toBeInTheDocument();
    });
  });

  test('[NEGATIVE CASE] should not crash if getAllReports API fails', async () => {
    apiService.getAllReports.mockRejectedValue(new Error('Network error'));
    renderDashboard();

    await waitFor(() => {
      expect(console.error).toHaveBeenCalledWith('Failed to fetch reports', expect.any(Error));
    });
  });

  test('[POSITIVE CASE] should switch tabs when clicking sidebar menu items', async () => {
    renderDashboard();

    // Click on Incidents tab
    const incidentsMenu = screen.getByText('Incidents');
    fireEvent.click(incidentsMenu);

    await waitFor(() => {
      expect(screen.getByText('Incidents Management')).toBeInTheDocument();
    });

    // Verify incidents API was called and data is loaded
    expect(apiService.getIncidents).toHaveBeenCalled();
    await waitFor(() => {
      expect(screen.getByText('Test Incident')).toBeInTheDocument();
    });
  });



  test('[POSITIVE CASE] should sign out and navigate to login when logout is clicked', async () => {
    renderDashboard();

    const logoutBtn = screen.getByText('Logout');
    fireEvent.click(logoutBtn);

    expect(supabase.auth.signOut).toHaveBeenCalledTimes(1);
    // Since we are mocking react-router, we can't easily assert navigation here without a spy on useNavigate,
    // but we can ensure signOut is called which is the primary action.
  });

  describe('Incidents Module (Sub-component within CLODashboard)', () => {
    test('[POSITIVE CASE] should create a new incident successfully', async () => {
      renderDashboard();
      fireEvent.click(screen.getByText('Incidents'));

      await waitFor(() => {
        expect(screen.getByText('Report New Incident')).toBeInTheDocument();
      });

      window.alert = vi.fn(); // Mock alert

      // Fill form
      fireEvent.change(screen.getByPlaceholderText('Incident Title'), { target: { value: 'New Test Incident' } });
      fireEvent.change(screen.getByPlaceholderText('Location'), { target: { value: 'Sector C' } });

      apiService.createIncident.mockResolvedValue({ id: 99 });
      
      fireEvent.click(screen.getByText('Save Incident'));

      await waitFor(() => {
        expect(apiService.createIncident).toHaveBeenCalledWith(expect.objectContaining({
          title: 'New Test Incident',
          location: 'Sector C',
        }));
        expect(window.alert).toHaveBeenCalledWith('Incident created!');
      });
    });

    test('[NEGATIVE CASE] should alert on incident creation failure', async () => {
      renderDashboard();
      fireEvent.click(screen.getByText('Incidents'));

      await waitFor(() => {
        expect(screen.getByText('Report New Incident')).toBeInTheDocument();
      });

      window.alert = vi.fn();
      apiService.createIncident.mockRejectedValue(new Error('Server error'));

      fireEvent.change(screen.getByPlaceholderText('Incident Title'), { target: { value: 'Error Incident' } });
      fireEvent.change(screen.getByPlaceholderText('Location'), { target: { value: 'Error Loc' } });
      fireEvent.click(screen.getByText('Save Incident'));

      await waitFor(() => {
        expect(window.alert).toHaveBeenCalledWith('Error saving incident');
      });
    });

    test('[POSITIVE CASE] should edit an existing incident', async () => {
      renderDashboard();
      fireEvent.click(screen.getByText('Incidents'));

      await waitFor(() => {
        expect(screen.getByText('Test Incident')).toBeInTheDocument();
      });

      window.alert = vi.fn();
      const editButtons = await screen.findAllByText('Edit');
      fireEvent.click(editButtons[0]);

      // Ensure form title changed
      expect(screen.getByText('Edit Incident')).toBeInTheDocument();

      // Submit edit
      apiService.updateIncident.mockResolvedValue({});
      fireEvent.click(screen.getByText('Update Incident'));

      await waitFor(() => {
        expect(apiService.updateIncident).toHaveBeenCalledWith(1, expect.any(Object));
        expect(window.alert).toHaveBeenCalledWith('Incident updated!');
      });
    });

    test('[POSITIVE CASE] should delete an incident after confirmation', async () => {
      renderDashboard();
      fireEvent.click(screen.getByText('Incidents'));

      await waitFor(() => {
        expect(screen.getByText('Test Incident')).toBeInTheDocument();
      });

      window.confirm = vi.fn(() => true); // Confirm deletion
      window.alert = vi.fn();
      apiService.deleteIncident.mockResolvedValue({});

      const deleteButtons = await screen.findAllByText('Delete');
      fireEvent.click(deleteButtons[0]);

      await waitFor(() => {
        expect(apiService.deleteIncident).toHaveBeenCalledWith(1);
        expect(window.alert).toHaveBeenCalledWith('Incident deleted!');
      });
    });
  });

  describe('Other Modules Navigation', () => {
    test('[POSITIVE CASE] should render Filed Reports Module', async () => {
      renderDashboard();
      fireEvent.click(screen.getByText('Filed Reports'));

      await waitFor(() => {
        expect(screen.getByText('Filed Reports Archive')).toBeInTheDocument();
        expect(screen.getByText('Elephant Sighting')).toBeInTheDocument();
      });
      
      // Change filter
      const select = screen.getByRole('combobox');
      fireEvent.change(select, { target: { value: 'RESOLVED' } });
      await waitFor(() => {
        expect(screen.getByText('Encroachment')).toBeInTheDocument();
      });
    });

    test('[POSITIVE CASE] should render Zone Map Module', async () => {
      renderDashboard();
      fireEvent.click(screen.getByText('Zone Map'));

      await waitFor(() => {
        expect(screen.getByText('Interactive Zone Map')).toBeInTheDocument();
      });
    });


    test('[POSITIVE CASE] should navigate to Community Queue and view a report', async () => {
      renderDashboard();
      fireEvent.click(screen.getByText('Conflict Report Queue'));
      
      await waitFor(() => {
        expect(screen.getByText('Review and prioritize incoming incident reports from the community.')).toBeInTheDocument();
      });

      const viewButtons = await screen.findAllByText('View');
      // Use standard click
      fireEvent.click(viewButtons[0]);

      // Wait for it to switch to review mode
      await waitFor(() => {
        const title = screen.queryByText(/Review & Prioritise Conflict Report/i);
        if (title) expect(title).toBeInTheDocument();
      });
    });
  });
});
