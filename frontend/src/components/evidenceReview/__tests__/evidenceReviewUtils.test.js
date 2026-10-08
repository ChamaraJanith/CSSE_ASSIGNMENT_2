import { describe, test, expect } from 'vitest';
import {
  QUEUE_TABS, applyQueueFilters, countByTab, describeApiError, filterBySearch, filterByStatus, filterByTab,
  formatDateTime, formatLocation, formatValue, getClassificationLabel, getMissingMetadataLabels, getPageNumbers,
  getStatusLabel, paginate, sortByCaptureTimeDesc,
} from '../evidenceReviewUtils';
import { queueItems } from './fixtures';

const codes = (items) => items.map((item) => item.imageCode);

describe('evidenceReviewUtils', () => {
  test('status and classification labels are human-readable and distinguish the final statuses', () => {
    expect(getStatusLabel('UNREVIEWED')).toBe('Unreviewed');
    expect(getStatusLabel('REVIEWED')).toBe('Reviewed');
    expect(getStatusLabel('NEEDS_FURTHER_REVIEW')).toBe('Needs Further Review');
    expect(getStatusLabel('REVIEWED_ESCALATED')).toBe('Reviewed – Escalated');
    expect(getClassificationLabel('WILDLIFE_SPECIES')).toBe('Wildlife Species');
    expect(getClassificationLabel('SUSPICIOUS_PERSON')).toBe('Suspicious Person');
    expect(getClassificationLabel('UNKNOWN')).toBe('Unknown');
  });

  test('Unreviewed tab groups UNREVIEWED and NEEDS_FURTHER_REVIEW; Reviewed tab groups REVIEWED and REVIEWED_ESCALATED', () => {
    expect(codes(filterByTab(queueItems, QUEUE_TABS.UNREVIEWED)))
      .toEqual(['IMG-YALA02-0001', 'IMG-WILP01-0001', 'IMG-WILP01-0002']);
    expect(codes(filterByTab(queueItems, QUEUE_TABS.REVIEWED)))
      .toEqual(['IMG-YALA01-0001', 'IMG-YALA01-0002', 'IMG-YALA02-0002']);
    expect(filterByTab(queueItems, QUEUE_TABS.ALL)).toHaveLength(6);
    expect(countByTab(queueItems)).toEqual({ UNREVIEWED: 3, REVIEWED: 3, ALL: 6 });
  });

  test('status filter narrows to one exact status and ALL keeps everything', () => {
    expect(codes(filterByStatus(queueItems, 'NEEDS_FURTHER_REVIEW'))).toEqual(['IMG-WILP01-0001']);
    expect(filterByStatus(queueItems, 'ALL')).toHaveLength(6);
  });

  test('search matches evidence ID, camera ID, location and park case-insensitively, ignoring blank input', () => {
    expect(codes(filterBySearch(queueItems, 'img-wilp01-0002'))).toEqual(['IMG-WILP01-0002']);
    expect(codes(filterBySearch(queueItems, 'ct-yala-02'))).toEqual(['IMG-YALA02-0001', 'IMG-YALA02-0002']);
    expect(filterBySearch(queueItems, 'wilpattu')).toHaveLength(2);
    expect(filterBySearch(queueItems, '   ')).toHaveLength(6);
    expect(codes(applyQueueFilters(queueItems, { tab: QUEUE_TABS.REVIEWED, status: 'REVIEWED_ESCALATED', search: 'yala02' })))
      .toEqual(['IMG-YALA02-0002']);
  });

  test('dates are shown in park local time and missing or invalid values read "Not recorded"', () => {
    expect(formatDateTime('2026-10-01T00:42:00+00:00')).toBe('01 Oct 2026, 06:12');
    expect(formatDateTime(null)).toBe('Not recorded');
    expect(formatDateTime('not-a-date')).toBe('Not recorded');
    expect(formatValue(null, ' °C')).toBe('Not recorded');
    expect(formatValue('27.5', ' °C')).toBe('27.5 °C');
    expect(formatLocation({ locationName: 'Kokmote River Buffer Trail', parkName: 'Wilpattu National Park' }))
      .toBe('Kokmote River Buffer Trail, Wilpattu National Park');
  });

  test('sorting puts the newest capture first and missing or invalid capture times last, without mutating the input', () => {
    const withTime = (imageCode, capturedAt) => ({ imageCode, metadata: { capturedAt } });
    const items = [
      withTime('NO-TIME', null),
      withTime('OLD', '2026-10-01T00:00:00+00:00'),
      withTime('BAD-TIME', 'not-a-date'),
      withTime('NEW', '2026-10-03T00:00:00+00:00'),
      { imageCode: 'NO-METADATA' },
      withTime('MID', '2026-10-02T00:00:00+00:00'),
    ];
    expect(codes(sortByCaptureTimeDesc(items))).toEqual(['NEW', 'MID', 'OLD', 'NO-TIME', 'BAD-TIME', 'NO-METADATA']);
    expect(codes(items)[0]).toBe('NO-TIME');
    expect(sortByCaptureTimeDesc([])).toEqual([]);
  });

  test('pagination returns 5 items per page with the visible range and clamps out-of-range pages', () => {
    const items = Array.from({ length: 12 }, (_, index) => index + 1);
    expect(paginate(items, 1)).toEqual({ pageItems: [1, 2, 3, 4, 5], currentPage: 1, totalPages: 3, total: 12, from: 1, to: 5 });
    expect(paginate(items, 3)).toMatchObject({ pageItems: [11, 12], from: 11, to: 12 });
    expect(paginate(items, 9)).toMatchObject({ currentPage: 3, pageItems: [11, 12] });
    expect(paginate(items, 0)).toMatchObject({ currentPage: 1 });
    expect(paginate([], 2)).toEqual({ pageItems: [], currentPage: 1, totalPages: 1, total: 0, from: 0, to: 0 });
  });

  test('page numbers show every page up to 7, otherwise first, last and the current neighbourhood with gaps', () => {
    expect(getPageNumbers(1, 1)).toEqual([1]);
    expect(getPageNumbers(2, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(getPageNumbers(1, 10)).toEqual([1, 2, 'gap', 10]);
    expect(getPageNumbers(5, 10)).toEqual([1, 'gap', 4, 5, 6, 'gap', 10]);
    expect(getPageNumbers(10, 10)).toEqual([1, 'gap', 9, 10]);
  });

  test('missing metadata fields map to readable warnings', () => {
    expect(getMissingMetadataLabels(['captured_at', 'latitude', 'longitude']))
      .toEqual(['Capture time not recorded', 'Latitude not recorded', 'Longitude not recorded']);
    expect(getMissingMetadataLabels([])).toEqual([]);
  });

  test('API errors map to officer-facing messages by HTTP status', () => {
    expect(describeApiError({ status: 401 })).toMatch(/session has expired/);
    expect(describeApiError({ status: 403 })).toMatch(/restricted to Wildlife Officers/);
    expect(describeApiError({ status: 404 })).toMatch(/could not be found/);
    expect(describeApiError({ status: 409, message: 'Evidence X has already been reviewed' })).toBe('Evidence X has already been reviewed');
    expect(describeApiError(new TypeError('Failed to fetch'))).toMatch(/Unable to reach/);
  });
});
