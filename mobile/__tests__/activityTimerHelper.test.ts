import { formatCountdown, formatClockTime } from '../src/features/myDay/services/activityTimerHelper';

describe('activityTimerHelper', () => {
  it('formats countdown cleanly and clamps negative values to 00:00', () => {
    expect(formatCountdown(0)).toBe('00:00');
    expect(formatCountdown(-5000)).toBe('00:00');
    expect(formatCountdown(90_000)).toBe('01:30');
    expect(formatCountdown(3_665_000)).toBe('1:01:05');
  });

  it('formats clock timestamps cleanly in 12-hour format', () => {
    const sample = new Date(2026, 10, 12, 15, 5, 0).getTime();
    expect(formatClockTime(sample)).toBe('03:05 PM');
  });
});
