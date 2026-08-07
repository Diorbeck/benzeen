import { describe, it, expect } from 'vitest';
import {
  computeBucket,
  formatAvgDuration,
  startOfTashkentDay,
  startOfLast7Days,
  tashkentRangeToUtc,
  type DeliveryRow,
} from './courier-stats';

describe('computeBucket', () => {
  it('counts deliveries and sums liters', () => {
    const rows: DeliveryRow[] = [
      { deliveredAt: new Date(), takenAt: null, dispensedVolume: 30 },
      { deliveredAt: new Date(), takenAt: null, dispensedVolume: 40 },
    ];
    const b = computeBucket(rows);
    expect(b.count).toBe(2);
    expect(b.liters).toBe(70);
  });

  it('averages TAKE→DELIVERED only over rows with both timestamps', () => {
    const rows: DeliveryRow[] = [
      // 20 min
      {
        takenAt: new Date('2026-08-07T10:00:00Z'),
        deliveredAt: new Date('2026-08-07T10:20:00Z'),
        dispensedVolume: 30,
      },
      // 40 min
      {
        takenAt: new Date('2026-08-07T11:00:00Z'),
        deliveredAt: new Date('2026-08-07T11:40:00Z'),
        dispensedVolume: 30,
      },
      // no takenAt → excluded from the average, still counted/summed
      { takenAt: null, deliveredAt: new Date('2026-08-07T12:00:00Z'), dispensedVolume: 10 },
    ];
    const b = computeBucket(rows);
    expect(b.count).toBe(3);
    expect(b.liters).toBe(70);
    expect(b.avgTakeToDeliverMs).toBe(30 * 60 * 1000); // (20+40)/2 = 30 min
  });

  it('returns null average when no row has both timestamps', () => {
    const rows: DeliveryRow[] = [
      { deliveredAt: new Date(), takenAt: null, dispensedVolume: 30 },
    ];
    expect(computeBucket(rows).avgTakeToDeliverMs).toBeNull();
  });

  it('ignores rows without a deliveredAt', () => {
    const rows: DeliveryRow[] = [
      { deliveredAt: null, takenAt: new Date(), dispensedVolume: 30 },
    ];
    const b = computeBucket(rows);
    expect(b.count).toBe(0);
    expect(b.liters).toBe(0);
  });
});

describe('formatAvgDuration', () => {
  it('formats sub-hour durations in minutes', () => {
    expect(formatAvgDuration(23 * 60 * 1000)).toBe('23 мин');
  });
  it('formats hour+ durations', () => {
    expect(formatAvgDuration((60 + 5) * 60 * 1000)).toBe('1 ч 05 мин');
  });
  it('renders a dash for null', () => {
    expect(formatAvgDuration(null)).toBe('—');
  });
});

describe('startOfTashkentDay', () => {
  it('returns 00:00 Tashkent (19:00Z previous day)', () => {
    // 2026-08-07T02:00:00Z is 07:00 Tashkent → day start is 2026-08-06T19:00:00Z.
    const start = startOfTashkentDay(new Date('2026-08-07T02:00:00Z'));
    expect(start.toISOString()).toBe('2026-08-06T19:00:00.000Z');
  });

  it('last-7-days window starts 6 days before today', () => {
    const now = new Date('2026-08-07T02:00:00Z');
    const diff = startOfTashkentDay(now).getTime() - startOfLast7Days(now).getTime();
    expect(diff).toBe(6 * 24 * 60 * 60 * 1000);
  });
});

describe('tashkentRangeToUtc', () => {
  it('maps an inclusive local range to a half-open UTC window', () => {
    const { start, end } = tashkentRangeToUtc('2026-08-01', '2026-08-07');
    // Tashkent midnight is UTC−5h → previous day 19:00Z.
    expect(start.toISOString()).toBe('2026-07-31T19:00:00.000Z');
    // `to` day is fully included → end is start of 2026-08-08 Tashkent.
    expect(end.toISOString()).toBe('2026-08-07T19:00:00.000Z');
  });

  it('includes the whole to-day (one-day range spans 24h)', () => {
    const { start, end } = tashkentRangeToUtc('2026-08-07', '2026-08-07');
    expect(end.getTime() - start.getTime()).toBe(24 * 60 * 60 * 1000);
  });

  it('falls back to today for blank/invalid input', () => {
    const now = new Date('2026-08-07T02:00:00Z');
    const { start, end } = tashkentRangeToUtc(undefined, 'garbage', now);
    expect(start.toISOString()).toBe('2026-08-06T19:00:00.000Z');
    expect(end.getTime() - start.getTime()).toBe(24 * 60 * 60 * 1000);
  });

  it('collapses an inverted range to a single day', () => {
    const { start, end } = tashkentRangeToUtc('2026-08-07', '2026-08-01');
    expect(end.getTime() - start.getTime()).toBe(24 * 60 * 60 * 1000);
  });
});
