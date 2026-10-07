const evidenceReviewRules = require('../utils/evidenceReviewRules');
const { CLASSIFICATIONS, REVIEW_STATUSES } = evidenceReviewRules;

const completeImage = {
  captured_at: '2026-10-01T06:12:00+05:30',
  latitude: '6.412850',
  longitude: '81.534180'
};
const incompleteImage = { captured_at: null, latitude: null, longitude: null };
const justification = 'Human figure carrying a rifle-shaped object near the river crossing at night';

const confirmedSuspicious = (overrides = {}) => ({
  classification: CLASSIFICATIONS.SUSPICIOUS_PERSON,
  escalationConfirmed: true,
  escalationJustification: justification,
  image: completeImage,
  ...overrides
});

const expectValidationError = (input, messagePattern) => {
  let thrown;
  try {
    evidenceReviewRules.evaluateReview(input);
  } catch (err) {
    thrown = err;
  }
  expect(thrown).toBeInstanceOf(Error);
  expect(thrown.status).toBe(400);
  expect(thrown.message).toMatch(messagePattern);
};

describe('UC02: Review and Escalate Camera-Trap Evidence - Business Rules Unit Tests', () => {
  describe('BR1: Evidence classification validation', () => {
    test('[POSITIVE CASE] should accept WILDLIFE_SPECIES', () => {
      const result = evidenceReviewRules.evaluateReview({ classification: 'WILDLIFE_SPECIES', image: completeImage });
      expect(result.classification).toBe('WILDLIFE_SPECIES');
    });

    test('[POSITIVE CASE] should accept SUSPICIOUS_PERSON', () => {
      const result = evidenceReviewRules.evaluateReview({ classification: 'SUSPICIOUS_PERSON', image: completeImage });
      expect(result.classification).toBe('SUSPICIOUS_PERSON');
    });

    test('[POSITIVE CASE] should accept UNKNOWN', () => {
      const result = evidenceReviewRules.evaluateReview({ classification: 'UNKNOWN', image: completeImage });
      expect(result.classification).toBe('UNKNOWN');
    });

    test('[NEGATIVE CASE] should reject a missing classification', () => {
      expectValidationError({ image: completeImage }, /classification is required/);
      expectValidationError({ classification: null, image: completeImage }, /classification is required/);
    });

    test('[NEGATIVE CASE] should reject an empty or whitespace-only classification', () => {
      expectValidationError({ classification: '', image: completeImage }, /classification is required/);
      expectValidationError({ classification: '   ', image: completeImage }, /classification is required/);
    });

    test('[NEGATIVE CASE] should reject an invalid classification', () => {
      expectValidationError({ classification: 'POACHER', image: completeImage }, /Invalid evidence classification "POACHER"/);
    });

    test('[EDGE CASE] should not silently normalise a wrongly cased or padded classification', () => {
      expectValidationError({ classification: 'unknown', image: completeImage }, /Invalid evidence classification/);
      expectValidationError({ classification: ' UNKNOWN ', image: completeImage }, /Invalid evidence classification/);
    });

    test('[ERROR CASE] should reject a call with no review input at all', () => {
      expectValidationError(undefined, /classification is required/);
    });
  });

  describe('BR4: Wildlife Species classification', () => {
    test('[POSITIVE CASE] WILDLIFE_SPECIES should set review status to REVIEWED', () => {
      const result = evidenceReviewRules.evaluateReview({ classification: 'WILDLIFE_SPECIES', image: completeImage });
      expect(result.reviewStatus).toBe(REVIEW_STATUSES.REVIEWED);
      expect(result.reviewComplete).toBe(true);
      expect(result.escalationConfirmationRequired).toBe(false);
    });

    test('[POSITIVE CASE] WILDLIFE_SPECIES should never create a ThreatAlert', () => {
      const result = evidenceReviewRules.evaluateReview({ classification: 'WILDLIFE_SPECIES', image: completeImage });
      expect(result.createThreatAlert).toBe(false);
    });

    test('[EDGE CASE] WILDLIFE_SPECIES with incomplete metadata should still be allowed', () => {
      const result = evidenceReviewRules.evaluateReview({ classification: 'WILDLIFE_SPECIES', image: incompleteImage });
      expect(result.metadataIncomplete).toBe(true);
      expect(result.reviewStatus).toBe(REVIEW_STATUSES.REVIEWED);
      expect(result.reviewComplete).toBe(true);
    });
  });

  describe('BR5: Unknown classification', () => {
    test('[POSITIVE CASE] UNKNOWN should set review status to NEEDS_FURTHER_REVIEW', () => {
      const result = evidenceReviewRules.evaluateReview({ classification: 'UNKNOWN', image: completeImage });
      expect(result.reviewStatus).toBe(REVIEW_STATUSES.NEEDS_FURTHER_REVIEW);
      expect(result.reviewComplete).toBe(true);
    });

    test('[POSITIVE CASE] UNKNOWN should never create a ThreatAlert', () => {
      const result = evidenceReviewRules.evaluateReview({ classification: 'UNKNOWN', image: completeImage });
      expect(result.createThreatAlert).toBe(false);
      expect(result.escalationConfirmationRequired).toBe(false);
    });

    test('[EDGE CASE] UNKNOWN with incomplete metadata should still be allowed', () => {
      const result = evidenceReviewRules.evaluateReview({ classification: 'UNKNOWN', image: incompleteImage });
      expect(result.metadataIncomplete).toBe(true);
      expect(result.reviewStatus).toBe(REVIEW_STATUSES.NEEDS_FURTHER_REVIEW);
    });
  });

  describe('BR2 / BR6: Suspicious Person escalation', () => {
    test('[NEGATIVE CASE] SUSPICIOUS_PERSON without escalation confirmation should not create a ThreatAlert', () => {
      const result = evidenceReviewRules.evaluateReview({ classification: 'SUSPICIOUS_PERSON', image: completeImage });
      expect(result.createThreatAlert).toBe(false);
      expect(result.reviewComplete).toBe(false);
      expect(result.reviewStatus).toBeNull();
      expect(result.escalationConfirmationRequired).toBe(true);
    });

    test('[NEGATIVE CASE] SUSPICIOUS_PERSON with escalation explicitly declined should not create a ThreatAlert', () => {
      const result = evidenceReviewRules.evaluateReview(
        confirmedSuspicious({ escalationConfirmed: false })
      );
      expect(result.createThreatAlert).toBe(false);
      expect(result.reviewComplete).toBe(false);
      expect(result.escalationJustification).toBeNull();
    });

    test('[NEGATIVE CASE] SUSPICIOUS_PERSON with confirmation should require a justification', () => {
      expectValidationError(
        confirmedSuspicious({ escalationJustification: undefined }),
        /escalation justification is required/
      );
    });

    test('[NEGATIVE CASE] confirmation with a null justification should be rejected', () => {
      expectValidationError(confirmedSuspicious({ escalationJustification: null }), /escalation justification is required/);
    });

    test('[NEGATIVE CASE] confirmation with an empty justification should be rejected', () => {
      expectValidationError(confirmedSuspicious({ escalationJustification: '' }), /escalation justification is required/);
    });

    test('[NEGATIVE CASE] confirmation with a whitespace-only justification should be rejected', () => {
      expectValidationError(confirmedSuspicious({ escalationJustification: ' \t\n  ' }), /escalation justification is required/);
    });

    test('[NEGATIVE CASE] confirmation with a non-text justification should be rejected', () => {
      expectValidationError(confirmedSuspicious({ escalationJustification: 42 }), /escalation justification is required/);
    });

    test('[POSITIVE CASE] confirmation with a valid justification should set REVIEWED_ESCALATED', () => {
      const result = evidenceReviewRules.evaluateReview(confirmedSuspicious());
      expect(result.reviewStatus).toBe(REVIEW_STATUSES.REVIEWED_ESCALATED);
      expect(result.reviewComplete).toBe(true);
      expect(result.escalationConfirmed).toBe(true);
      expect(result.escalationConfirmationRequired).toBe(false);
    });

    test('[POSITIVE CASE] a valid suspicious escalation should create a ThreatAlert', () => {
      const result = evidenceReviewRules.evaluateReview(confirmedSuspicious());
      expect(result.createThreatAlert).toBe(true);
      expect(result.escalationJustification).toBe(justification);
    });

    test('[EDGE CASE] a valid suspicious escalation with incomplete metadata should still be allowed', () => {
      const result = evidenceReviewRules.evaluateReview(confirmedSuspicious({ image: incompleteImage }));
      expect(result.metadataIncomplete).toBe(true);
      expect(result.reviewStatus).toBe(REVIEW_STATUSES.REVIEWED_ESCALATED);
      expect(result.createThreatAlert).toBe(true);
    });

    test('[EDGE CASE] only a boolean true counts as explicit confirmation (truthy strings are rejected)', () => {
      expectValidationError(confirmedSuspicious({ escalationConfirmed: 'true' }), /must be a boolean/);
      expectValidationError(confirmedSuspicious({ escalationConfirmed: 1 }), /must be a boolean/);
    });

    test('[EDGE CASE] a justification without confirmation should not escalate or create a ThreatAlert', () => {
      const result = evidenceReviewRules.evaluateReview(confirmedSuspicious({ escalationConfirmed: undefined }));
      expect(result.createThreatAlert).toBe(false);
      expect(result.reviewStatus).toBeNull();
      expect(result.escalationJustification).toBeNull();
    });
  });

  describe('Metadata completeness warning (captured_at, latitude, longitude)', () => {
    test('[POSITIVE CASE] complete captured_at, latitude and longitude should not be flagged', () => {
      const result = evidenceReviewRules.evaluateReview({ classification: 'UNKNOWN', image: completeImage });
      expect(result.metadataIncomplete).toBe(false);
      expect(result.missingMetadataFields).toEqual([]);
    });

    test('[NEGATIVE CASE] missing captured_at should be flagged as incomplete', () => {
      const image = { ...completeImage, captured_at: undefined };
      expect(evidenceReviewRules.isMetadataIncomplete(image)).toBe(true);
      expect(evidenceReviewRules.getMissingMetadataFields(image)).toEqual(['captured_at']);
    });

    test('[NEGATIVE CASE] missing latitude should be flagged as incomplete', () => {
      const image = { ...completeImage, latitude: undefined };
      expect(evidenceReviewRules.isMetadataIncomplete(image)).toBe(true);
      expect(evidenceReviewRules.getMissingMetadataFields(image)).toEqual(['latitude']);
    });

    test('[NEGATIVE CASE] missing longitude should be flagged as incomplete', () => {
      const image = { ...completeImage, longitude: undefined };
      expect(evidenceReviewRules.isMetadataIncomplete(image)).toBe(true);
      expect(evidenceReviewRules.getMissingMetadataFields(image)).toEqual(['longitude']);
    });

    test('[NEGATIVE CASE] multiple missing fields should all be reported', () => {
      const image = { captured_at: completeImage.captured_at };
      const result = evidenceReviewRules.evaluateReview({ classification: 'WILDLIFE_SPECIES', image });
      expect(result.metadataIncomplete).toBe(true);
      expect(result.missingMetadataFields).toEqual(['latitude', 'longitude']);
    });

    test('[EDGE CASE] null, empty and whitespace-only metadata values should be treated as missing', () => {
      expect(evidenceReviewRules.getMissingMetadataFields(incompleteImage)).toEqual(['captured_at', 'latitude', 'longitude']);
      expect(evidenceReviewRules.getMissingMetadataFields({ captured_at: '', latitude: '  ', longitude: null }))
        .toEqual(['captured_at', 'latitude', 'longitude']);
    });

    test('[EDGE CASE] a zero coordinate is valid metadata and should not be flagged', () => {
      const image = { captured_at: completeImage.captured_at, latitude: 0, longitude: 0 };
      expect(evidenceReviewRules.isMetadataIncomplete(image)).toBe(false);
    });

    test('[EDGE CASE] a missing image record should be treated as fully incomplete without throwing', () => {
      const result = evidenceReviewRules.evaluateReview({ classification: 'UNKNOWN' });
      expect(result.metadataIncomplete).toBe(true);
      expect(result.missingMetadataFields).toEqual(['captured_at', 'latitude', 'longitude']);
    });
  });

  describe('Edge cases: justification, notes and alert exclusivity', () => {
    test('[EDGE CASE] surrounding whitespace in the justification should be trimmed', () => {
      const result = evidenceReviewRules.evaluateReview(
        confirmedSuspicious({ escalationJustification: `   ${justification}\n ` })
      );
      expect(result.escalationJustification).toBe(justification);
    });

    test('[POSITIVE CASE] a valid classification without optional notes should be allowed', () => {
      const result = evidenceReviewRules.evaluateReview({ classification: 'WILDLIFE_SPECIES', image: completeImage });
      expect(result.notes).toBeNull();
      expect(result.reviewStatus).toBe(REVIEW_STATUSES.REVIEWED);
    });

    test('[POSITIVE CASE] optional notes should be trimmed and returned', () => {
      const result = evidenceReviewRules.evaluateReview({
        classification: 'UNKNOWN', notes: '  Animal partially hidden by foliage  ', image: completeImage
      });
      expect(result.notes).toBe('Animal partially hidden by foliage');
    });

    test('[NEGATIVE CASE] non-text notes should be rejected', () => {
      expectValidationError({ classification: 'UNKNOWN', notes: { text: 'x' }, image: completeImage }, /notes must be text/);
    });

    test('[EDGE CASE] notes should not affect escalation logic or substitute for a justification', () => {
      expectValidationError(
        confirmedSuspicious({ escalationJustification: '', notes: 'Clearly a poacher, escalate now' }),
        /escalation justification is required/
      );
      const withoutConfirmation = evidenceReviewRules.evaluateReview({
        classification: 'SUSPICIOUS_PERSON', notes: 'Clearly a poacher, escalate now', image: completeImage
      });
      expect(withoutConfirmation.createThreatAlert).toBe(false);
      const withNotes = evidenceReviewRules.evaluateReview(confirmedSuspicious({ notes: 'Second figure visible' }));
      const withoutNotes = evidenceReviewRules.evaluateReview(confirmedSuspicious());
      expect({ ...withNotes, notes: null }).toEqual(withoutNotes);
    });

    test('[EDGE CASE] only SUSPICIOUS_PERSON can ever return createThreatAlert = true', () => {
      const escalationInput = { escalationConfirmed: true, escalationJustification: justification, image: completeImage };
      Object.values(CLASSIFICATIONS).forEach((classification) => {
        const result = evidenceReviewRules.evaluateReview({ classification, ...escalationInput });
        expect(result.createThreatAlert).toBe(classification === CLASSIFICATIONS.SUSPICIOUS_PERSON);
        if (classification !== CLASSIFICATIONS.SUSPICIOUS_PERSON) {
          expect(result.escalationConfirmed).toBe(false);
          expect(result.escalationJustification).toBeNull();
        }
      });
    });
  });
});
