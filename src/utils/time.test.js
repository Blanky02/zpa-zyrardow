import { describe, it, expect } from 'vitest';
import { parseMinutes, addMinutes, minutesToTime, getScheduleForStop, getCoursesForDay, hasPdfSchedule, dayLabel } from './time.js';

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

  it('getScheduleForStop przesuwa bazowe godziny o 2 min na przystanek (fallback bez PDF)', () => {
    const dir = { baseTimes: { weekday: ['06:00', '07:00'], saturday: [], sunday: ['08:00'] } };
    expect(getScheduleForStop(dir, 0, 'weekday')).toEqual(['06:00', '07:00']);
    expect(getScheduleForStop(dir, 3, 'weekday')).toEqual(['06:06', '07:06']);
    expect(getScheduleForStop(dir, 1, 'saturday')).toEqual([]);
  });

  it('hasPdfSchedule rozpoznaje rozkład z PDF-ów', () => {
    expect(hasPdfSchedule({ stopsTimes: { weekday: [['05:14', '05:16']] } }, 'weekday')).toBe(true);
    expect(hasPdfSchedule({ stopsTimes: { weekday: [] } }, 'weekday')).toBe(false);
    expect(hasPdfSchedule({}, 'weekday')).toBe(false);
  });

  it('getCoursesForDay zwraca kursy z PDF albo godziny bazowe', () => {
    const pdfDir = { baseTimes: { weekday: ['05:14'] }, stopsTimes: { weekday: [['05:14', '05:16', null]] } };
    expect(getCoursesForDay(pdfDir, 'weekday')).toEqual([['05:14', '05:16', null]]);
    const legacyDir = { baseTimes: { weekday: ['06:00'] } };
    expect(getCoursesForDay(legacyDir, 'weekday')).toEqual([['06:00']]);
  });

  it('getScheduleForStop czyta rzeczywiste godziny przystanku z PDF-u (bez +2 min)', () => {
    // kurs 05:14 z D.A. na BOHATERÓW przyjeżdża o 05:16, a nie 05:18 (przybliżenie)
    const dir = {
      baseTimes: { weekday: ['05:14'] },
      stopsTimes: { weekday: [['05:14', '05:16', '05:24']] },
    };
    expect(getScheduleForStop(dir, 1, 'weekday')).toEqual(['05:16']);
    expect(getScheduleForStop(dir, 2, 'weekday')).toEqual(['05:24']);
  });

  it('getScheduleForStop pomija kursy bez godziny na tym przystanku i sortuje', () => {
    const dir = {
      baseTimes: { weekday: ['09:00', '05:14'] },
      stopsTimes: { weekday: [['09:00', null, '09:10'], ['05:14', '05:20', '05:30']] },
    };
    expect(getScheduleForStop(dir, 1, 'weekday')).toEqual(['05:20']);
    expect(getScheduleForStop(dir, 2, 'weekday')).toEqual(['05:30', '09:10']);
  });

  it('dayLabel po polsku', () => {
    expect(dayLabel('weekday')).toBe('Dzień powszedni');
    expect(dayLabel('sunday')).toBe('Niedziela');
  });
});
