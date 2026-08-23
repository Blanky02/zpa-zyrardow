import React, { useMemo, useState } from 'react';
import {
  Avatar,
  Box,
  Button,
  ButtonBase,
  Divider,
  FormControl,
  IconButton,
  InputAdornment,
  List,
  ListItemButton,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import {
  ArrowBackRounded,
  AppsRounded,
  ArrowForwardRounded,
  DirectionsBusRounded,
  FavoriteBorderRounded,
  FavoriteRounded,
  SearchRounded,
} from '@mui/icons-material';
import { findOccurrencesForStop, formatDestination, getLineHex, getUniqueStops } from '../utils/stops.js';
import { getScheduleForStop, parseMinutes } from '../utils/time.js';

const dayShort = {
  weekday: 'Pn–pt',
  saturday: 'Sobota',
  sunday: 'Niedziela',
};

const flow = [
  { id: 'stop', label: 'Kierunek i przystanek' },
  { id: 'departures', label: 'Odjazdy' },
];

function LineBadge({ line, size = 44 }) {
  return (
    <Avatar
      variant="rounded"
      sx={{
        width: size,
        height: size,
        borderRadius: `${Math.round(size * 0.32)}px`,
        bgcolor: getLineHex(line.color),
        color: '#fff',
        fontWeight: 800,
        fontSize: size < 40 ? 12 : 15,
        flexShrink: 0,
      }}
    >
      {line.number}
    </Avatar>
  );
}

export default function LinesView({
  busData,
  state,
  setState,
  currentLine,
  currentDir,
  now,
  favorites,
  toggleFavorite,
  onSelectStop,
}) {
  const [step, setStep] = useState('stop');
  const [stopSearch, setStopSearch] = useState('');
  const [allStop, setAllStop] = useState('');
  const stepIndex = flow.findIndex(item => item.id === step);
  const isAll = state.lineId === 'all';

  const selectedStop = isAll ? allStop : (currentDir?.stops[state.stopIdx] || currentDir?.stops[0] || '');
  const schedule = useMemo(
    () => (!isAll && currentDir) ? getScheduleForStop(currentDir, state.stopIdx, state.dayType) : [],
    [currentDir, state.stopIdx, state.dayType, isAll],
  );
  const allDepartures = useMemo(() => {
    if (!isAll || !allStop) return [];
    const items = [];
    findOccurrencesForStop(busData, allStop).forEach(occurrence => {
      getScheduleForStop(occurrence.dir, occurrence.stopIdx, state.dayType).forEach(time => {
        items.push({ time, minutes: parseMinutes(time), line: occurrence.line });
      });
    });
    items.sort((a, b) => a.minutes - b.minutes);
    return items;
  }, [isAll, allStop, busData, state.dayType]);
  const upcoming = useMemo(
    () => (isAll ? allDepartures.filter(item => item.minutes >= now.minutes).slice(0, 5)
      : schedule
        .map(time => ({ time, minutes: parseMinutes(time) }))
        .filter(item => item.minutes >= now.minutes)
        .slice(0, 5)),
    [schedule, allDepartures, now.minutes, isAll],
  );
  const groupedSchedule = useMemo(() => {
    const groups = new Map();
    (isAll ? allDepartures : schedule.map(time => ({ time }))).forEach(item => {
      const hour = item.time.split(':')[0];
      if (!groups.has(hour)) groups.set(hour, []);
      groups.get(hour).push(item);
    });
    return Array.from(groups.entries());
  }, [schedule, allDepartures, isAll]);
  const filteredStops = useMemo(() => {
    const query = stopSearch.trim().toLocaleLowerCase('pl');
    if (isAll) {
      return getUniqueStops(busData)
        .filter(stop => !query || stop.name.toLocaleLowerCase('pl').includes(query))
        .map(stop => ({ name: stop.name, index: -1, linesCount: stop.linesCount }));
    }
    if (!currentDir) return [];
    return currentDir.stops
      .map((name, index) => ({ name, index }))
      .filter(stop => !query || stop.name.toLocaleLowerCase('pl').includes(query));
  }, [currentDir, stopSearch, isAll, busData]);

  if (!currentLine || !currentDir) return null;

  const next = upcoming[0];
  const minutesToNext = next ? Math.max(0, Math.floor(next.minutes - now.minutes)) : null;
  const isFavorite = favorites.some(favorite => favorite.stop === selectedStop);
  const selectedStopLines = isAll
    ? [...new Set(allDepartures.map(item => item.line.number))]
    : [currentLine.number];
  const todayType = now.date.getDay() === 0 ? 'sunday' : now.date.getDay() === 6 ? 'saturday' : 'weekday';

  const chooseLine = (line) => {
    setState(previous => ({ ...previous, lineId: line.id, dirIdx: 0, stopIdx: 0 }));
    setStopSearch('');
    setStep('stop');
  };

  const chooseAll = () => {
    setState(previous => ({ ...previous, lineId: 'all', dirIdx: 0, stopIdx: 0 }));
    setAllStop('');
    setStopSearch('');
    setStep('stop');
  };

  const chooseDirection = (index) => {
    setState(previous => ({ ...previous, dirIdx: index, stopIdx: 0 }));
    setStopSearch('');
  };

  const chooseStop = (stop) => {
    if (isAll) {
      setAllStop(stop.name);
    } else {
      onSelectStop(currentLine.id, state.dirIdx, stop.index);
    }
    setStep('departures');
  };

  const chooseFavorite = (favorite) => {
    const occurrence = findOccurrencesForStop(busData, favorite.stop)[0];
    if (!occurrence) return;
    onSelectStop(occurrence.line.id, occurrence.dirIdx, occurrence.stopIdx);
    setStep('departures');
  };

  const goBack = () => {
    if (stepIndex > 0) setStep(flow[stepIndex - 1].id);
  };

  return (
    <Box sx={{ width: '100%', minWidth: 0, overflowX: 'clip' }}>
      <Box sx={{ mb: { xs: 2, md: 3 }, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
        <Box sx={{ minWidth: 0, flex: '1 1 200px' }}>
          <Typography variant="headlineSmall" sx={{ fontWeight: 750, letterSpacing: '-0.025em' }}>
            Linie i odjazdy
          </Typography>
        </Box>

        <FormControl size="small" sx={{ flexShrink: 0 }}>
          <Select
            value={state.dayType}
            onChange={(event) => setState(previous => ({ ...previous, dayType: event.target.value }))}
            aria-label="Dzień kursowania"
            sx={{ minWidth: 105, borderRadius: '16px', fontWeight: 650, bgcolor: 'background.paper' }}
          >
            {Object.entries(dayShort).map(([value, label]) => (
              <MenuItem key={value} value={value}>{label}</MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      <Paper elevation={0} sx={{ borderRadius: '28px', border: 1, borderColor: 'divider', overflow: 'hidden' }}>
        <Box sx={{ px: { xs: 2, sm: 3 }, py: 1.75, borderBottom: 1, borderColor: 'divider' }}>
          <Typography variant="labelLarge" color="text.secondary">Linia</Typography>
          <Box sx={{ display: 'flex', gap: 0.75, mt: 1, overflowX: 'auto', overscrollBehaviorX: 'contain', maxWidth: '100%', pb: 0.5 }}>
            <ButtonBase
              aria-label="Wszystkie linie"
              aria-pressed={isAll}
              onClick={chooseAll}
              sx={{
                px: 1.25,
                minHeight: 50,
                borderRadius: '15px',
                border: 2,
                borderColor: isAll ? 'primary.main' : 'transparent',
                bgcolor: isAll ? 'primary.container' : 'transparent',
                color: isAll ? 'primary.onContainer' : 'text.secondary',
                gap: 0.75,
                flexShrink: 0,
                fontWeight: 750,
              }}
            >
              <AppsRounded fontSize="small" />
              <Typography variant="labelMedium" sx={{ fontWeight: 750 }}>Wszystkie</Typography>
            </ButtonBase>
            {busData.lines.map(line => {
              const selected = line.id === currentLine.id;
              return (
                <ButtonBase
                  key={line.id}
                  aria-label={`Wybierz linię ${line.number}`}
                  aria-pressed={selected}
                  onClick={() => chooseLine(line)}
                  sx={{
                    p: 0.55,
                    borderRadius: '15px',
                    border: 2,
                    borderColor: selected ? 'primary.main' : 'transparent',
                    bgcolor: selected ? 'primary.container' : 'transparent',
                    flexShrink: 0,
                  }}
                >
                  <LineBadge line={line} size={38} />
                </ButtonBase>
              );
            })}
          </Box>

          {favorites.length > 0 && (
            <Box sx={{ display: 'flex', gap: 0.75, mt: 1, overflowX: 'auto', overscrollBehaviorX: 'contain', maxWidth: '100%', pb: 0.25 }}>
              {favorites.slice(0, 5).map(favorite => (
                <Button
                  key={favorite.stop}
                  size="small"
                  color="inherit"
                  startIcon={<FavoriteRounded sx={{ color: 'primary.main' }} />}
                  onClick={() => chooseFavorite(favorite)}
                  sx={{ minHeight: 34, bgcolor: 'background.container', flexShrink: 0, maxWidth: 240 }}
                >
                  <Typography variant="labelMedium" noWrap>{favorite.stop}</Typography>
                </Button>
              ))}
            </Box>
          )}
        </Box>

        <Box sx={{ px: { xs: 1.5, sm: 2.5 }, py: 1.25, bgcolor: 'background.container' }}>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: { xs: 0.5, sm: 1 } }}>
            {flow.map((item, index) => {
              const active = item.id === step;
              const completed = index < stepIndex;
              return (
                <ButtonBase
                  key={item.id}
                  disabled={index > stepIndex}
                  onClick={() => index <= stepIndex && setStep(item.id)}
                  sx={{
                    minWidth: 0,
                    borderRadius: '16px',
                    px: { xs: 0.5, sm: 1 },
                    py: 0.8,
                    gap: 0.75,
                    color: active ? 'primary.onContainer' : 'text.secondary',
                    bgcolor: active ? 'primary.container' : 'transparent',
                    justifyContent: 'center',
                  }}
                >
                  <Box
                    sx={{
                      width: 24,
                      height: 24,
                      borderRadius: '50%',
                      display: 'grid',
                      placeItems: 'center',
                      bgcolor: active || completed ? 'primary.main' : 'background.containerHighest',
                      color: active || completed ? 'primary.contrastText' : 'text.secondary',
                      fontSize: 11,
                      fontWeight: 800,
                      flexShrink: 0,
                    }}
                  >
                    {index + 1}
                  </Box>
                  <Typography variant="labelMedium" sx={{ fontWeight: active ? 750 : 600, minWidth: 0, display: { xs: index === stepIndex ? 'block' : 'none', sm: 'block' } }} noWrap>
                    {item.id === 'stop' && isAll ? 'Przystanek' : item.label}
                  </Typography>
                </ButtonBase>
              );
            })}
          </Box>
        </Box>

        {step === 'departures' && (
          <Box sx={{ px: { xs: 2, sm: 3 }, pt: 2.25, display: 'flex', alignItems: 'center', gap: 1 }}>
            <Button startIcon={<ArrowBackRounded />} onClick={goBack} color="inherit" sx={{ px: 1.25, minHeight: 38, flexShrink: 0 }}>
              Zmień przystanek
            </Button>
            <Box sx={{ minWidth: 0, display: 'flex', alignItems: 'center', gap: 1, ml: 'auto' }}>
              <Typography variant="bodySmall" color="text.secondary" noWrap>
                {isAll ? 'Wszystkie linie' : `Do ${formatDestination(currentDir)}`} · {selectedStop}
              </Typography>
            </Box>
          </Box>
        )}

        <Box sx={{ p: { xs: 2, sm: 3 } }}>
          {step === 'stop' && (
            <Box sx={{ width: '100%', minWidth: 0 }}>
              <Typography variant="titleLarge" sx={{ fontWeight: 750 }}>
                {isAll ? 'Wybierz przystanek' : 'Wybierz kierunek i przystanek'}
              </Typography>

              {!isAll && (
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: `repeat(${Math.min(currentLine.directions.length, 2)}, minmax(0, 1fr))` }, gap: 1, mt: 2.5, mb: 2.5 }}>
                {currentLine.directions.map((direction, index) => {
                  const selected = index === state.dirIdx;
                  return (
                    <ButtonBase
                      key={`${currentLine.id}-${index}`}
                      onClick={() => chooseDirection(index)}
                      sx={{
                        width: '100%',
                        p: 1.5,
                        gap: 1.25,
                        textAlign: 'left',
                        justifyContent: 'flex-start',
                        borderRadius: '18px',
                        border: 1,
                        borderColor: selected ? 'primary.main' : 'divider',
                        bgcolor: selected ? 'primary.container' : 'transparent',
                        color: selected ? 'primary.onContainer' : 'text.primary',
                      }}
                    >
                      <Box sx={{ width: 34, height: 34, borderRadius: '12px', bgcolor: selected ? 'primary.main' : 'background.container', color: selected ? 'primary.contrastText' : 'text.secondary', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                        <DirectionsBusRounded fontSize="small" />
                      </Box>
                      <Box sx={{ minWidth: 0, flex: 1 }}>
                        <Typography variant="bodySmall" sx={{ fontWeight: 750, display: 'block' }} noWrap>Do {formatDestination(direction)}</Typography>
                        <Typography variant="bodySmall" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>{direction.stops.length} przyst.</Typography>
                      </Box>
                    </ButtonBase>
                  );
                })}
              </Box>
              )}

              {!isAll && <Divider sx={{ mb: 2.5 }} />}
              <Typography variant="titleMedium" sx={{ fontWeight: 750, mt: isAll ? 2.5 : 0 }}>Przystanek</Typography>

              <TextField
                fullWidth
                value={stopSearch}
                onChange={(event) => setStopSearch(event.target.value)}
                placeholder="Szukaj na trasie"
                sx={{ mt: 1.5 }}
                InputProps={{ startAdornment: <InputAdornment position="start"><SearchRounded color="action" /></InputAdornment> }}
              />

              <List disablePadding sx={{ mt: 1.5 }}>
                {filteredStops.map(stop => (
                  <ListItemButton
                    key={`${stop.name}-${stop.index}`}
                    onClick={() => chooseStop(stop)}
                    sx={{ borderRadius: '16px', gap: 1.25, py: 1.15 }}
                  >
                    <Box sx={{ width: 30, height: 30, borderRadius: '50%', bgcolor: isAll ? 'primary.container' : 'background.container', color: isAll ? 'primary.onContainer' : 'text.secondary', display: 'grid', placeItems: 'center', fontSize: 11, fontWeight: 750, flexShrink: 0 }}>
                      {isAll ? stop.linesCount : stop.index + 1}
                    </Box>
                    <Typography variant="bodyMedium" sx={{ flex: 1, fontWeight: 600 }}>{stop.name}</Typography>
                    {isAll && (
                      <Typography variant="labelSmall" color="text.secondary" sx={{ flexShrink: 0 }}>
                        {stop.linesCount} {stop.linesCount === 1 ? 'linia' : 'linii'}
                      </Typography>
                    )}
                    <ArrowForwardRounded color="action" fontSize="small" />
                  </ListItemButton>
                ))}
              </List>

              {!filteredStops.length && (
                <Typography variant="bodyMedium" color="text.secondary" sx={{ textAlign: 'center', py: 5 }}>Nie znaleziono przystanku.</Typography>
              )}
            </Box>
          )}

          {step === 'departures' && (
            <Box>
              <Box sx={{ mb: 2.5 }}>
                <Typography variant="titleLarge" sx={{ fontWeight: 750 }}>Odjazdy z przystanku</Typography>
                <Typography variant="bodyMedium" color="text.secondary" sx={{ mt: 0.5 }}>{selectedStop}</Typography>
              </Box>

              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '320px minmax(0, 1fr)' }, gap: { xs: 2, md: 3 }, alignItems: 'start' }}>
                <Box
                  sx={{
                    bgcolor: 'primary.main',
                    color: 'primary.contrastText',
                    borderRadius: '24px',
                    p: 2.5,
                  }}
                >
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1 }}>
                    <Box>
                      <Typography variant="bodySmall" sx={{ opacity: 0.72 }}>Najbliższy odjazd</Typography>
                      <Typography variant="h3" sx={{ fontFamily: 'Roboto Mono', fontWeight: 800, lineHeight: 1, mt: 0.75 }}>
                        {next?.time || '—'}
                      </Typography>
                    </Box>
                    <IconButton
                      aria-label={isFavorite ? 'Usuń z ulubionych' : 'Dodaj do ulubionych'}
                      onClick={() => toggleFavorite(selectedStop, selectedStopLines)}
                      sx={{ color: 'inherit', bgcolor: 'rgba(255,255,255,.14)', alignSelf: 'flex-start' }}
                    >
                      {isFavorite ? <FavoriteRounded /> : <FavoriteBorderRounded />}
                    </IconButton>
                  </Box>

                  <Typography variant="titleMedium" sx={{ fontWeight: 750, mt: 1 }}>
                    {next ? (minutesToNext < 1 ? 'Odjazd teraz' : `Za ${minutesToNext} min`) : 'Brak kolejnych kursów'}
                  </Typography>

                  {isAll && next?.line && (
                    <Typography variant="bodySmall" sx={{ opacity: 0.85, mt: 0.5 }}>
                      Linia {next.line.number}
                    </Typography>
                  )}

                  {upcoming.length > 1 && (
                    <Box sx={{ mt: 2.5 }}>
                      <Typography variant="bodySmall" sx={{ opacity: 0.72 }}>Kolejne</Typography>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mt: 0.75 }}>
                        {upcoming.slice(1).map((item, index) => (
                          <Box key={`${item.time}-${item.line?.id || index}`} sx={{ px: 1.15, py: 0.65, borderRadius: '12px', bgcolor: 'rgba(255,255,255,.14)', fontFamily: 'Roboto Mono', fontWeight: 650, fontSize: 13 }}>
                            {item.time}{isAll && item.line ? ` · ${item.line.number}` : ''}
                          </Box>
                        ))}
                      </Box>
                    </Box>
                  )}
                </Box>

                <Box>
                  <Typography variant="titleMedium" sx={{ fontWeight: 750, mb: 1.5 }}>Pełny rozkład dnia</Typography>
                  {groupedSchedule.length ? (
                    <Stack spacing={1.35}>
                      {groupedSchedule.map(([hour, times]) => (
                        <Box key={hour} sx={{ display: 'grid', gridTemplateColumns: '32px minmax(0, 1fr)', gap: 1, alignItems: 'start' }}>
                          <Typography variant="labelLarge" color="text.secondary" sx={{ pt: 0.75, fontFamily: 'Roboto Mono', fontWeight: 700 }}>{hour}</Typography>
                          <Box sx={{ display: 'grid', gridTemplateColumns: `repeat(auto-fill, minmax(${isAll ? 84 : 62}px, 1fr))`, gap: 0.6 }}>
                            {times.map((item, index) => {
                              const past = state.dayType === todayType && parseMinutes(item.time) < now.minutes;
                              const isNext = item.time === next?.time && (!isAll || item.line?.id === next?.line?.id);
                              return (
                                <Box
                                  key={`${item.time}-${item.line?.id || index}`}
                                  sx={{
                                    textAlign: 'center',
                                    py: 0.7,
                                    px: 0.75,
                                    borderRadius: '12px',
                                    bgcolor: isNext ? 'primary.container' : 'background.container',
                                    color: isNext ? 'primary.onContainer' : 'text.primary',
                                    fontFamily: 'Roboto Mono',
                                    fontSize: 13,
                                    fontWeight: isNext ? 800 : 550,
                                    opacity: past ? 0.4 : 1,
                                  }}
                                >
                                  {item.time}
                                  {isAll && item.line && (
                                    <Box component="span" sx={{ ml: 0.5, fontSize: 10, fontWeight: 800, color: getLineHex(item.line.color) }}>
                                      {item.line.number}
                                    </Box>
                                  )}
                                </Box>
                              );
                            })}
                          </Box>
                        </Box>
                      ))}
                    </Stack>
                  ) : (
                    <Box sx={{ py: 6, textAlign: 'center' }}>
                      <DirectionsBusRounded sx={{ fontSize: 42, color: 'text.disabled' }} />
                      <Typography variant="bodyMedium" color="text.secondary" sx={{ mt: 1 }}>Brak kursów w tym dniu.</Typography>
                    </Box>
                  )}
                </Box>
              </Box>
            </Box>
          )}
        </Box>
      </Paper>
    </Box>
  );
}
