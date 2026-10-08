import React, { useEffect, useState } from 'react';
import { MapPin, AlertTriangle, RefreshCw } from 'lucide-react';
import { apiService } from '../../services/api';
import MonitoringRuleList from './MonitoringRuleList';
import RuleConfigurationForm from './RuleConfigurationForm';
import RuleReviewView from './RuleReviewView';
import RuleResultView from './RuleResultView';
import { EMPTY_RULE_FORM, LAST_STEP, buildRulePayload, describeApiError, firstStepWithError } from './monitoringRuleUtils';
import '../../pages/PatrolPlanning.css';
import '../../pages/MonitoringRules.css';

const SCREENS = Object.freeze({ LIST: 'LIST', CONFIGURE: 'CONFIGURE', REVIEW: 'REVIEW', RESULT: 'RESULT' });

/**
 * UC04 Configure Park-Specific Wildlife Monitoring Rules.
 * The park comes from the Park Manager dashboard's park selector (parkId / parkName props);
 * the dashboard remounts this component when the selected park changes.
 */
export default function MonitoringRulesManager({ parkId, parkName }) {
  const [screen, setScreen] = useState(SCREENS.LIST);

  const [reference, setReference] = useState(null);
  const [referenceLoading, setReferenceLoading] = useState(true);
  const [referenceError, setReferenceError] = useState(null);
  const [referenceVersion, setReferenceVersion] = useState(0);

  const [rules, setRules] = useState([]);
  const [rulesLoading, setRulesLoading] = useState(true);
  const [rulesError, setRulesError] = useState(null);
  const [rulesVersion, setRulesVersion] = useState(0);

  const [form, setForm] = useState(EMPTY_RULE_FORM);
  const [step, setStep] = useState(1);
  const [validationErrors, setValidationErrors] = useState([]);
  const [conflicts, setConflicts] = useState([]);
  const [formMessage, setFormMessage] = useState(null);
  const [focusKey, setFocusKey] = useState(0);
  const [validating, setValidating] = useState(false);

  const [reviewRule, setReviewRule] = useState(null);
  const [creatingAction, setCreatingAction] = useState(null);
  const [reviewError, setReviewError] = useState(null);
  const [result, setResult] = useState(null);

  const riskZones = reference?.riskZones || [];
  const options = reference?.options || null;
  const displayParkName = parkName || reference?.park?.name || 'the selected park';

  // Reference data (park, risk zones, option lists). Responses from superseded requests are ignored.
  useEffect(() => {
    let ignore = false;
    apiService.getMonitoringRuleReference(parkId)
      .then((response) => {
        if (ignore) return;
        setReference(response.data);
        setReferenceError(null);
      })
      .catch((error) => {
        if (!ignore) setReferenceError(describeApiError(error));
      })
      .finally(() => {
        if (!ignore) setReferenceLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, [parkId, referenceVersion]);

  useEffect(() => {
    let ignore = false;
    apiService.getMonitoringRules(parkId)
      .then((response) => {
        if (ignore) return;
        setRules(response.data || []);
        setRulesError(null);
      })
      .catch((error) => {
        if (!ignore) setRulesError(describeApiError(error));
      })
      .finally(() => {
        if (!ignore) setRulesLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, [parkId, rulesVersion]);

  const reloadReference = () => {
    setReferenceLoading(true);
    setReferenceError(null);
    setReferenceVersion((version) => version + 1);
  };

  const reloadRules = () => {
    setRulesLoading(true);
    setRulesError(null);
    setRulesVersion((version) => version + 1);
  };

  const clearFeedback = () => {
    setValidationErrors([]);
    setConflicts([]);
    setFormMessage(null);
  };

  const startNewRule = () => {
    setForm(EMPTY_RULE_FORM);
    setStep(1);
    clearFeedback();
    setReviewRule(null);
    setReviewError(null);
    setResult(null);
    setScreen(SCREENS.CONFIGURE);
  };

  const backToList = () => {
    setScreen(SCREENS.LIST);
    setResult(null);
  };

  // Review -> configuration (Back / Edit / stepper). The form keeps every value; the validated rule is
  // dropped so the Review screen can only be reached again through a new Submit for Validation.
  const returnToConfiguration = (stepId) => {
    if (creatingAction) return;
    setReviewRule(null);
    setReviewError(null);
    setStep(stepId);
    setScreen(SCREENS.CONFIGURE);
  };

  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
    // A corrected field no longer shows its old error; conflicts stay until the next validation
    setValidationErrors((current) => current.filter((error) => error.field !== field));
  };

  // Keeps the configuration and shows the backend's errors / conflicts on the form
  const showOnForm = ({ errors = [], conflicts: ruleConflicts = [], message = null }) => {
    setValidationErrors(errors);
    setConflicts(ruleConflicts);
    setFormMessage(message);
    setStep((current) => firstStepWithError(errors) ?? current);
    setScreen(SCREENS.CONFIGURE);
    setFocusKey((key) => key + 1);
  };

  const handleValidate = async () => {
    if (validating) return;
    setValidating(true);
    clearFeedback();
    try {
      const response = await apiService.validateMonitoringRule(buildRulePayload(form, parkId));
      const validation = response.data;
      if (validation.valid) {
        setReviewRule(validation.rule);
        setReviewError(null);
        setScreen(SCREENS.REVIEW);
      } else {
        showOnForm({ errors: validation.errors, conflicts: validation.conflicts });
      }
    } catch (error) {
      showOnForm({ message: describeApiError(error) });
    } finally {
      setValidating(false);
    }
  };

  const handleCreate = async (action) => {
    if (creatingAction || !reviewRule) return;
    setCreatingAction(action);
    setReviewError(null);
    try {
      const response = await apiService.createMonitoringRule(reviewRule, action);
      setResult({ rule: response.data, action, message: response.message });
      setScreen(SCREENS.RESULT);
      reloadRules();
    } catch (error) {
      if (error?.status === 400) {
        showOnForm({ errors: error.errors || [], message: error.message });
      } else if (error?.status === 409) {
        showOnForm({ conflicts: error.conflicts || [], message: error.message });
      } else {
        // 401 / 403 / 500 / network: stay on the review screen so nothing the user entered is lost
        setReviewError(describeApiError(error));
      }
    } finally {
      setCreatingAction(null);
    }
  };

  const createHint = referenceLoading
    ? 'Loading risk zones and rule options for this park…'
    : null;

  return (
    <div className="mr-container">
      <div className="mr-park-banner" role="status" aria-label="Selected park">
        <MapPin size={18} />
        <div>
          <span className="mr-park-label">Selected park</span>
          <strong>{displayParkName}</strong>
        </div>
        <span className="mr-muted mr-park-hint">Use the park selector at the top of the dashboard to switch parks.</span>
      </div>

      {referenceError && (
        <div className="mr-state mr-state-error mr-reference-error" role="alert">
          <AlertTriangle size={22} />
          <p>Rule options could not be loaded: {referenceError}</p>
          <button type="button" className="btn-tactical btn-tactical-secondary" onClick={reloadReference}>
            <RefreshCw size={16} /> Retry
          </button>
        </div>
      )}

      {screen === SCREENS.LIST && (
        <MonitoringRuleList
          rules={rules}
          loading={rulesLoading}
          error={rulesError}
          options={options}
          riskZones={riskZones}
          canCreate={Boolean(reference) && !referenceLoading}
          createHint={createHint}
          onRetry={reloadRules}
          onCreate={startNewRule}
        />
      )}

      {screen === SCREENS.CONFIGURE && reference && (
        <RuleConfigurationForm
          parkName={displayParkName}
          riskZones={riskZones}
          options={options}
          form={form}
          step={step}
          errors={validationErrors}
          conflicts={conflicts}
          message={formMessage}
          submitting={validating}
          focusKey={focusKey}
          onFieldChange={updateField}
          onStepChange={setStep}
          onSubmit={handleValidate}
          onCancel={backToList}
        />
      )}

      {screen === SCREENS.REVIEW && reviewRule && (
        <RuleReviewView
          rule={reviewRule}
          parkName={displayParkName}
          riskZones={riskZones}
          options={options}
          submittingAction={creatingAction}
          error={reviewError}
          onBack={() => returnToConfiguration(LAST_STEP)}
          onEdit={returnToConfiguration}
          onCreate={handleCreate}
        />
      )}

      {screen === SCREENS.RESULT && result && (
        <RuleResultView
          result={result}
          parkName={displayParkName}
          riskZones={riskZones}
          options={options}
          onBackToList={backToList}
          onCreateAnother={startNewRule}
        />
      )}
    </div>
  );
}
