import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import App from '../App.jsx';

const BUS_DATA = {
  meta: { version: 'test-1', generatedAt: '2026-08-23T00:00:00Z' },
  lines: [
    {
      id: '1',
      number: '1',
      name: 'Linia testowa',
      color: '1',
      directions: [
        {
          short: 'ŻYRARDÓW D.A. → ŻYRARDÓW SPÓŁDZIELCZA',
          label: 'ŻYRARDÓW D.A. → ŻYRARDÓW SPÓŁDZIELCZA',
          stops: ['Dworzec', 'Rynek', 'Spółdzielcza'],
          baseTimes: { weekday: ['06:00', '07:00'], saturday: ['08:00'], sunday: ['09:00'] },
        },
        {
          short: 'ŻYRARDÓW SPÓŁDZIELCZA → ŻYRARDÓW D.A.',
          label: 'ŻYRARDÓW SPÓŁDZIELCZA → ŻYRARDÓW D.A.',
          stops: ['Spółdzielcza', 'Rynek', 'Dworzec'],
          baseTimes: { weekday: ['06:30'], saturday: ['08:30'], sunday: ['09:30'] },
        },
      ],
    },
  ],
};

function mockFetch() {
  return vi.fn((url) => {
    const target = String(url);
    if (target.includes('timetables.json')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(BUS_DATA) });
    }
    if (target.includes('stops_gps.json')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    }
    return Promise.reject(new Error('offline'));
  });
}

describe('App smoke', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal('fetch', mockFetch());
  });

  it('renderuje zakładkę Od → Do po załadowaniu danych', async () => {
    render(<App />);
    expect(await screen.findByText('Zaplanuj przejazd')).toBeTruthy();
    // jsdom nie stosuje klas CSS ukrywających nawigację desktopową - obie są w DOM
    expect(screen.getAllByRole('button', { name: /Linie/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: /Mapa/i }).length).toBeGreaterThan(0);
  });

  it('przełącza na zakładkę Linie i pokazuje uproszczone kierunki', async () => {
    render(<App />);
    await screen.findByText('Zaplanuj przejazd');
    fireEvent.click(screen.getAllByRole('button', { name: /Linie/i })[0]);
    expect(await screen.findByText('Linie i odjazdy')).toBeTruthy();
    await waitFor(() => {
      expect(screen.getByText('Do Spółdzielcza')).toBeTruthy();
      expect(screen.getByText('Do D.A.')).toBeTruthy();
    });
  });

  it('tryb "Wszystkie" pokazuje zbiorcze odjazdy z przystanku', async () => {
    render(<App />);
    await screen.findByText('Zaplanuj przejazd');
    fireEvent.click(screen.getAllByRole('button', { name: /Linie/i })[0]);
    fireEvent.click(await screen.findByRole('button', { name: /Wszystkie linie/i }));
    expect(await screen.findByText('Wybierz przystanek')).toBeTruthy();
    expect(screen.getByText('Rynek')).toBeTruthy(); // jeden wpis mimo 2 kierunkow
    fireEvent.click(screen.getByRole('button', { name: /Rynek/i }));
    expect(await screen.findByText('Odjazdy z przystanku')).toBeTruthy();
    expect(screen.getByText(/Wszystkie linie · Rynek/)).toBeTruthy();
    expect(screen.getByText('Pełny rozkład dnia')).toBeTruthy();
  });
});
