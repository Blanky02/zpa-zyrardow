import { describe, it, expect } from 'vitest';
import { formatDestination, normalizeStopName, findDirectRoutes } from './stops.js';

describe('formatDestination', () => {
  it('zwraca tylko przystanek końcowy po strzałce', () => {
    expect(formatDestination({ short: 'A → B' })).toBe('B');
  });

  it('ucina powtórzony prefiks ŻYRARDÓW i normalizuje wielkość liter', () => {
    expect(formatDestination({ short: 'ŻYRARDÓW ŻEROMSKIEGO PĘTLA → ŻYRARDÓW ZALEW ŻYRARDOWSKI' }))
      .toBe('Zalew Żyrardowski');
  });

  it('ucina numer stanowiska typu "/ I"', () => {
    expect(formatDestination({ short: 'ŻYRARDÓW SPÓŁDZIELCZA → WISKITKI  PL. Wolności 5/6 / I' }))
      .toBe('Wiskitki Pl. Wolności 5/6');
  });

  it('zostawia wielkie litery dla skrótów', () => {
    expect(formatDestination({ short: 'DZIAŁKI OSP → MIĘDZYBORÓW' })).toBe('Międzyborów');
    expect(formatDestination({ short: 'X → ŻYRARDÓW D.A.' })).toBe('D.A.');
  });

  it('bez strzałki obrabia cały napis; pusty opis daje pusty wynik', () => {
    expect(formatDestination({ short: 'ŻYRARDÓW SPÓŁDZIELCZA' })).toBe('Spółdzielcza');
    expect(formatDestination(null)).toBe('');
  });

  it('używa fallbacka, gdy brak opisu kierunku', () => {
    expect(formatDestination({}, 'Linia okrężna')).toBe('Linia okrężna');
  });
});

describe('normalizeStopName', () => {
  it('ujednolica zapis skrócony miejscowości i nawias stanowiska', () => {
    expect(normalizeStopName('Żyr. Dworcowa [2]')).toBe('ZYRARDOW DWORCOWA');
  });
});

describe('findDirectRoutes', () => {
  const line = { id: '1', number: '1', color: 'bg-emerald-600' };
  const baseDir = {
    id: '1a',
    label: 'A → C',
    stops: ['ŻYRARDÓW D.A.', 'ŻYRARDÓW ŚRODKOWA/BOHATERÓW', 'ŻYRARDÓW SPÓŁDZIELCZA'],
    baseTimes: { weekday: ['05:14'], saturday: [], sunday: [] },
  };
  const busData = { lines: [{ ...line, directions: [baseDir] }] };

  it('używa rzeczywistych godzin PDF-ów dla odcinka trasy', () => {
    const dir = {
      ...baseDir,
      stopsTimes: { weekday: [['05:14', '05:16', '05:24']] },
    };
    const routes = findDirectRoutes({ lines: [{ ...line, directions: [dir] }] }, 'D.A.', 'SPÓŁDZIELCZA', 'weekday');
    expect(routes).toHaveLength(1);
    expect(routes[0].depTime).toBe('05:14');
    expect(routes[0].arrTime).toBe('05:24');
    expect(routes[0].duration).toBe(10);
    expect(routes[0].timesSource).toBe('pdf');
  });

  it('pomija kurs, gdy PDF nie ma godziny na którymś przystanku', () => {
    const dir = {
      ...baseDir,
      stopsTimes: { weekday: [['05:14', null, '05:24']] },
    };
    // na ŚRODKOWA/BOHATERÓW (indeks 1) kurs nie ma godziny w PDF
    const routes = findDirectRoutes({ lines: [{ ...line, directions: [dir] }] }, 'D.A.', 'BOHATERÓW', 'weekday');
    expect(routes).toHaveLength(0);
  });

  it('fallback: przybliżenie +2 min/przystanek dla danych bez PDF', () => {
    const routes = findDirectRoutes(busData, 'D.A.', 'SPÓŁDZIELCZA', 'weekday');
    expect(routes).toHaveLength(1);
    expect(routes[0].depTime).toBe('05:14');
    expect(routes[0].arrTime).toBe('05:18');
    expect(routes[0].duration).toBe(4);
    expect(routes[0].timesSource).toBe('estimate');
  });
});
