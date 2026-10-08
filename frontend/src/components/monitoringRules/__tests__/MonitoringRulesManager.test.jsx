import React from 'react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MonitoringRulesManager from '../MonitoringRulesManager';
import { apiService } from '../../../services/api';
import {
  EXISTING_RULES, OPTIONS, PARK, REFERENCE, WILPATTU_PARK, WILPATTU_REFERENCE, apiError, createResponse, createdRule,
  deferred, invalidResult, validResult,
} from './fixtures';

vi.mock('../../../services/api', () => ({
  apiService: {
    getMonitoringRuleReference: vi.fn(),
    getMonitoringRules: vi.fn(),
    validateMonitoringRule: vi.fn(),
    createMonitoringRule: vi.fn(),
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

  test('Step 2 and Review do not show the Step 1 map, and it returns with the kept zone on Edit', async () => {
    const user = await renderManager();
    await startRule(user);
    await completeStep1(user);
    expect(riskZoneMap()).toBeNull();
    expect(screen.queryByRole('region', { name: 'Park map and risk zone' })).toBeNull();

    await completeStep2(user);
    await user.click(submitButton());
    await screen.findByText('Step 3 of 3');
    expect(riskZoneMap()).toBeNull();

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
