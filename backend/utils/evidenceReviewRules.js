const CLASSIFICATIONS = Object.freeze({
  WILDLIFE_SPECIES: 'WILDLIFE_SPECIES',
  SUSPICIOUS_PERSON: 'SUSPICIOUS_PERSON',
  UNKNOWN: 'UNKNOWN'
});

const REVIEW_STATUSES = Object.freeze({
  UNREVIEWED: 'UNREVIEWED',
  REVIEWED: 'REVIEWED',
  NEEDS_FURTHER_REVIEW: 'NEEDS_FURTHER_REVIEW',
  REVIEWED_ESCALATED: 'REVIEWED_ESCALATED'
});

// Fields checked for the UC02 incomplete-metadata warning (warning only, never blocks a review)
const REQUIRED_METADATA_FIELDS = Object.freeze(['captured_at', 'latitude', 'longitude']);

const validationError = (message) => {
  const err = new Error(message);
  err.status = 400;
  return err;
};

const isBlank = (value) =>
  value === undefined || value === null || (typeof value === 'string' && value.trim() === '');

class EvidenceReviewRules {
  /**
   * Returns the required metadata fields that are missing (null, undefined, empty or whitespace).
   * 0 is a valid coordinate and is not treated as missing.
   */
  static getMissingMetadataFields(image) {
    const source = image || {};
    return REQUIRED_METADATA_FIELDS.filter((field) => isBlank(source[field]));
  }

  static isMetadataIncomplete(image) {
    return EvidenceReviewRules.getMissingMetadataFields(image).length > 0;
  }

  /**
   * Applies the UC02 business rules to a Wildlife Officer's review decision.
   *
   * BR1  exactly one valid classification is required
   * BR2  ThreatAlert only for SUSPICIOUS_PERSON with explicit escalation confirmation
   * BR4  WILDLIFE_SPECIES -> REVIEWED, no ThreatAlert
   * BR5  UNKNOWN -> NEEDS_FURTHER_REVIEW, no ThreatAlert (stays available for secondary review)
   * BR6  notes optional; justification mandatory (non-blank, trimmed) for a confirmed escalation
   * Incomplete metadata only raises a warning flag and never blocks the review.
   *
   * For SUSPICIOUS_PERSON without confirmation the review is not complete:
   * reviewComplete = false, reviewStatus = null (nothing to record yet) and
   * escalationConfirmationRequired = true.
   *
   * @throws {Error} with status 400 when the input violates a business rule
   */
  static evaluateReview({ classification, escalationConfirmed, escalationJustification, notes, image } = {}) {
    if (isBlank(classification)) {
      throw validationError('Evidence classification is required.');
    }
    if (!Object.values(CLASSIFICATIONS).includes(classification)) {
      throw validationError(
        `Invalid evidence classification "${classification}". Allowed values: ${Object.values(CLASSIFICATIONS).join(', ')}.`
      );
    }
    if (escalationConfirmed !== undefined && escalationConfirmed !== null && typeof escalationConfirmed !== 'boolean') {
      throw validationError('Escalation confirmation must be a boolean value.');
    }
    if (!isBlank(notes) && typeof notes !== 'string') {
      throw validationError('Review notes must be text.');
    }

    const missingMetadataFields = EvidenceReviewRules.getMissingMetadataFields(image);
    const result = {
      classification,
      reviewStatus: null,
      reviewComplete: true,
      createThreatAlert: false,
      escalationConfirmed: false,
      escalationConfirmationRequired: false,
      escalationJustification: null,
      notes: isBlank(notes) ? null : notes.trim(),
      metadataIncomplete: missingMetadataFields.length > 0,
      missingMetadataFields
    };

    if (classification === CLASSIFICATIONS.WILDLIFE_SPECIES) {
      result.reviewStatus = REVIEW_STATUSES.REVIEWED;
      return result;
    }

    if (classification === CLASSIFICATIONS.UNKNOWN) {
      result.reviewStatus = REVIEW_STATUSES.NEEDS_FURTHER_REVIEW;
      return result;
    }

    // SUSPICIOUS_PERSON: only an explicit `true` counts as confirmation
    if (escalationConfirmed !== true) {
      result.reviewComplete = false;
      result.escalationConfirmationRequired = true;
      return result;
    }

    if (typeof escalationJustification !== 'string' || escalationJustification.trim() === '') {
      throw validationError('An escalation justification is required to confirm escalation of suspicious evidence.');
    }

    result.reviewStatus = REVIEW_STATUSES.REVIEWED_ESCALATED;
    result.createThreatAlert = true;
    result.escalationConfirmed = true;
    result.escalationJustification = escalationJustification.trim();
    return result;
  }
}

module.exports = EvidenceReviewRules;
module.exports.CLASSIFICATIONS = CLASSIFICATIONS;
module.exports.REVIEW_STATUSES = REVIEW_STATUSES;
module.exports.REQUIRED_METADATA_FIELDS = REQUIRED_METADATA_FIELDS;
