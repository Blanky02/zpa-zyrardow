# Audyt kolejności przystanków względem PDF

Zweryfikowano: `2026-08-23`
Kierunki: **22/22 zgodne**
Pozycje przystanków: **537**
Błędy: **0**

| Linia | Kierunek | Liczba | PDF ważny od | Wynik |
|---:|---|---:|---:|---|
| 0 | ŻYRARDÓW ŻEROMSKIEGO PĘTLA → ŻYRARDÓW ZALEW ŻYRARDOWSKI | 23 | 2026-07-04 | ✅ zgodny |
| 0 | ŻYRARDÓW ZALEW ŻYRARDOWSKI → ŻYRARDÓW ŻEROMSKIEGO PĘTLA | 23 | 2026-07-04 | ✅ zgodny |
| 0 | ŻYRARDÓW SPÓŁDZIELCZA → ŻYRARDÓW ZALEW ŻYRARDOWSKI | 20 | 2026-07-04 | ✅ zgodny |
| 0 | ŻYRARDÓW ZALEW ŻYRARDOWSKI → ŻYRARDÓW SPÓŁDZIELCZA | 20 | 2026-07-04 | ✅ zgodny |
| 1 | ŻYRARDÓW D.A. → ŻYRARDÓW SPÓŁDZIELCZA | 9 | 2026-05-01 | ✅ zgodny |
| 1 | ŻYRARDÓW SPÓŁDZIELCZA → ŻYRARDÓW D.A. | 9 | 2026-05-01 | ✅ zgodny |
| 2 | ŻYRARDÓW ŻEROMSKIEGO PĘTLA → ŻYRARDÓW SPÓŁDZIELCZA | 23 | 2026-03-10 | ✅ zgodny |
| 2 | ŻYRARDÓW SPÓŁDZIELCZA → ŻYRARDÓW ŻEROMSKIEGO PĘTLA | 20 | 2026-03-10 | ✅ zgodny |
| 3 | DZIAŁKI OSP → MIĘDZYBORÓW | 38 | 2026-05-01 | ✅ zgodny |
| 3 | MIĘDZYBORÓW → DZIAŁKI OSP | 37 | 2026-05-01 | ✅ zgodny |
| 4 | WISKITKI  PL. Wolności 5/6 / I → ŻYRARDÓW SPÓŁDZIELCZA | 23 | 2026-08-01 | ✅ zgodny |
| 4 | ŻYRARDÓW SPÓŁDZIELCZA → WISKITKI  PL. Wolności 5/6 / I | 23 | 2026-08-01 | ✅ zgodny |
| 5 | ŻYRARDÓW MOSTOWA PĘTLA → ŻYRARDÓW KORYTÓW | 38 | 2026-07-04 | ✅ zgodny |
| 5 | ŻYRARDÓW KORYTÓW → ŻYRARDÓW MOSTOWA PĘTLA | 35 | 2026-07-04 | ✅ zgodny |
| 7 | ŻYRARDÓW ŻEROMSKIEGO PĘTLA → ŻYRARDÓW SPÓŁDZIELCZA | 23 | 2026-05-01 | ✅ zgodny |
| 7 | ŻYRARDÓW SPÓŁDZIELCZA → ŻYRARDÓW ŻEROMSKIEGO PĘTLA | 20 | 2026-05-01 | ✅ zgodny |
| 8 | WISKITKI  PL. Wolności 5/6 / I → ŻYRARDÓW SPÓŁDZIELCZA | 26 | 2026-05-01 | ✅ zgodny |
| 8 | ŻYRARDÓW SPÓŁDZIELCZA → WISKITKI  PL. Wolności 5/6 / I | 23 | 2026-05-01 | ✅ zgodny |
| 9 | ŻYRARDÓW ŻEROMSKIEGO PĘTLA → ŻYRARDÓW D.A. | 11 | 2026-05-01 | ✅ zgodny |
| 9 | ŻYRARDÓW D.A. → ŻYRARDÓW ŻEROMSKIEGO PĘTLA | 12 | 2026-05-01 | ✅ zgodny |
| 10 | ŻYRARDÓW MOSTOWA PĘTLA → KORYTÓW LAS | 42 | 2026-05-01 | ✅ zgodny |
| 10 | KORYTÓW LAS → ŻYRARDÓW MOSTOWA PĘTLA | 39 | 2026-05-01 | ✅ zgodny |

## Zakres kontroli

- Widok **Linie**: tablica `direction.stops`.
- Widok **Mapa**: kolejność `direction.stops_full` i współrzędne każdego stanowiska.
- Źródło: kolumny „Dworce i przystanki” dla obu kierunków w oficjalnych PDF PKS Gostynin.
