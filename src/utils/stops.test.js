import { describe, it, expect } from 'vitest';
import { formatDestination, normalizeStopName } from './stops.js';

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
