import React from 'react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MonitoringRulesManager from '../MonitoringRulesManager';
import { apiService } from '../../../services/api';
import {
  EXISTING_RULES, OPTIONS, PARK, REFERENCE, RISK_ZONES, RULES_ALL_STATUSES, UDAWALAWE_PARK, UDAWALAWE_REFERENCE,
  UDAWALAWE_ZONES, UPDATED_AT, WILPATTU_PARK, WILPATTU_REFERENCE, WILPATTU_ZONES, apiError, createResponse, createdRule,
  deferred, invalidResult, ruleInZone, validResult,
} from './fixtures';

vi.mock('../../../services/api', () => ({
  apiService: {
    getMonitoringRuleReference: vi.fn(),
    getMonitoringRules: vi.fn(),
    validateMonitoringRule: vi.fn(),
    createMonitoringRule: vi.fn(),
    updateMonitoringRule: vi.fn(),
    activateMonitoringRule: vi.fn(),
    deactivateMonitoringRule: vi.fn(),
  },
}));

// Leaflet cannot render in jsdom; the stub exposes the props the form passes to the map
vi.mock('../RiskZoneMap', () => ({
  default: ({ selectedZone, riskZones, parkName }) => (
    <div
      data-testid="risk-zone-map"
      data-zone-id={selectedZone.id}
      data-zone-code={selectedZone.zoneCode}
      data-center={`${selectedZone.centerLat},${selectedZone.centerLng}`}
      data-radius-km={selectedZone.radiusKm}
      data-zone-codes={riskZones.map((zone) => zone.zoneCode).join(',')}
      data-park-name={parkName}
    />
  ),
}));

// ---------- helpers ----------

const renderManager = async ({ parkId = PARK.id, parkName = PARK.name } = {}) => {
  const user = userEvent.setup();
  render(<MonitoringRulesManager parkId={parkId} parkName={parkName} />);
  const createButton = await screen.findByRole('button', { name: /Create New Rule/ });
  await waitFor(() => expect(createButton).toBeEnabled());
  return user;
};

const hazardSelect = () => screen.getByLabelText(/Wildlife Hazard \/ Species/);
const zoneSelect = () => screen.getByLabelText(/^Risk Zone/);
const nextButton = () => screen.getByRole('button', { name: /^Next/ });
const submitButton = () => screen.getByRole('button', { name: /Submit for Validation/ });

// Value shown next to a <dt> label inside a container
const valueOf = (container, label) => within(container).getByText(label, { selector: 'dt' }).nextElementSibling.textContent;

const startRule = async (user) => {
  await user.click(screen.getByRole('button', { name: /Create New Rule/ }));
  await screen.findByText('Step 1 of 3');
};

const completeStep1 = async (user, { hazard = 'POACHING_SNARING', zone = '2' } = {}) => {
  await user.selectOptions(hazardSelect(), hazard);
  await user.selectOptions(zoneSelect(), zone);
  await user.click(nextButton());
  await screen.findByText('Step 2 of 3');
};

const completeStep2 = async (user, {
  priority = 'High', recipients = ['Wildlife Officer', 'Park Manager'], response = true, notes = '',
} = {}) => {
  if (priority) await user.click(screen.getByRole('radio', { name: priority }));
  for (const recipient of recipients) await user.click(screen.getByRole('checkbox', { name: recipient }));
  if (response) await user.selectOptions(screen.getByLabelText(/Response Behaviour/), 'PLACEHOLDER_RESPONSE');
  if (notes) await user.type(screen.getByLabelText(/Additional Notes/), notes);
};

const reachReview = async (user, step2 = {}) => {
  await startRule(user);
  await completeStep1(user);
  await completeStep2(user, step2);
  await user.click(submitButton());
  await screen.findByText('Step 3 of 3');
};

const ruleDetails = () => screen.getByRole('region', { name: 'Rule Details' });
const ruleInformation = () => screen.getByRole('region', { name: 'Rule Information' });

// What the backend returns from /validate for the default happy-path configuration
const VALIDATED_RULE = validResult({
  parkId: 1, hazardType: 'POACHING_SNARING', riskZoneId: 2, alertPriority: 'HIGH',
  notificationRecipients: ['wildlife_officer', 'park_manager'], responseBehaviour: 'PLACEHOLDER_RESPONSE', notes: '',
}).data.rule;

beforeEach(() => {
  vi.clearAllMocks();
  apiService.getMonitoringRuleReference.mockResolvedValue({ data: REFERENCE });
  apiService.getMonitoringRules.mockResolvedValue({ data: [] });
  apiService.validateMonitoringRule.mockImplementation(async (payload) => validResult(payload));
});

// ---------- list & selected park ----------

describe('MonitoringRulesManager - rules list and selected park', () => {
  test('loads reference data and rules for the park chosen on the dashboard, without a second park selector', async () => {
    await renderManager({ parkId: 2, parkName: 'Wilpattu National Park' });

    expect(apiService.getMonitoringRuleReference).toHaveBeenCalledWith(2);
    expect(apiService.getMonitoringRules).toHaveBeenCalledWith(2);
    expect(screen.getByRole('status', { name: 'Selected park' })).toHaveTextContent('Wilpattu National Park');
    expect(screen.queryByRole('combobox')).toBeNull();
  });

  test('lists existing rules with reference labels and filters them by status tab', async () => {
    apiService.getMonitoringRules.mockResolvedValue({ data: EXISTING_RULES });
    const user = await renderManager();

    const rows = await screen.findAllByRole('row');
    expect(rows).toHaveLength(3);
    expect(rows[1]).toHaveTextContent('#12');
    expect(rows[1]).toHaveTextContent('Poaching & Snaring');
    expect(rows[1]).toHaveTextContent('RZ-YALA-01 – Northern River Basin Buffer');
    expect(rows[1]).toHaveTextContent('Park Manager, Wildlife Officer');
    expect(rows[1]).toHaveTextContent('Active');
    expect(rows[2]).toHaveTextContent('Elephant Crop Raiding & Fence Breaches');
    expect(rows[2]).toHaveTextContent('Draft');

    await user.click(screen.getByRole('tab', { name: /Draft/ }));
    expect(screen.getAllByRole('row')).toHaveLength(2);
    expect(screen.getAllByRole('row')[1]).toHaveTextContent('#11');
  });

  test('shows an empty state when the park has no rules', async () => {
    await renderManager();
    expect(screen.getByText('No monitoring rules have been configured for this park yet.')).toBeInTheDocument();
  });

  test('shows a safe error with Retry when the rules cannot be loaded', async () => {
    apiService.getMonitoringRules.mockRejectedValueOnce(apiError(500, 'An unexpected error occurred while processing the monitoring rule request.'));
    const user = await renderManager();

    expect(await screen.findByRole('alert')).toHaveTextContent('An unexpected error occurred');
    await user.click(screen.getByRole('button', { name: /^Retry$/ }));
    await waitFor(() => expect(apiService.getMonitoringRules).toHaveBeenCalledTimes(2));
  });
});

// ---------- Step 1 ----------

