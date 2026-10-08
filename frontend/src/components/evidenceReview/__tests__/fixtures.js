// Test data mirroring the Step 3 API response shape and the current seeded evidence states.

const STORAGE = 'https://example.supabase.co/storage/v1/object/public/evidence/camera-traps';
const OFFICER_ID = 'e916e72b-2f48-4287-a6ed-d5ed956889d2';

const yala1 = {
  id: 1, trapCode: 'CT-YALA-01', locationName: 'Northern River Basin Crossing (Sector 7B)',
  latitude: '6.412800', longitude: '81.534200', parkId: 1, parkName: 'Yala National Park (Ruhuna)',
};
const yala2 = { ...yala1, id: 2, trapCode: 'CT-YALA-02', locationName: 'Katagamuwa Sanctuary Boundary Fence' };
const wilpattu = {
  id: 3, trapCode: 'CT-WILP-01', locationName: 'Kokmote River Buffer Trail',
  latitude: '8.492000', longitude: '80.035000', parkId: 2, parkName: 'Wilpattu National Park',
};

const completeMetadata = (capturedAt, latitude, longitude) => ({
  capturedAt, latitude, longitude, cameraModel: 'Browning Recon Force Elite HP5', triggerType: 'MOTION', ambientTemperatureC: '27.5',
});

const item = (overrides) => ({
  isReviewable: false,
  metadataIncomplete: false,
  missingMetadataFields: [],
  createdAt: '2026-10-07T00:00:00+00:00',
  updatedAt: '2026-10-07T00:00:00+00:00',
  ...overrides,
});

export const queueItems = [
  item({
    id: 1, imageCode: 'IMG-YALA01-0001', imageUrl: `${STORAGE}/CT-YALA-01/IMG-YALA01-0001.jpg`, reviewStatus: 'REVIEWED',
    cameraTrap: yala1, metadata: completeMetadata('2026-10-01T00:42:00+00:00', '6.412850', '81.534180'),
  }),
  item({
    id: 2, imageCode: 'IMG-YALA01-0002', imageUrl: `${STORAGE}/CT-YALA-01/IMG-YALA01-0002.jpg`, reviewStatus: 'REVIEWED_ESCALATED',
    cameraTrap: yala1, metadata: { ...completeMetadata('2026-10-01T20:17:00+00:00', '6.412790', '81.534260'), triggerType: 'HEAT' },
  }),
  item({
    id: 3, imageCode: 'IMG-YALA02-0001', imageUrl: `${STORAGE}/CT-YALA-02/IMG-YALA02-0001.jpg`, reviewStatus: 'UNREVIEWED',
    isReviewable: true, cameraTrap: yala2, metadataIncomplete: true, missingMetadataFields: ['latitude', 'longitude'],
    metadata: { capturedAt: '2026-10-02T13:05:00+00:00', latitude: null, longitude: null, cameraModel: 'Bushnell Core DS-4K', triggerType: 'MOTION', ambientTemperatureC: '26.0' },
  }),
  item({
    id: 4, imageCode: 'IMG-YALA02-0002', imageUrl: `${STORAGE}/CT-YALA-02/IMG-YALA02-0002.jpg`, reviewStatus: 'REVIEWED_ESCALATED',
    cameraTrap: yala2, metadataIncomplete: true, missingMetadataFields: ['captured_at', 'latitude', 'longitude'],
    metadata: { capturedAt: null, latitude: null, longitude: null, cameraModel: 'Bushnell Core DS-4K', triggerType: 'HEAT', ambientTemperatureC: null },
  }),
  item({
    id: 5, imageCode: 'IMG-WILP01-0001', imageUrl: `${STORAGE}/CT-WILP-01/IMG-WILP01-0001.jpg`, reviewStatus: 'NEEDS_FURTHER_REVIEW',
    isReviewable: true, cameraTrap: wilpattu, metadata: { ...completeMetadata('2026-10-02T22:50:00+00:00', '8.492040', '80.035110'), cameraModel: 'Reconyx HyperFire 2' },
  }),
  item({
    id: 6, imageCode: 'IMG-WILP01-0002', imageUrl: 'https://camera-trap-feed.invalid/CT-WILP-01/IMG-WILP01-0002.jpg', reviewStatus: 'UNREVIEWED',
    isReviewable: true, cameraTrap: wilpattu, metadata: { ...completeMetadata('2026-10-03T17:28:00+00:00', '8.491970', '80.034930'), cameraModel: 'Reconyx HyperFire 2' },
  }),
];

// Larger queue for pagination: IMG-<prefix>-01..NN captured one hour apart, so the highest number is the newest
export const generateQueueItems = (count, { prefix, reviewStatus = 'UNREVIEWED', idOffset = 100 } = {}) =>
  Array.from({ length: count }, (_, index) => {
    const number = String(index + 1).padStart(2, '0');
    return item({
      id: idOffset + index + 1,
      imageCode: `IMG-${prefix}-${number}`,
      imageUrl: `${STORAGE}/CT-TEST/IMG-${prefix}-${number}.jpg`,
      reviewStatus,
      isReviewable: reviewStatus === 'UNREVIEWED' || reviewStatus === 'NEEDS_FURTHER_REVIEW',
      cameraTrap: yala1,
      metadata: completeMetadata(new Date(Date.UTC(2026, 8, 1, index)).toISOString(), '6.412850', '81.534180'),
    });
  });

const byId = (id) => queueItems.find((entry) => entry.id === id);

export const detail = (id, overrides = {}) => ({ ...byId(id), reviews: [], threatAlerts: [], ...overrides });

export const previousUnknownReview = {
  id: 2, imageId: 5, reviewedBy: OFFICER_ID, classification: 'UNKNOWN', notes: 'Indistinct shape behind foliage',
  metadataIncompleteAcknowledged: false, escalationConfirmed: false, escalationJustification: null,
  createdAt: '2026-10-07T03:00:00+00:00',
};

export const reviewResult = (id, overrides = {}) => {
  const evidence = byId(id);
  return {
    imageId: id,
    imageCode: evidence.imageCode,
    reviewRecorded: true,
    reviewComplete: true,
    escalationConfirmationRequired: false,
    metadataIncomplete: evidence.metadataIncomplete,
    missingMetadataFields: evidence.missingMetadataFields,
    review: { id: 10, imageId: id, reviewedBy: OFFICER_ID, notes: null, createdAt: '2026-10-07T05:00:00+00:00' },
    threatAlert: null,
    ...overrides,
  };
};

export const confirmationRequiredResult = (id) => ({
  ...reviewResult(id),
  classification: 'SUSPICIOUS_PERSON',
  reviewRecorded: false,
  reviewComplete: false,
  escalationConfirmationRequired: true,
  reviewStatus: 'UNREVIEWED',
  review: null,
  threatAlert: null,
});

export const escalatedResult = (id, justification) => reviewResult(id, {
  classification: 'SUSPICIOUS_PERSON',
  reviewStatus: 'REVIEWED_ESCALATED',
  review: { id: 11, imageId: id, reviewedBy: OFFICER_ID, classification: 'SUSPICIOUS_PERSON', escalationConfirmed: true, escalationJustification: justification },
  threatAlert: {
    id: 3, cameraTrapImageId: id, evidenceReviewId: 11, createdBy: OFFICER_ID, justification, status: 'OPEN',
    createdAt: '2026-10-07T05:00:00+00:00',
  },
});

export const apiError = (status, message) => Object.assign(new Error(message), { status });
