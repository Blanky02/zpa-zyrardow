import React, { useMemo, useState } from 'react';
import {
  Avatar,
  Autocomplete,
  Box,
  Button,
  ButtonBase,
  Divider,
  FormControl,
  IconButton,
  InputAdornment,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import {
  ArrowForwardRounded,
  AltRouteRounded,
  HistoryRounded,
  SearchRounded,
  SwapVertRounded,
} from '@mui/icons-material';
import { getUniqueStops, findDirectRoutes, getLineHex, formatDestination } from '../utils/stops.js';
import { dayLabel } from '../utils/time.js';
import { addRouteRecent, getRouteRecents } from '../utils/storage.js';

const dayShort = {
  weekday: 'Pn–pt',
  saturday: 'Sobota',
  sunday: 'Niedziela',
};

function StopField({ marker, label, placeholder, options, value, query, onValueChange, onQueryChange }) {
  const selected = options.find(option => option.name === value) || null;

  return (
    <Autocomplete
      freeSolo
      autoHighlight
      openOnFocus={false}
      options={options}
      value={selected}
      inputValue={query}
      getOptionLabel={(option) => typeof option === 'string' ? option : option.name}
      filterOptions={(items, params) => {
        const q = params.inputValue.trim().toLocaleLowerCase('pl');
        if (q.length < 2) return [];
        return items.filter(item => item.name.toLocaleLowerCase('pl').includes(q)).slice(0, 6);
      }}
      onChange={(_, option) => {
        const name = typeof option === 'string' ? option : option?.name || '';
        onValueChange(name);
        onQueryChange(name);
      }}
      onInputChange={(_, next, reason) => {
        onQueryChange(next);
        if (reason === 'input') onValueChange('');
      }}
      renderOption={(props, option) => {
        const { key, ...optionProps } = props;
        return (
          <Box component="li" key={key} {...optionProps} sx={{ gap: 1.5, py: '10px !important' }}>
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Typography variant="bodyMedium" sx={{ fontWeight: 650 }}>{option.name}</Typography>
              <Typography variant="bodySmall" color="text.secondary">
                Linie {option.lines || '—'}
              </Typography>
            </Box>
          </Box>
        );
      }}
      renderInput={(params) => (
        <TextField
          {...params}
          label={label}
          placeholder={placeholder}
          InputProps={{
            ...params.InputProps,
            startAdornment: (
              <InputAdornment position="start">
                <Box
                  sx={{
                    width: 30,
                    height: 30,
                    borderRadius: '50%',
                    display: 'grid',
                    placeItems: 'center',
                    bgcolor: marker === 'A' ? 'primary.main' : 'text.primary',
                    color: marker === 'A' ? 'primary.contrastText' : 'background.paper',
                    fontWeight: 750,
                    fontSize: 12,
                  }}
                >
                  {marker}
                </Box>
              </InputAdornment>
            ),
          }}
        />
      )}
      slotProps={{ paper: { sx: { mt: 1, borderRadius: '20px' } } }}
    />
  );
}

export default function RouteView({ busData, state, setState, now }) {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [fromQuery, setFromQuery] = useState('');
  const [toQuery, setToQuery] = useState('');
  const [results, setResults] = useState([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [error, setError] = useState('');
  const [routeRecents, setRouteRecents] = useState(() => getRouteRecents());

  const stops = useMemo(() => getUniqueStops(busData), [busData]);
  const todayType = useMemo(() => {
    const day = now.date.getDay();
    return day === 0 ? 'sunday' : day === 6 ? 'saturday' : 'weekday';
  }, [now.date]);

  const searchRoutes = (fromStop = from || fromQuery, toStop = to || toQuery, selectedDay = state.dayType) => {
    const start = fromStop.trim();
    const end = toStop.trim();

    if (!start || !end) {
      setError('Wybierz przystanek początkowy i końcowy.');
      return;
    }
    if (start === end) {
      setError('Początek i cel podróży muszą być różne.');
      return;
    }

    setError('');
    const routes = findDirectRoutes(busData, start, end, selectedDay);
    const visible = selectedDay === todayType
      ? routes.filter(route => route.depMins >= now.minutes)
      : routes;

    setFrom(start);
    setTo(end);
    setFromQuery(start);
    setToQuery(end);
    setState(previous => ({ ...previous, dayType: selectedDay }));
    setResults((visible.length ? visible : routes).slice(0, 30));
    setHasSearched(true);
    setRouteRecents(addRouteRecent(start, end, selectedDay));
  };

  const handleSwap = () => {
    setFrom(to);
    setTo(from);
    setFromQuery(toQuery);
    setToQuery(fromQuery);
    setResults([]);
    setHasSearched(false);
    setError('');
  };

  const applyRecent = (route) => {
    searchRoutes(route.from, route.to, route.dayType);
  };

  return (
    <Box>
      <Box sx={{ mb: { xs: 2, md: 3 } }}>
        <Typography variant="headlineSmall" sx={{ fontWeight: 750, letterSpacing: '-0.025em' }}>
          Zaplanuj przejazd
        </Typography>
      </Box>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: 'minmax(340px, .85fr) minmax(480px, 1.25fr)' },
          gap: { xs: 2, md: 3 },
          alignItems: 'start',
        }}
      >
        <Paper
          elevation={0}
          sx={{
            p: { xs: 2.25, sm: 3 },
            borderRadius: '28px',
            bgcolor: 'primary.main',
            color: 'primary.contrastText',
            position: { lg: 'sticky' },
            top: { lg: 166 },
            overflow: 'visible',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2, mb: 2.5 }}>
            <Box>
              <Typography variant="titleLarge" sx={{ fontWeight: 750, letterSpacing: '-0.025em' }}>
                Dokąd jedziesz?
              </Typography>
            </Box>

            <FormControl size="small">
              <Select
                value={state.dayType}
                onChange={(event) => setState(previous => ({ ...previous, dayType: event.target.value }))}
                aria-label="Dzień kursowania"
                sx={{
                  minWidth: 105,
                  height: 38,
                  borderRadius: '16px',
                  bgcolor: 'rgba(255,255,255,.16)',
                  color: 'white',
                  fontWeight: 650,
                  '.MuiOutlinedInput-notchedOutline': { border: 0 },
                  '.MuiSvgIcon-root': { color: 'white' },
                }}
              >
                {Object.entries(dayShort).map(([value, label]) => (
                  <MenuItem key={value} value={value}>{label}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>

          <Paper elevation={0} sx={{ p: 1.25, borderRadius: '24px', bgcolor: 'background.paper' }}>
            <StopField
              marker="A"
              label="Skąd"
              placeholder="Wpisz przystanek"
              options={stops}
              value={from}
              query={fromQuery}
              onValueChange={setFrom}
              onQueryChange={setFromQuery}
            />

            <Box sx={{ height: 16, position: 'relative' }}>
              <Box sx={{ position: 'absolute', left: 28, top: -3, bottom: -3, width: 2, bgcolor: 'divider' }} />
              <IconButton
                aria-label="Zamień przystanki"
                onClick={handleSwap}
                size="small"
                sx={{
                  position: 'absolute',
                  right: 10,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  bgcolor: 'background.container',
                  color: 'text.primary',
                  zIndex: 1,
                  '&:hover': { bgcolor: 'background.containerHigh' },
                }}
              >
                <SwapVertRounded fontSize="small" />
              </IconButton>
            </Box>

            <StopField
              marker="B"
              label="Dokąd"
              placeholder="Wpisz przystanek"
              options={stops}
              value={to}
              query={toQuery}
              onValueChange={setTo}
              onQueryChange={setToQuery}
            />
          </Paper>

          {error && (
            <Typography variant="bodySmall" role="alert" sx={{ mt: 1.5, color: '#FFE3DE', fontWeight: 600 }}>
              {error}
            </Typography>
          )}

          <Button
            fullWidth
            variant="contained"
            size="large"
            startIcon={<SearchRounded />}
            onClick={() => searchRoutes()}
            sx={{
              mt: 2,
              minHeight: 54,
              bgcolor: 'background.paper',
              color: 'primary.main',
              fontWeight: 750,
              '&:hover': { bgcolor: 'background.containerHigh' },
            }}
          >
            Pokaż połączenia
          </Button>
          <Typography variant="bodySmall" sx={{ opacity: 0.7, textAlign: 'center', mt: 1.25 }}>
            Połączenia bezpośrednie · około 2 min na przystanek
          </Typography>
        </Paper>

        <Paper elevation={0} sx={{ borderRadius: '28px', overflow: 'hidden', border: 1, borderColor: 'divider' }}>
          {hasSearched ? (
            <>
              <Box sx={{ px: { xs: 2.25, sm: 3 }, py: 2.5, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 2 }}>
                <Box>
                  <Typography variant="titleLarge" sx={{ fontWeight: 750 }}>Najbliższe połączenia</Typography>
                  <Typography variant="bodySmall" color="text.secondary" sx={{ mt: 0.4 }}>
                    {from} → {to} · {dayLabel(state.dayType)}
                  </Typography>
                </Box>
                <Typography variant="labelLarge" color="primary.main" sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>
                  {results.length} {results.length === 1 ? 'wynik' : 'wyników'}
                </Typography>
              </Box>

              <Divider />

              {results.length === 0 ? (
                <Box sx={{ px: 3, py: 8, textAlign: 'center' }}>
                  <AltRouteRounded sx={{ fontSize: 44, color: 'text.disabled' }} />
                  <Typography variant="titleMedium" sx={{ fontWeight: 700, mt: 1.5 }}>Brak bezpośredniego połączenia</Typography>
                  <Typography variant="bodyMedium" color="text.secondary" sx={{ mt: 0.75 }}>
                    Spróbuj wybrać inny przystanek lub dzień.
                  </Typography>
                </Box>
              ) : (
                <Stack divider={<Divider flexItem />}>
                  {results.map((route, index) => {
                    const minutesLeft = Math.max(0, Math.floor(route.depMins - now.minutes));
                    const showRelative = state.dayType === todayType && route.depMins >= now.minutes;
                    return (
                      <Box
                        key={`${route.line.id}-${route.dir.id || route.dir.label}-${route.depTime}-${index}`}
                        sx={{
                          display: 'grid',
                          gridTemplateColumns: { xs: '46px minmax(0, 1fr) auto', sm: '50px minmax(0, 1fr) 120px' },
                          gap: { xs: 1.25, sm: 2 },
                          alignItems: 'center',
                          px: { xs: 2, sm: 3 },
                          py: 2,
                          '&:hover': { bgcolor: 'action.hover' },
                        }}
                      >
                        <Avatar
                          variant="rounded"
                          sx={{
                            width: 44,
                            height: 44,
                            borderRadius: '14px',
                            bgcolor: getLineHex(route.line.color),
                            fontWeight: 800,
                          }}
                        >
                          {route.line.number}
                        </Avatar>

                        <Box sx={{ minWidth: 0 }}>
                          <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.75, flexWrap: 'wrap' }}>
                            <Typography variant="titleMedium" sx={{ fontWeight: 800, fontFamily: 'Roboto Mono' }}>
                              {route.depTime}
                            </Typography>
                            <ArrowForwardRounded sx={{ fontSize: 16, color: 'text.disabled' }} />
                            <Typography variant="bodyMedium" sx={{ fontFamily: 'Roboto Mono', color: 'text.secondary' }}>
                              {route.arrTime}
                            </Typography>
                            {showRelative && (
                              <Typography variant="labelMedium" color="primary.main" sx={{ fontWeight: 750 }}>
                                {minutesLeft < 1 ? 'teraz' : `za ${minutesLeft} min`}
                              </Typography>
                            )}
                          </Box>
                          <Typography variant="bodySmall" color="text.secondary" noWrap sx={{ mt: 0.35 }}>
                            Do {formatDestination(route.dir, route.line.name)}
                          </Typography>
                        </Box>

                        <Box sx={{ textAlign: 'right' }}>
                          <Typography variant="bodyMedium" sx={{ fontWeight: 700 }}>{route.duration} min</Typography>
                          <Typography variant="bodySmall" color="text.secondary">
                            {route.stopsCount} przyst.
                          </Typography>
                        </Box>
                      </Box>
                    );
                  })}
                </Stack>
              )}
            </>
          ) : (
            <Box sx={{ p: { xs: 2.25, sm: 3 } }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mb: 2.5 }}>
                <Box sx={{ width: 40, height: 40, borderRadius: '14px', bgcolor: 'primary.container', color: 'primary.onContainer', display: 'grid', placeItems: 'center' }}>
                  <HistoryRounded />
                </Box>
                <Box sx={{ alignSelf: 'center' }}>
                  <Typography variant="titleMedium" sx={{ fontWeight: 750 }}>Ostatnie trasy</Typography>
                </Box>
              </Box>

              {routeRecents.length ? (
                <Stack divider={<Divider flexItem />}>
                  {routeRecents.map((route) => (
                    <ButtonBase
                      key={`${route.from}-${route.to}-${route.dayType}`}
                      onClick={() => applyRecent(route)}
                      sx={{ width: '100%', textAlign: 'left', borderRadius: '16px', p: 1.5, gap: 1.5, justifyContent: 'flex-start', '&:hover': { bgcolor: 'action.hover' } }}
                    >
                      <Box sx={{ minWidth: 0, flex: 1 }}>
                        <Typography variant="bodyMedium" sx={{ fontWeight: 700 }} noWrap>{route.from}</Typography>
                        <Typography variant="bodyMedium" color="text.secondary" noWrap>{route.to}</Typography>
                      </Box>
                      <Typography variant="labelMedium" color="text.secondary">{dayShort[route.dayType]}</Typography>
                      <ArrowForwardRounded color="action" />
                    </ButtonBase>
                  ))}
                </Stack>
              ) : (
                <Box sx={{ py: { xs: 5, md: 9 }, textAlign: 'center' }}>
                  <AltRouteRounded sx={{ fontSize: 54, color: 'primary.main', opacity: 0.2 }} />
                  <Typography variant="titleMedium" sx={{ fontWeight: 700, mt: 1.5 }}>Tutaj pojawią się Twoje trasy</Typography>
                </Box>
              )}
            </Box>
          )}
        </Paper>
      </Box>
    </Box>
  );
}