describe('MonitoringRulesManager - Step 1: Hazard and Risk Zone', () => {
  test('shows the Step 1 heading and the selected park', async () => {
    const user = await renderManager();
    await startRule(user);

    expect(screen.getByText('Create Monitoring Rule')).toBeInTheDocument();
    expect(screen.getByText('Step 1 of 3')).toBeInTheDocument();
    const step1 = screen.getByRole('region', { name: 'Hazard and Risk Zone' });
    const step1Header = within(step1).getByRole('heading', { name: 'Hazard and Risk Zone' }).parentElement;
    expect(step1Header).toHaveTextContent(PARK.name);
  });

  test('renders the hazard / species options from the reference data', async () => {
    const user = await renderManager();
    await startRule(user);

    const optionLabels = within(hazardSelect()).getAllByRole('option').map((option) => option.textContent);
    expect(optionLabels).toEqual(['Select hazard / species', ...OPTIONS.hazardTypes.map((option) => option.label)]);
  });

  test('selecting a hazard updates the form and the About this hazard information', async () => {
    const user = await renderManager();
    await startRule(user);

    expect(screen.getByText('Select a hazard or species to see its details.')).toBeInTheDocument();
    await user.selectOptions(hazardSelect(), 'POACHING_SNARING');

    expect(hazardSelect()).toHaveValue('POACHING_SNARING');
    const about = screen.getByText('About this hazard').parentElement;
    expect(valueOf(about, 'Hazard / Species')).toBe('Poaching & Snaring');
    expect(valueOf(about, 'Reference code')).toBe('POACHING_SNARING');
  });

  test('selecting a risk zone updates the form and shows its code, name, park, severity and primary threat', async () => {
    const user = await renderManager();
    await startRule(user);

    await user.selectOptions(zoneSelect(), '2');

    expect(zoneSelect()).toHaveValue('2');
    const zoneInfo = screen.getByText('Zone Information').parentElement;
    expect(valueOf(zoneInfo, 'Zone')).toBe('RZ-YALA-02 – Katagamuwa Sanctuary Boundary');
    expect(valueOf(zoneInfo, 'Park')).toBe(PARK.name);
    expect(valueOf(zoneInfo, 'Severity')).toBe('HIGH');
    expect(valueOf(zoneInfo, 'Primary threat')).toBe('Elephant Crop Raiding & Fence Breaches');
  });

  test('Next stays disabled until both a hazard and a risk zone are selected, then opens Step 2', async () => {
    const user = await renderManager();
    await startRule(user);

    expect(nextButton()).toBeDisabled();
    await user.selectOptions(hazardSelect(), 'POACHING_SNARING');
    expect(nextButton()).toBeDisabled();
    await user.selectOptions(zoneSelect(), '2');
    expect(nextButton()).toBeEnabled();

    await user.click(nextButton());
    expect(await screen.findByText('Step 2 of 3')).toBeInTheDocument();
  });

  test('a park without risk zones explains why no rule can be configured', async () => {
    apiService.getMonitoringRuleReference.mockResolvedValue({ data: { ...REFERENCE, riskZones: [] } });
    const user = await renderManager();
    await startRule(user);

    expect(screen.getByText(/No risk zones are registered for Yala National Park/)).toBeInTheDocument();
    expect(zoneSelect()).toBeDisabled();
    expect(nextButton()).toBeDisabled();
  });

  test('a backend risk-zone error returns to Step 1, marks the field invalid and focuses it', async () => {
    apiService.validateMonitoringRule.mockResolvedValueOnce(invalidResult({
      errors: [{ field: 'riskZoneId', code: 'ZONE_NOT_IN_PARK', message: 'The selected risk zone does not belong to the selected park.' }],
    }));
    const user = await renderManager();
    await startRule(user);
    await completeStep1(user);
    await completeStep2(user);
    await user.click(submitButton());

    expect(await screen.findByText('Step 1 of 3')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Risk Zone: The selected risk zone does not belong to the selected park.');
    expect(zoneSelect()).toHaveAttribute('aria-invalid', 'true');
    await waitFor(() => expect(zoneSelect()).toHaveFocus());
  });
});

// ---------- Step 1: Park Map / Risk Zone ----------

describe('MonitoringRulesManager - Step 1: Park Map / Risk Zone', () => {
  const MAP_PROMPT = 'Select a hazard and a risk zone to view it on the map.';
  const riskZoneMap = () => screen.queryByTestId('risk-zone-map');

  test('shows the empty-state prompt and no map until both a hazard and a risk zone are selected', async () => {
    const user = await renderManager();
    await startRule(user);

    const panel = screen.getByRole('region', { name: 'Park map and risk zone' });
    expect(within(panel).getByText(MAP_PROMPT)).toBeInTheDocument();
    expect(riskZoneMap()).toBeNull();

    await user.selectOptions(hazardSelect(), 'POACHING_SNARING');
    expect(riskZoneMap()).toBeNull();

    await user.selectOptions(hazardSelect(), '');
    await user.selectOptions(zoneSelect(), '1');
    expect(riskZoneMap()).toBeNull();
    expect(within(panel).getByText(MAP_PROMPT)).toBeInTheDocument();
  });

  test("shows the map with the selected zone and the park's zones once both are selected", async () => {
    const user = await renderManager();
    await startRule(user);

    await user.selectOptions(hazardSelect(), 'POACHING_SNARING');
    await user.selectOptions(zoneSelect(), '1');

    const map = riskZoneMap();
    expect(map).toHaveAttribute('data-zone-id', '1');
    expect(map).toHaveAttribute('data-zone-code', 'RZ-YALA-01');
    expect(map).toHaveAttribute('data-center', '6.4128,81.5342');
    expect(map).toHaveAttribute('data-radius-km', '3.2');
    expect(map).toHaveAttribute('data-zone-codes', 'RZ-YALA-01,RZ-YALA-02');
    expect(map).toHaveAttribute('data-park-name', PARK.name);
    expect(screen.queryByText(MAP_PROMPT)).toBeNull();
    // Zone Information is still shown next to the map
    expect(valueOf(screen.getByText('Zone Information').parentElement, 'Zone')).toBe('RZ-YALA-01 – Northern River Basin Buffer');
  });

  test('changing the risk zone updates the map to the newly selected zone', async () => {
    const user = await renderManager();
    await startRule(user);
    await user.selectOptions(hazardSelect(), 'POACHING_SNARING');
    await user.selectOptions(zoneSelect(), '1');

    await user.selectOptions(zoneSelect(), '2');

    expect(screen.getAllByTestId('risk-zone-map')).toHaveLength(1);
    expect(riskZoneMap()).toHaveAttribute('data-zone-code', 'RZ-YALA-02');
    expect(riskZoneMap()).toHaveAttribute('data-center', '6.3845,81.487');
    expect(riskZoneMap()).toHaveAttribute('data-radius-km', '2.8');
  });

  test("uses the selected park's own zone coordinates (Wilpattu), with no Yala fallback", async () => {
    apiService.getMonitoringRuleReference.mockResolvedValue({ data: WILPATTU_REFERENCE });
    const user = await renderManager({ parkId: WILPATTU_PARK.id, parkName: WILPATTU_PARK.name });
    await startRule(user);

    expect(within(zoneSelect()).queryByText(/RZ-YALA/)).toBeNull();
    await user.selectOptions(hazardSelect(), 'LEOPARD_FEEDING_GROUND_INCURSION');
    await user.selectOptions(zoneSelect(), '6');

    const map = riskZoneMap();
    expect(apiService.getMonitoringRuleReference).toHaveBeenCalledWith(WILPATTU_PARK.id);
    expect(map).toHaveAttribute('data-zone-code', 'RZ-WILP-02');
    expect(map).toHaveAttribute('data-center', '8.421,80.062');
    expect(map).toHaveAttribute('data-radius-km', '2.5');
    expect(map).toHaveAttribute('data-zone-codes', 'RZ-WILP-01,RZ-WILP-02');
    expect(map).toHaveAttribute('data-park-name', WILPATTU_PARK.name);
    expect(map.getAttribute('data-zone-codes')).not.toMatch(/YALA/);
  });

  test('Step 2 and Review do not show the Step 1 map panel, and it returns with the kept zone on Edit', async () => {
    const user = await renderManager();
    await startRule(user);
    await completeStep1(user);
    expect(riskZoneMap()).toBeNull();
    expect(screen.queryByRole('region', { name: 'Park map and risk zone' })).toBeNull();

    await completeStep2(user);
    await user.click(submitButton());
    await screen.findByText('Step 3 of 3');
    // Review has its own Risk Zone Map card instead of the Step 1 panel
    expect(screen.queryByRole('region', { name: 'Park map and risk zone' })).toBeNull();
    expect(within(screen.getByRole('region', { name: 'Risk Zone Map' })).getByTestId('risk-zone-map')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Edit' }));
    await screen.findByText('Step 1 of 3');
    expect(riskZoneMap()).toHaveAttribute('data-zone-code', 'RZ-YALA-02');
  });
});

// ---------- Step 2 ----------

describe('MonitoringRulesManager - Step 2: Priority & Notifications', () => {
  const openStep2 = async () => {
    const user = await renderManager();
    await startRule(user);
    await completeStep1(user);
    return user;
  };

  test('shows the Step 2 heading', async () => {
    await openStep2();
    expect(screen.getByText('Step 2 of 3')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Priority & Notifications' })).toBeInTheDocument();
  });

  test('shows the alert priorities in the order Low, Medium, High, Critical', async () => {
    await openStep2();
    const priorities = within(screen.getByRole('group', { name: /Alert Priority/ })).getAllByRole('radio');
    expect(priorities.map((radio) => radio.closest('label').textContent)).toEqual(['Low', 'Medium', 'High', 'Critical']);
    expect(priorities.map((radio) => radio.value)).toEqual(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);
  });

  test('selecting Medium sends alertPriority MEDIUM', async () => {
    const user = await openStep2();
    await completeStep2(user, { priority: 'Medium' });
    await user.click(submitButton());
    expect(apiService.validateMonitoringRule).toHaveBeenCalledWith(expect.objectContaining({ alertPriority: 'MEDIUM' }));
  });

  test('renders every backend recipient and keeps selection and deselection in the form', async () => {
    const user = await openStep2();
    const recipients = within(screen.getByRole('group', { name: /Notification Recipients/ })).getAllByRole('checkbox');
    expect(recipients.map((box) => box.closest('label').textContent)).toEqual(OPTIONS.recipientRoles.map((role) => role.label));

    await user.click(screen.getByRole('checkbox', { name: 'Park Manager' }));
    await user.click(screen.getByRole('checkbox', { name: 'Community Liaison Officer' }));
    await user.click(screen.getByRole('checkbox', { name: 'Park Manager' }));
    expect(screen.getByRole('checkbox', { name: 'Park Manager' })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Community Liaison Officer' })).toBeChecked();

    await completeStep2(user, { recipients: [] });
    await user.click(submitButton());
    expect(apiService.validateMonitoringRule).toHaveBeenCalledWith(
      expect.objectContaining({ notificationRecipients: ['community_liaison_officer'] }),
    );
  });

  test('response behaviour offers the backend option and notes can be entered', async () => {
    const user = await openStep2();
    const response = screen.getByLabelText(/Response Behaviour/);
    expect(within(response).getAllByRole('option').map((option) => option.value)).toEqual(['', 'PLACEHOLDER_RESPONSE']);

    await user.selectOptions(response, 'PLACEHOLDER_RESPONSE');
    await user.type(screen.getByLabelText(/Additional Notes/), 'Night patrol focus');
    expect(response).toHaveValue('PLACEHOLDER_RESPONSE');
    expect(screen.getByLabelText(/Additional Notes/)).toHaveValue('Night patrol focus');
  });

  test('Back returns to Step 1 and every entered value is kept', async () => {
    const user = await openStep2();
    await completeStep2(user, { notes: 'Night patrol focus' });

    await user.click(screen.getByRole('button', { name: /^Back$/ }));
    expect(await screen.findByText('Step 1 of 3')).toBeInTheDocument();
    expect(hazardSelect()).toHaveValue('POACHING_SNARING');
    expect(zoneSelect()).toHaveValue('2');

    await user.click(nextButton());
    expect(screen.getByRole('radio', { name: 'High' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Wildlife Officer' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Park Manager' })).toBeChecked();
    expect(screen.getByLabelText(/Response Behaviour/)).toHaveValue('PLACEHOLDER_RESPONSE');
    expect(screen.getByLabelText(/Additional Notes/)).toHaveValue('Night patrol focus');
  });

  test('Submit for Validation sends the full configuration without an action', async () => {
    const user = await openStep2();
    await completeStep2(user, { notes: '  Night patrol focus ' });
    await user.click(submitButton());

    expect(apiService.validateMonitoringRule).toHaveBeenCalledTimes(1);
    expect(apiService.validateMonitoringRule).toHaveBeenCalledWith({
      parkId: 1,
      hazardType: 'POACHING_SNARING',
      riskZoneId: 2,
      alertPriority: 'HIGH',
      notificationRecipients: ['wildlife_officer', 'park_manager'],
      responseBehaviour: 'PLACEHOLDER_RESPONSE',
      notes: '  Night patrol focus ',
    });
    expect(apiService.createMonitoringRule).not.toHaveBeenCalled();
  });

  test('missing required values stay on Step 2 with the errors shown and focus on the first invalid field', async () => {
    apiService.validateMonitoringRule.mockResolvedValueOnce(invalidResult({
      errors: [
        { field: 'alertPriority', code: 'REQUIRED', message: 'Alert priority is required.' },
        { field: 'notificationRecipients', code: 'REQUIRED', message: 'At least one notification recipient is required.' },
      ],
    }));
    const user = await openStep2();
    await user.click(submitButton());

    expect(await screen.findByRole('alert')).toHaveTextContent('Alert Priority: Alert priority is required.');
    expect(screen.getByText('Step 2 of 3')).toBeInTheDocument();
    const firstPriority = screen.getByRole('radio', { name: 'Low' });
    expect(firstPriority).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('checkbox', { name: 'Park Manager' })).toHaveAttribute('aria-invalid', 'true');
    await waitFor(() => expect(firstPriority).toHaveFocus());
  });
});

// ---------- Step 3: Review ----------

describe('MonitoringRulesManager - Step 3: Review', () => {
  test('shows the validated configuration in Rule Details, without a Rule ID', async () => {
    const user = await renderManager();
    await reachReview(user, { notes: 'Night patrol focus' });

    expect(screen.getByText('The configuration passed validation.')).toBeInTheDocument();
    const details = ruleDetails();
    expect(valueOf(details, 'Park')).toBe(PARK.name);
    expect(valueOf(details, 'Hazard / Species')).toBe('Poaching & Snaring');
    expect(valueOf(details, 'Risk Zone')).toBe('RZ-YALA-02 – Katagamuwa Sanctuary Boundary');
    expect(valueOf(details, 'Alert Priority')).toBe('High');
    expect(valueOf(details, 'Notification Recipients')).toBe('Park Manager, Wildlife Officer');
    expect(valueOf(details, 'Response Behaviour')).toBe('Response behaviour (to be confirmed)');
    expect(valueOf(details, 'Notes')).toBe('Night patrol focus');
    expect(screen.queryByText('Rule ID')).toBeNull();
    expect(apiService.createMonitoringRule).not.toHaveBeenCalled();
  });

  test('shows the Risk Zone Map next to Rule Details with the selected zone of the park', async () => {
    const user = await renderManager();
    await reachReview(user);

    const mapCard = screen.getByRole('region', { name: 'Risk Zone Map' });
    expect(mapCard.parentElement).toBe(ruleDetails().parentElement);
    expect(mapCard.parentElement).toHaveClass('mr-review-grid');
    const map = within(mapCard).getByTestId('risk-zone-map');
    expect(map).toHaveAttribute('data-zone-id', '2');
    expect(map).toHaveAttribute('data-zone-code', 'RZ-YALA-02');
    expect(map).toHaveAttribute('data-center', '6.3845,81.487');
    expect(map).toHaveAttribute('data-radius-km', '2.8');
    expect(map).toHaveAttribute('data-zone-codes', 'RZ-YALA-01,RZ-YALA-02');
    expect(map).toHaveAttribute('data-park-name', PARK.name);
    expect(screen.getAllByTestId('risk-zone-map')).toHaveLength(1);
  });

  test("the Review map uses the selected park's own zones (Wilpattu), with no Yala fallback", async () => {
    apiService.getMonitoringRuleReference.mockResolvedValue({ data: WILPATTU_REFERENCE });
    const user = await renderManager({ parkId: WILPATTU_PARK.id, parkName: WILPATTU_PARK.name });
    await startRule(user);
    await completeStep1(user, { hazard: 'LEOPARD_FEEDING_GROUND_INCURSION', zone: '6' });
    await completeStep2(user);
    await user.click(submitButton());
    await screen.findByText('Step 3 of 3');

    const map = within(screen.getByRole('region', { name: 'Risk Zone Map' })).getByTestId('risk-zone-map');
    expect(map).toHaveAttribute('data-zone-code', 'RZ-WILP-02');
    expect(map).toHaveAttribute('data-center', '8.421,80.062');
    expect(map).toHaveAttribute('data-radius-km', '2.5');
    expect(map).toHaveAttribute('data-zone-codes', 'RZ-WILP-01,RZ-WILP-02');
    expect(map).toHaveAttribute('data-park-name', WILPATTU_PARK.name);
  });

  test('omits Notes when none were entered', async () => {
    const user = await renderManager();
    await reachReview(user);
    expect(within(ruleDetails()).queryByText('Notes', { selector: 'dt' })).toBeNull();
  });

  test('Edit returns to Step 1 with all values kept', async () => {
    const user = await renderManager();
    await reachReview(user, { notes: 'Night patrol focus' });

    await user.click(screen.getByRole('button', { name: 'Edit' }));
    expect(await screen.findByText('Step 1 of 3')).toBeInTheDocument();
    expect(hazardSelect()).toHaveValue('POACHING_SNARING');
    expect(zoneSelect()).toHaveValue('2');

    await user.click(nextButton());
    expect(screen.getByRole('radio', { name: 'High' })).toBeChecked();
    expect(screen.getByLabelText(/Additional Notes/)).toHaveValue('Night patrol focus');
  });

  test('a changed configuration has to be validated again before it can be reviewed', async () => {
    const user = await renderManager();
    await reachReview(user);

    await user.click(screen.getByRole('button', { name: 'Edit' }));
    await user.click(nextButton());
    await user.click(screen.getByRole('radio', { name: 'Critical' }));
    expect(screen.queryByText('Step 3 of 3')).toBeNull();

    await user.click(submitButton());
    await screen.findByText('Step 3 of 3');
    expect(apiService.validateMonitoringRule).toHaveBeenCalledTimes(2);
    expect(apiService.validateMonitoringRule).toHaveBeenLastCalledWith(expect.objectContaining({ alertPriority: 'CRITICAL' }));
    expect(valueOf(ruleDetails(), 'Alert Priority')).toBe('Critical');
  });

  test('Back returns to Step 2', async () => {
    const user = await renderManager();
    await reachReview(user);

    await user.click(screen.getByRole('button', { name: /^Back$/ }));
    expect(await screen.findByText('Step 2 of 3')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'High' })).toBeChecked();
  });

  test('the stepper returns to a configuration step, while Review itself cannot be clicked', async () => {
    const user = await renderManager();
    await reachReview(user);

    const stepper = screen.getByRole('navigation', { name: 'Rule configuration steps' });
    expect(within(stepper).queryByRole('button', { name: /Review/ })).toBeNull();

    await user.click(within(stepper).getByRole('button', { name: /Hazard & Risk Zone/ }));
    expect(await screen.findByText('Step 1 of 3')).toBeInTheDocument();
    expect(within(screen.getByRole('navigation', { name: 'Rule configuration steps' })).queryByRole('button', { name: /Review/ })).toBeNull();
  });

  test('Save as Draft creates the validated rule with SAVE_DRAFT', async () => {
    apiService.createMonitoringRule.mockResolvedValue(createResponse(VALIDATED_RULE, 'DRAFT'));
    const user = await renderManager();
    await reachReview(user);

    await user.click(screen.getByRole('button', { name: 'Save as Draft' }));
    expect(apiService.createMonitoringRule).toHaveBeenCalledWith(VALIDATED_RULE, 'SAVE_DRAFT');
  });

  test('Activate Rule creates the validated rule with ACTIVATE', async () => {
    apiService.createMonitoringRule.mockResolvedValue(createResponse(VALIDATED_RULE, 'ACTIVE'));
    const user = await renderManager();
    await reachReview(user);

    await user.click(screen.getByRole('button', { name: 'Activate Rule' }));
    expect(apiService.createMonitoringRule).toHaveBeenCalledWith(VALIDATED_RULE, 'ACTIVATE');
  });

  test('all review actions are disabled while the rule is being saved', async () => {
    const pending = deferred();
    apiService.createMonitoringRule.mockReturnValue(pending.promise);
    const user = await renderManager();
    await reachReview(user);

    await user.click(screen.getByRole('button', { name: 'Activate Rule' }));
    expect(await screen.findByRole('button', { name: /Activating…/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Save as Draft' })).toBeDisabled();
    expect(screen.getByRole('button', { name: /^Back$/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Edit' })).toBeDisabled();

    pending.resolve(createResponse(VALIDATED_RULE, 'ACTIVE'));
    expect(await screen.findByText('Monitoring Rule Created Successfully')).toBeInTheDocument();
    expect(apiService.createMonitoringRule).toHaveBeenCalledTimes(1);
  });

  test('a 409 conflict returns to the configuration with the conflict shown and values kept', async () => {
    apiService.createMonitoringRule.mockRejectedValue(apiError(409, 'The monitoring rule duplicates or conflicts with an existing rule. No changes were saved.', {
      conflicts: [{ type: 'CONFLICT', ruleId: 32, status: 'ACTIVE', message: 'An ACTIVE rule (#32) with a different configuration already exists for this hazard and risk zone.' }],
    }));
    const user = await renderManager();
    await reachReview(user);

    await user.click(screen.getByRole('button', { name: 'Activate Rule' }));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('The monitoring rule duplicates or conflicts with an existing rule.');
    expect(alert).toHaveTextContent('Conflict · Rule #32');
    expect(alert).toHaveTextContent('An ACTIVE rule (#32) with a different configuration already exists');
    expect(screen.queryByText('Step 3 of 3')).toBeNull();
    expect(screen.getByRole('radio', { name: 'High' })).toBeChecked();
  });

  test('a server error keeps the user on Review with a safe message', async () => {
    apiService.createMonitoringRule.mockRejectedValue(apiError(500, 'An unexpected error occurred while processing the monitoring rule request.'));
    const user = await renderManager();
    await reachReview(user);

    await user.click(screen.getByRole('button', { name: 'Save as Draft' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('An unexpected error occurred');
    expect(screen.getByText('Step 3 of 3')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save as Draft' })).toBeEnabled();
  });
});

// ---------- Result / confirmation ----------

describe('MonitoringRulesManager - Result / Confirmation', () => {
  const createAs = async (button, status, step2 = { notes: 'Night patrol focus' }) => {
    apiService.createMonitoringRule.mockImplementation(async (rule) => createResponse(rule, status));
    const user = await renderManager();
    await reachReview(user, step2);
    await user.click(screen.getByRole('button', { name: button }));
    await screen.findByText('Monitoring Rule Created Successfully');
    return user;
  };

  test('an activated rule shows the active outcome, Active status, every detail and the activation time', async () => {
    await createAs('Activate Rule', 'ACTIVE');

    expect(screen.getByText('The monitoring rule has been created and activated for this park.')).toBeInTheDocument();
    expect(screen.getByText('Rule Status').parentElement).toHaveTextContent('Active');
    expect(valueOf(document.body, 'Activated')).toBe('08 Oct 2026, 07:30');

    const info = ruleInformation();
    expect(valueOf(info, 'Rule ID')).toBe('#41');
    expect(valueOf(info, 'Park')).toBe(PARK.name);
    expect(valueOf(info, 'Hazard / Species')).toBe('Poaching & Snaring');
    expect(valueOf(info, 'Risk Zone')).toBe('RZ-YALA-02 – Katagamuwa Sanctuary Boundary');
    expect(valueOf(info, 'Alert Priority')).toBe('High');
    expect(valueOf(info, 'Notification Recipients')).toBe('Park Manager, Wildlife Officer');
    expect(valueOf(info, 'Response Behaviour')).toBe('Response behaviour (to be confirmed)');
    expect(valueOf(info, 'Notes')).toBe('Night patrol focus');
    expect(screen.getAllByText('Rule ID')).toHaveLength(1);
  });

  test('a draft rule shows the draft outcome and Draft status, never activation details', async () => {
    await createAs('Save as Draft', 'DRAFT');

    expect(screen.getByText('The monitoring rule has been saved as a draft. It is not active.')).toBeInTheDocument();
    expect(screen.getByText('Rule Status').parentElement).toHaveTextContent('Draft');
    expect(screen.queryByText('Activated')).toBeNull();
    expect(screen.queryByText('Active', { exact: true })).toBeNull();
    expect(screen.queryByText(/created and activated/)).toBeNull();
  });

  test('Back to Monitoring Rules returns to the refreshed rules list', async () => {
    apiService.getMonitoringRules
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValueOnce({ data: [createdRule(VALIDATED_RULE, 'ACTIVE')] });
    const user = await createAs('Activate Rule', 'ACTIVE', {});

    await user.click(screen.getByRole('button', { name: /Back to Monitoring Rules/ }));
    expect(await screen.findByRole('tablist', { name: 'Monitoring rule status tabs' })).toBeInTheDocument();
    expect(apiService.getMonitoringRules).toHaveBeenCalledTimes(2);
    expect(await screen.findByText('#41')).toBeInTheDocument();
    expect(screen.queryByText('Monitoring Rule Created Successfully')).toBeNull();
  });

  test('Create Another Rule starts a fresh Step 1 with nothing carried over', async () => {
    const user = await createAs('Save as Draft', 'DRAFT');

    await user.click(screen.getByRole('button', { name: /Create Another Rule/ }));
    expect(await screen.findByText('Step 1 of 3')).toBeInTheDocument();
    expect(hazardSelect()).toHaveValue('');
    expect(zoneSelect()).toHaveValue('');
    expect(nextButton()).toBeDisabled();

    await user.selectOptions(hazardSelect(), 'POACHING_SNARING');
    await user.selectOptions(zoneSelect(), '1');
    await user.click(nextButton());
    screen.getAllByRole('radio').forEach((radio) => expect(radio).not.toBeChecked());
    screen.getAllByRole('checkbox').forEach((box) => expect(box).not.toBeChecked());
    expect(screen.getByLabelText(/Response Behaviour/)).toHaveValue('');
    expect(screen.getByLabelText(/Additional Notes/)).toHaveValue('');
  });
});

// ---------- end-to-end happy path ----------

describe('MonitoringRulesManager - main UC04 flow', () => {
  test('configure, validate, review and activate a rule with consistent payloads at every step', async () => {
    apiService.createMonitoringRule.mockImplementation(async (rule) => createResponse(rule, 'ACTIVE'));
    const user = await renderManager();

    await startRule(user);
    await user.selectOptions(hazardSelect(), 'ELEPHANT_CROP_RAIDING_FENCE_BREACH');
    await user.selectOptions(zoneSelect(), '2');
    await user.click(nextButton());

    await user.click(await screen.findByRole('radio', { name: 'Critical' }));
    await user.click(screen.getByRole('checkbox', { name: 'Wildlife Officer' }));
    await user.selectOptions(screen.getByLabelText(/Response Behaviour/), 'PLACEHOLDER_RESPONSE');
    await user.type(screen.getByLabelText(/Additional Notes/), ' Fence repair pending ');
    await user.click(submitButton());

    const expectedPayload = {
      parkId: 1,
      hazardType: 'ELEPHANT_CROP_RAIDING_FENCE_BREACH',
      riskZoneId: 2,
      alertPriority: 'CRITICAL',
      notificationRecipients: ['wildlife_officer'],
      responseBehaviour: 'PLACEHOLDER_RESPONSE',
    };
    expect(apiService.validateMonitoringRule).toHaveBeenCalledWith({ ...expectedPayload, notes: ' Fence repair pending ' });

    await screen.findByText('Step 3 of 3');
    expect(valueOf(ruleDetails(), 'Hazard / Species')).toBe('Elephant Crop Raiding & Fence Breaches');

    await user.click(screen.getByRole('button', { name: 'Activate Rule' }));
    expect(apiService.createMonitoringRule).toHaveBeenCalledWith({ ...expectedPayload, notes: 'Fence repair pending' }, 'ACTIVATE');

    expect(await screen.findByText('Monitoring Rule Created Successfully')).toBeInTheDocument();
    expect(valueOf(ruleInformation(), 'Alert Priority')).toBe('Critical');
    expect(valueOf(ruleInformation(), 'Notes')).toBe('Fence repair pending');
    await waitFor(() => expect(apiService.getMonitoringRules).toHaveBeenCalledTimes(2));
  });
});

// ---------- rule actions (View Details / Edit / Activate / Deactivate) ----------

const rowOf = (id) => screen.getAllByRole('row').find((row) => within(row).queryByText(`#${id}`, { selector: '.mr-code' }));
const rowButtons = (id) => within(rowOf(id)).getAllByRole('button').map((button) => button.textContent.trim());
const tab = (name) => screen.getByRole('tab', { name });
const detailsDialog = (id) => screen.getByRole('dialog', { name: `Monitoring Rule #${id}` });

// Opens a rule's details from its row
const openDetails = async (user, id) => {
  await user.click(within(rowOf(id)).getByRole('button', { name: 'View Details' }));
  return detailsDialog(id);
};

// The status actions offered inside a rule's details dialog
const dialogActionsOf = (id) => {
  const group = within(detailsDialog(id)).queryByRole('group', { name: `Actions for rule #${id}` });
  return group ? within(group).getAllByRole('button').map((button) => button.textContent.trim()) : [];
};

// Rule actions are only reachable through View Details
const clickAction = async (user, id, name) => {
  const dialog = await openDetails(user, id);
  await user.click(within(dialog).getByRole('button', { name }));
};

const renderWithRules = async (rules = RULES_ALL_STATUSES, managerProps = {}) => {
  apiService.getMonitoringRules.mockResolvedValue({ data: rules });
  const user = await renderManager(managerProps);
  await screen.findByText(`#${rules[0].id}`);
  return user;
};

// The list as it looks after the backend changed one rule's status
const withStatus = (id, status) => RULES_ALL_STATUSES.map((rule) => (rule.id === id
  ? { ...rule, status, activatedAt: status === 'ACTIVE' ? UPDATED_AT : null, updatedAt: UPDATED_AT }
  : rule));

describe('MonitoringRulesManager - Actions column and dialog actions by status', () => {
  test('every row, whatever its status, offers View Details only', async () => {
    await renderWithRules();

    expect(screen.getByRole('columnheader', { name: 'Actions' })).toBeInTheDocument();
    [12, 11, 9].forEach((id) => expect(rowButtons(id)).toEqual(['View Details']));
    expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Activate' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Deactivate' })).toBeNull();
  });

  test.each([
    [11, 'Draft', ['Edit', 'Activate']],
    [12, 'Active', ['Deactivate']],
    [9, 'Inactive', []],
  ])('the details of rule #%s (%s) offer exactly %j', async (id, _status, expected) => {
    const user = await renderWithRules();
    await openDetails(user, id);
    expect(dialogActionsOf(id)).toEqual(expected);
  });

  test('an inactive rule explains that no actions are available', async () => {
    const user = await renderWithRules();
    const dialog = await openDetails(user, 9);
    expect(within(dialog).getByText('No actions are available for inactive rules.')).toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: /Activate|Deactivate|Edit/ })).toBeNull();
  });

  test('the Inactive tab counts and lists deactivated rules', async () => {
    const user = await renderWithRules();

    expect(tab(/^All/)).toHaveTextContent('3');
    expect(tab(/^Active/)).toHaveTextContent('1');
    expect(tab(/^Draft/)).toHaveTextContent('1');
    expect(tab(/^Inactive/)).toHaveTextContent('1');

    await user.click(tab(/^Inactive/));
    const rows = screen.getAllByRole('row');
    expect(rows).toHaveLength(2);
    expect(rows[1]).toHaveTextContent('#9');
    expect(rows[1]).toHaveTextContent('Inactive');
  });
});

describe('MonitoringRulesManager - View Details', () => {
  test.each([
    [12, 'Active'],
    [11, 'Draft'],
    [9, 'Inactive'],
  ])('rule #%s (%s) opens its details and closes again', async (id, status) => {
    const user = await renderWithRules();

    await openDetails(user, id);
    const dialog = screen.getByRole('dialog', { name: `Monitoring Rule #${id}` });
    expect(valueOf(dialog, 'Rule ID')).toBe(`#${id}`);
    expect(valueOf(dialog, 'Status')).toBe(status);

    await user.click(within(dialog).getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(apiService.activateMonitoringRule).not.toHaveBeenCalled();
    expect(apiService.deactivateMonitoringRule).not.toHaveBeenCalled();
  });

  test('an active rule shows every stored field, including its activation time', async () => {
    const user = await renderWithRules();
    await openDetails(user, 12);
    const dialog = screen.getByRole('dialog');

    expect(valueOf(dialog, 'Rule ID')).toBe('#12');
    expect(valueOf(dialog, 'Park')).toBe(PARK.name);
    expect(valueOf(dialog, 'Hazard / Species')).toBe('Poaching & Snaring');
    expect(valueOf(dialog, 'Risk Zone')).toBe('RZ-YALA-01 – Northern River Basin Buffer');
    expect(valueOf(dialog, 'Severity')).toBe('CRITICAL');
    expect(within(dialog).getByText('CRITICAL', { selector: '.badge-risk' })).toHaveClass('critical');
    expect(valueOf(dialog, 'Alert Priority')).toBe('Critical');
    expect(valueOf(dialog, 'Notification Recipients')).toBe('Park Manager, Wildlife Officer');
    expect(valueOf(dialog, 'Response Behaviour')).toBe('Response behaviour (to be confirmed)');
    expect(valueOf(dialog, 'Status')).toBe('Active');
    expect(valueOf(dialog, 'Created')).toBe('08 Oct 2026, 07:30');
    expect(valueOf(dialog, 'Updated')).toBe('08 Oct 2026, 07:30');
    expect(valueOf(dialog, 'Activated')).toBe('08 Oct 2026, 07:30');
    // No notes were recorded for this rule
    expect(within(dialog).queryByText('Notes', { selector: 'dt' })).toBeNull();
  });

  test('a draft shows its notes and no activation time; an inactive rule shows its update time', async () => {
    const user = await renderWithRules();

    await openDetails(user, 11);
    let dialog = screen.getByRole('dialog');
    expect(valueOf(dialog, 'Notes')).toBe('Seasonal');
    expect(valueOf(dialog, 'Alert Priority')).toBe('Low');
    expect(within(dialog).queryByText('Activated', { selector: 'dt' })).toBeNull();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();

    await openDetails(user, 9);
    dialog = screen.getByRole('dialog');
    expect(valueOf(dialog, 'Hazard / Species')).toBe('Illegal Fishing & Campsites');
    expect(valueOf(dialog, 'Updated')).toBe('09 Oct 2026, 09:45');
    expect(within(dialog).queryByText('Activated', { selector: 'dt' })).toBeNull();
  });
});

describe('MonitoringRulesManager - View Details risk-zone map', () => {
  const mapIn = (dialog) => within(dialog).getByTestId('risk-zone-map');

  test.each([
    ['Yala', PARK, REFERENCE, RISK_ZONES[0], '6.4128,81.5342', '3.2', 'RZ-YALA-01,RZ-YALA-02', 'CRITICAL'],
    ['Wilpattu', WILPATTU_PARK, WILPATTU_REFERENCE, WILPATTU_ZONES[1], '8.421,80.062', '2.5', 'RZ-WILP-01,RZ-WILP-02', 'HIGH'],
    ['Udawalawe', UDAWALAWE_PARK, UDAWALAWE_REFERENCE, UDAWALAWE_ZONES[0], '6.442,80.892', '3', 'RZ-UDAW-01,RZ-UDAW-02', 'CRITICAL'],
  ])('%s: the map shows the rule\'s own stored zone of the selected park', async (_name, park, reference, zone, center, radius, codes, severity) => {
    apiService.getMonitoringRuleReference.mockResolvedValue({ data: reference });
    const rule = ruleInZone(park, zone);
    const user = await renderWithRules([rule], { parkId: park.id, parkName: park.name });

    const dialog = await openDetails(user, rule.id);
    const map = mapIn(dialog);
    expect(map).toHaveAttribute('data-zone-id', String(zone.id));
    expect(map).toHaveAttribute('data-zone-code', zone.zoneCode);
    expect(map).toHaveAttribute('data-center', center);
    expect(map).toHaveAttribute('data-radius-km', radius);
    expect(map).toHaveAttribute('data-zone-codes', codes);
    expect(map).toHaveAttribute('data-park-name', park.name);
    expect(valueOf(dialog, 'Severity')).toBe(severity);
    expect(valueOf(dialog, 'Park')).toBe(park.name);
    expect(apiService.getMonitoringRuleReference).toHaveBeenCalledWith(park.id);
    if (park.id !== PARK.id) expect(map.getAttribute('data-zone-codes')).not.toMatch(/YALA/);
  });

  test('a rule whose zone is not in the park reference data shows a message instead of a guessed map', async () => {
    const rule = ruleInZone(PARK, { id: 99, zoneCode: 'RZ-OLD-99', zoneName: 'Retired zone' });
    const user = await renderWithRules([rule]);

    const dialog = await openDetails(user, rule.id);
    expect(within(dialog).queryByTestId('risk-zone-map')).toBeNull();
    expect(within(dialog).getByText(/location of this risk zone is not available for Yala National Park/)).toBeInTheDocument();
    expect(valueOf(dialog, 'Risk Zone')).toBe('RZ-OLD-99 – Retired zone');
    expect(valueOf(dialog, 'Severity')).toBe('Not recorded');
  });

  test('the map is mounted with the dialog and removed when it closes', async () => {
    const user = await renderWithRules();

    const dialog = await openDetails(user, 12);
    expect(mapIn(dialog)).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Close details' }));
    expect(screen.queryByTestId('risk-zone-map')).toBeNull();

    // Reopening another rule mounts a fresh map for that rule's zone
    expect(mapIn(await openDetails(user, 11))).toHaveAttribute('data-zone-code', 'RZ-YALA-02');
  });
});

describe('MonitoringRulesManager - Activate / Deactivate', () => {
  test('Cancel returns to the rule details without calling the API', async () => {
    const user = await renderWithRules();

    await clickAction(user, 11, 'Activate');
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
    expect(screen.getByRole('dialog', { name: /Activate Monitoring Rule/ })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(detailsDialog(11)).toBeInTheDocument();
    expect(dialogActionsOf(11)).toEqual(['Edit', 'Activate']);
    await user.click(within(detailsDialog(11)).getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).toBeNull();

    await clickAction(user, 12, 'Deactivate');
    expect(screen.getByRole('dialog', { name: /Deactivate Monitoring Rule/ })).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(detailsDialog(12)).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();

    expect(apiService.activateMonitoringRule).not.toHaveBeenCalled();
    expect(apiService.deactivateMonitoringRule).not.toHaveBeenCalled();
    expect(apiService.getMonitoringRules).toHaveBeenCalledTimes(1);
  });

  test('confirming Activate activates the draft, reloads the list and updates its actions and counts', async () => {
    apiService.activateMonitoringRule.mockResolvedValue({ message: 'Monitoring rule activated successfully.', data: {} });
    const user = await renderWithRules();
    apiService.getMonitoringRules.mockResolvedValue({ data: withStatus(11, 'ACTIVE') });

    await clickAction(user, 11, 'Activate');
    const dialog = screen.getByRole('dialog');
    expect(valueOf(dialog, 'Hazard / Species')).toBe('Elephant Crop Raiding & Fence Breaches');
    await user.click(within(dialog).getByRole('button', { name: 'Activate Rule' }));

    expect(apiService.activateMonitoringRule).toHaveBeenCalledWith(11);
    expect(await screen.findByRole('status', { name: 'Rule update' })).toHaveTextContent('Monitoring rule #11 has been activated.');
    expect(screen.queryByRole('dialog')).toBeNull();
    await waitFor(() => expect(tab(/^Active/)).toHaveTextContent('2'));
    expect(apiService.getMonitoringRules).toHaveBeenCalledTimes(2);
    expect(apiService.getMonitoringRules).toHaveBeenLastCalledWith(PARK.id);
    expect(tab(/^Draft/)).toHaveTextContent('0');
    expect(rowButtons(11)).toEqual(['View Details']);

    // The refreshed rule now offers Deactivate in its details
    await openDetails(user, 11);
    expect(valueOf(detailsDialog(11), 'Status')).toBe('Active');
    expect(dialogActionsOf(11)).toEqual(['Deactivate']);
  });

  test('confirming Deactivate deactivates the active rule, which then only offers View Details', async () => {
    apiService.deactivateMonitoringRule.mockResolvedValue({ message: 'Monitoring rule deactivated.', data: {} });
    const user = await renderWithRules();
    apiService.getMonitoringRules.mockResolvedValue({ data: withStatus(12, 'INACTIVE') });

    await clickAction(user, 12, 'Deactivate');
    await user.click(screen.getByRole('button', { name: 'Deactivate Rule' }));

    expect(apiService.deactivateMonitoringRule).toHaveBeenCalledWith(12);
    expect(apiService.activateMonitoringRule).not.toHaveBeenCalled();
    expect(await screen.findByRole('status', { name: 'Rule update' })).toHaveTextContent('Monitoring rule #12 has been deactivated.');
    await waitFor(() => expect(tab(/^Inactive/)).toHaveTextContent('2'));
    expect(tab(/^Active/)).toHaveTextContent('0');

    await openDetails(user, 12);
    expect(valueOf(detailsDialog(12), 'Status')).toBe('Inactive');
    expect(within(detailsDialog(12)).queryByText('Activated', { selector: 'dt' })).toBeNull();
    expect(dialogActionsOf(12)).toEqual([]);
  });

  test('the selected tab and park are kept after an action', async () => {
    apiService.activateMonitoringRule.mockResolvedValue({ data: {} });
    const user = await renderWithRules();
    apiService.getMonitoringRules.mockResolvedValue({ data: withStatus(11, 'ACTIVE') });

    await user.click(tab(/^Draft/));
    await clickAction(user, 11, 'Activate');
    await user.click(screen.getByRole('button', { name: 'Activate Rule' }));

    expect(await screen.findByText('No monitoring rules match this tab.')).toBeInTheDocument();
    expect(tab(/^Draft/)).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('status', { name: 'Selected park' })).toHaveTextContent(PARK.name);
    apiService.getMonitoringRules.mock.calls.forEach((call) => expect(call).toEqual([PARK.id]));
  });

  test('the confirmation is locked while the request is pending', async () => {
    const pending = deferred();
    apiService.deactivateMonitoringRule.mockReturnValue(pending.promise);
    const user = await renderWithRules();

    await clickAction(user, 12, 'Deactivate');
    await user.click(screen.getByRole('button', { name: 'Deactivate Rule' }));

    const pendingButton = await screen.findByRole('button', { name: /Deactivating…/ });
    expect(pendingButton).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    await user.click(pendingButton);
    await user.keyboard('{Escape}');
    // Only the confirmation is open (the details dialog was replaced), so no second action can start
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
    expect(screen.getByRole('dialog', { name: /Deactivate Monitoring Rule/ })).toBeInTheDocument();

    pending.resolve({ data: {} });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(apiService.deactivateMonitoringRule).toHaveBeenCalledTimes(1);
  });

  test('a 409 conflict keeps the dialog open with the conflicting rule and does not reload', async () => {
    apiService.activateMonitoringRule.mockRejectedValue(apiError(409, 'The monitoring rule duplicates or conflicts with an existing rule. No changes were saved.', {
      conflicts: [{ type: 'CONFLICT', ruleId: 12, status: 'ACTIVE', message: 'An ACTIVE rule (#12) with a different configuration already exists for this hazard and risk zone.' }],
    }));
    const user = await renderWithRules();

    await clickAction(user, 11, 'Activate');
    await user.click(screen.getByRole('button', { name: 'Activate Rule' }));

    const alert = await within(screen.getByRole('dialog')).findByRole('alert');
    expect(alert).toHaveTextContent('The monitoring rule duplicates or conflicts with an existing rule.');
    expect(alert).toHaveTextContent('Conflict · Rule #12');
    expect(screen.getByRole('button', { name: 'Activate Rule' })).toBeEnabled();
    expect(apiService.getMonitoringRules).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('status', { name: 'Rule update' })).toBeNull();
  });

  test('a stored draft that no longer validates shows the field errors', async () => {
    apiService.activateMonitoringRule.mockRejectedValue(apiError(400, 'The saved draft no longer passes validation. Edit the draft before activating it. No changes were saved.', {
      errors: [{ field: 'riskZoneId', code: 'NOT_FOUND', message: 'The selected risk zone was not found.' }],
    }));
    const user = await renderWithRules();

    await clickAction(user, 11, 'Activate');
    await user.click(screen.getByRole('button', { name: 'Activate Rule' }));

    const alert = await within(screen.getByRole('dialog')).findByRole('alert');
    expect(alert).toHaveTextContent('Edit the draft before activating it.');
    expect(alert).toHaveTextContent('Risk Zone: The selected risk zone was not found.');
  });

  test.each([
    ['a server error', apiError(500, 'An unexpected error occurred while processing the monitoring rule request.'), /An unexpected error occurred/],
    ['a network failure', new TypeError('Failed to fetch'), /Unable to reach the monitoring rules service/],
    ['a deleted rule', apiError(404, 'Monitoring rule not found.'), /This monitoring rule no longer exists/],
    ['a status change by another user', apiError(409, 'Only ACTIVE rules can be deactivated. This rule is INACTIVE. No changes were saved.'), /Only ACTIVE rules can be deactivated/],
  ])('%s keeps the dialog open with a safe message', async (_label, error, message) => {
    apiService.deactivateMonitoringRule.mockRejectedValue(error);
    const user = await renderWithRules();

    await clickAction(user, 12, 'Deactivate');
    await user.click(screen.getByRole('button', { name: 'Deactivate Rule' }));

    expect(await within(screen.getByRole('dialog')).findByRole('alert')).toHaveTextContent(message);
    expect(screen.getByRole('button', { name: 'Deactivate Rule' })).toBeEnabled();
    expect(apiService.getMonitoringRules).toHaveBeenCalledTimes(1);
  });
});

describe('MonitoringRulesManager - Draft Edit', () => {
  const DRAFT = EXISTING_RULES[1];

  const startEdit = async () => {
    const user = await renderWithRules();
    await clickAction(user, 11, 'Edit');
    await screen.findByText('Step 1 of 3');
    return user;
  };

  test('Edit opens the configuration flow prefilled with the saved draft', async () => {
    const user = await startEdit();

    expect(screen.getByText('Edit Draft Monitoring Rule #11')).toBeInTheDocument();
    expect(hazardSelect()).toHaveValue('ELEPHANT_CROP_RAIDING_FENCE_BREACH');
    expect(zoneSelect()).toHaveValue('2');

    await user.click(nextButton());
    expect(screen.getByRole('radio', { name: 'Low' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Community Liaison Officer' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Park Manager' })).not.toBeChecked();
    expect(screen.getByLabelText(/Response Behaviour/)).toHaveValue('PLACEHOLDER_RESPONSE');
    expect(screen.getByLabelText(/Additional Notes/)).toHaveValue('Seasonal');
  });

  test('saving an edited draft revalidates with its ID and updates it in place, never creating a rule', async () => {
    apiService.updateMonitoringRule.mockImplementation(async (id, rule) => ({
      message: 'Draft monitoring rule updated.',
      data: createdRule(rule, 'DRAFT', { id, updatedAt: UPDATED_AT }),
    }));
    const user = await startEdit();

    await user.click(nextButton());
    await user.click(screen.getByRole('radio', { name: 'Critical' }));
    await user.click(submitButton());

    const expectedPayload = {
      parkId: 1, hazardType: DRAFT.hazardType, riskZoneId: 2, alertPriority: 'CRITICAL',
      notificationRecipients: ['community_liaison_officer'], responseBehaviour: 'PLACEHOLDER_RESPONSE', notes: 'Seasonal',
    };
    expect(apiService.validateMonitoringRule).toHaveBeenCalledWith(expectedPayload, 11);

    await screen.findByText('Step 3 of 3');
    expect(screen.getByText('Edit Draft Monitoring Rule #11')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Activate Rule' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Save as Draft' })).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Save Draft Changes' }));
    expect(apiService.updateMonitoringRule).toHaveBeenCalledWith(11, expectedPayload);
    expect(apiService.createMonitoringRule).not.toHaveBeenCalled();
    expect(apiService.activateMonitoringRule).not.toHaveBeenCalled();

    expect(await screen.findByText('Draft Monitoring Rule Updated')).toBeInTheDocument();
    expect(screen.getByText('The draft has been updated. It keeps its rule ID and is not active.')).toBeInTheDocument();
    expect(valueOf(ruleInformation(), 'Rule ID')).toBe('#11');
    expect(valueOf(ruleInformation(), 'Alert Priority')).toBe('Critical');
    expect(screen.getByText('Rule Status').parentElement).toHaveTextContent('Draft');
    expect(valueOf(document.body, 'Updated')).toBe('09 Oct 2026, 09:45');
    await waitFor(() => expect(apiService.getMonitoringRules).toHaveBeenCalledTimes(2));
  });

  test('saving is locked while pending', async () => {
    const pending = deferred();
    apiService.updateMonitoringRule.mockReturnValue(pending.promise);
    const user = await startEdit();
    await user.click(nextButton());
    await user.click(submitButton());
    await screen.findByText('Step 3 of 3');

    await user.click(screen.getByRole('button', { name: 'Save Draft Changes' }));
    expect(await screen.findByRole('button', { name: /Saving…/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /^Back$/ })).toBeDisabled();

    pending.resolve({ data: createdRule(VALIDATED_RULE, 'DRAFT', { id: 11 }) });
    expect(await screen.findByText('Draft Monitoring Rule Updated')).toBeInTheDocument();
    expect(apiService.updateMonitoringRule).toHaveBeenCalledTimes(1);
  });

  test('a 409 conflict on save returns to the form with the conflict and the edited values', async () => {
    apiService.updateMonitoringRule.mockRejectedValue(apiError(409, 'The monitoring rule duplicates or conflicts with an existing rule. No changes were saved.', {
      conflicts: [{ type: 'DUPLICATE', ruleId: 15, status: 'DRAFT', message: 'An identical DRAFT rule (#15) already exists for this hazard and risk zone.' }],
    }));
    const user = await startEdit();
    await user.click(nextButton());
    await user.click(screen.getByRole('radio', { name: 'High' }));
    await user.click(submitButton());
    await screen.findByText('Step 3 of 3');

    await user.click(screen.getByRole('button', { name: 'Save Draft Changes' }));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Duplicate · Rule #15');
    expect(screen.getByText('Edit Draft Monitoring Rule #11')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'High' })).toBeChecked();
    expect(apiService.createMonitoringRule).not.toHaveBeenCalled();
  });

  test('a deleted draft (404) keeps the user on Review with a rule-specific message', async () => {
    apiService.updateMonitoringRule.mockRejectedValue(apiError(404, 'Monitoring rule not found.'));
    const user = await startEdit();
    await user.click(nextButton());
    await user.click(submitButton());
    await screen.findByText('Step 3 of 3');

    await user.click(screen.getByRole('button', { name: 'Save Draft Changes' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('This monitoring rule no longer exists.');
    expect(screen.getByText('Step 3 of 3')).toBeInTheDocument();
  });

  test('leaving an edit and creating a new rule starts empty and validates without a rule ID', async () => {
    const user = await startEdit();

    await user.click(screen.getAllByRole('button', { name: /Back to Monitoring Rules/ })[0]);
    expect(await screen.findByRole('tablist', { name: 'Monitoring rule status tabs' })).toBeInTheDocument();
    expect(apiService.updateMonitoringRule).not.toHaveBeenCalled();

    await reachReview(user);
    expect(screen.getByText('Create Monitoring Rule')).toBeInTheDocument();
    expect(apiService.validateMonitoringRule).toHaveBeenCalledTimes(1);
    expect(apiService.validateMonitoringRule.mock.calls[0]).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Activate Rule' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save as Draft' })).toBeInTheDocument();
  });
});
