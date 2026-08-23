import { describe, it, expect } from 'vitest';
import { parseMinutes, addMinutes, minutesToTime, getScheduleForStop, dayLabel } from './time.js';

describe('time utils', () => {
  it('parseMinutes liczy minuty dnia', () => {
    expect(parseMinutes('06:30')).toBe(390);
    expect(parseMinutes('00:00')).toBe(0);
  });

  it('minutesToTime formatuje z powrotem', () => {
    expect(minutesToTime(390)).toBe('06:30');
    expect(minutesToTime(24 * 60 + 5)).toBe('00:05');
  });

  it('addMinutes dodaje z zawinięciem doby', () => {
    expect(addMinutes('23:59', 2)).toBe('00:01');
  });

  it('getScheduleForStop przesuwa bazowe godziny o 2 min na przystanek', () => {
    const dir = { baseTimes: { weekday: ['06:00', '07:00'], saturday: [], sunday: ['08:00'] } };
    expect(getScheduleForStop(dir, 0, 'weekday')).toEqual(['06:00', '07:00']);
    expect(getScheduleForStop(dir, 3, 'weekday')).toEqual(['06:06', '07:06']);
    expect(getScheduleForStop(dir, 1, 'saturday')).toEqual([]);
  });

  it('dayLabel po polsku', () => {
    expect(dayLabel('weekday')).toBe('Dzień powszedni');
    expect(dayLabel('sunday')).toBe('Niedziela');
  });
});
