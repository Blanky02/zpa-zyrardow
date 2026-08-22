import React, { useState, useMemo } from 'react';
import { Box, Card, CardContent, Typography, TextField, Button, Chip, Stack, Paper, Grid, InputAdornment, Divider, LinearProgress } from '@mui/material';
import { Search, SwapVert, DirectionsBus, Place } from '@mui/icons-material';
import { getUniqueStops, findDirectRoutes, getLineHex } from '../utils/stops.js';

export default function RouteView({ busData, state, setState, now }) {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [fromQuery, setFromQuery] = useState('');
  const [toQuery, setToQuery] = useState('');
  const [results, setResults] = useState([]);

  const unique = useMemo(() => getUniqueStops(busData), [busData]);

  const fromMatches = useMemo(() => {
    if (!fromQuery || fromQuery.length < 2) return [];
    const q = fromQuery.toLowerCase();
    return unique.filter(u => u.name.toLowerCase().includes(q)).slice(0, 6);
  }, [unique, fromQuery]);

  const toMatches = useMemo(() => {
    if (!toQuery || toQuery.length < 2) return [];
    const q = toQuery.toLowerCase();
    return unique.filter(u => u.name.toLowerCase().includes(q)).slice(0, 6);
  }, [unique, toQuery]);

  const handleSearch = () => {
    const f = from || fromQuery;
    const t = to || toQuery;
    if (!f || !t) {
      alert('Wybierz przystanek OD i DO');
      return;
    }
    const routes = findDirectRoutes(busData, f, t, state.dayType);
    const nowMin = now.minutes;
    const upcoming = routes.filter(r => r.depMins >= nowMin).slice(0, 20);
    setResults(upcoming.length ? upcoming : routes.slice(0, 20));
  };

  const handleSwap = () => {
    const a = from, b = to;
    const aq = fromQuery, bq = toQuery;
    setFrom(b); setTo(a);
    setFromQuery(bq); setToQuery(aq);
  };

  return (
    <Box sx={{ maxWidth: 900, mx: 'auto' }}>
      <Card sx={{ borderRadius: '28px', mb: 2 }}>
        <CardContent sx={{ p: 3 }}>
          <Typography variant="headlineSmall" sx={{ fontWeight: 700, mb: 1 }}>Gdzie chcesz jechać?</Typography>
          <Typography variant="bodySmall" color="text.secondary" sx={{ mb: 2 }}>Wybierz przystanek początkowy i końcowy – pokażemy Ci bezpośrednie linie</Typography>

          <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
            {['weekday', 'saturday', 'sunday'].map(day => (
              <Chip key={day} label={day === 'weekday' ? 'PN-PT' : day === 'saturday' ? 'SOB' : 'NDZ'} onClick={() => setState(prev => ({ ...prev, dayType: day }))} color={state.dayType === day ? 'primary' : 'default'} variant={state.dayType === day ? 'filled' : 'outlined'} size="small" />
            ))}
            <Typography variant="labelSmall" color="text.secondary" sx={{ alignSelf: 'center', ml: 1 }}>Dzień kursowania</Typography>
          </Stack>

          <Grid container spacing={2} alignItems="flex-end">
            <Grid item xs={12} md={5}>
              <Typography variant="labelSmall" sx={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, mb: 1, display: 'block' }}>Skąd (Od)</Typography>
              <TextField
                fullWidth
                placeholder="Np. F. de Girarda"
                value={fromQuery}
                onChange={(e) => { setFromQuery(e.target.value); setFrom(''); }}
                InputProps={{
                  startAdornment: <InputAdornment position="start"><Box sx={{ width: 28, height: 28, borderRadius: '50%', bgcolor: 'primary.main', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 12 }}>A</Box></InputAdornment>,
                  sx: { borderRadius: '16px', bgcolor: 'background.container', height: 56 }
                }}
              />
              {fromMatches.length > 0 && (
                <Paper elevation={3} sx={{ mt: 1, borderRadius: '16px', overflow: 'hidden', maxHeight: 200, overflowY: 'auto' }}>
                  {fromMatches.map((m, i) => (
                    <Box key={i} onClick={() => { setFrom(m.name); setFromQuery(m.name); }} sx={{ p: 1.5, cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' }, borderBottom: 1, borderColor: 'divider' }}>
                      <Typography variant="bodySmall" sx={{ fontWeight: 600 }}>{m.name}</Typography>
                      <Typography variant="labelSmall" color="text.secondary">{m.linesCount} linii</Typography>
                    </Box>
                  ))}
                </Paper>
              )}
              {from && <Chip label={`Od: ${from}`} color="primary" size="small" sx={{ mt: 1 }} />}
            </Grid>

            <Grid item xs={12} md={2} sx={{ display: 'flex', justifyContent: 'center' }}>
              <Button onClick={handleSwap} variant="contained" disableElevation sx={{ minWidth: 48, width: 48, height: 48, borderRadius: '50%', bgcolor: 'background.container', color: 'text.primary', '&:hover': { bgcolor: 'background.containerHigh' } }}><SwapVert /></Button>
            </Grid>

            <Grid item xs={12} md={5}>
              <Typography variant="labelSmall" sx={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, mb: 1, display: 'block' }}>Dokąd (Do)</Typography>
              <TextField
                fullWidth
                placeholder="Np. Wittenberga"
                value={toQuery}
                onChange={(e) => { setToQuery(e.target.value); setTo(''); }}
                InputProps={{
                  startAdornment: <InputAdornment position="start"><Box sx={{ width: 28, height: 28, borderRadius: '50%', bgcolor: 'text.primary', color: 'background.paper', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 12 }}>B</Box></InputAdornment>,
                  sx: { borderRadius: '16px', bgcolor: 'background.container', height: 56 }
                }}
              />
              {toMatches.length > 0 && (
                <Paper elevation={3} sx={{ mt: 1, borderRadius: '16px', overflow: 'hidden', maxHeight: 200, overflowY: 'auto' }}>
                  {toMatches.map((m, i) => (
                    <Box key={i} onClick={() => { setTo(m.name); setToQuery(m.name); }} sx={{ p: 1.5, cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' }, borderBottom: 1, borderColor: 'divider' }}>
                      <Typography variant="bodySmall" sx={{ fontWeight: 600 }}>{m.name}</Typography>
                      <Typography variant="labelSmall" color="text.secondary">{m.linesCount} linii</Typography>
                    </Box>
                  ))}
                </Paper>
              )}
              {to && <Chip label={`Do: ${to}`} color="secondary" size="small" sx={{ mt: 1 }} />}
            </Grid>
          </Grid>

          <Button fullWidth variant="contained" size="large" onClick={handleSearch} startIcon={<Search />} sx={{ mt: 3, height: 56, borderRadius: '16px', fontWeight: 700, fontSize: 16 }}>Znajdź bezpośrednie połączenia</Button>
          <Typography variant="labelSmall" color="text.secondary" sx={{ display: 'block', textAlign: 'center', mt: 1 }}>Pokazujemy tylko połączenia bezpośrednie bez przesiadek • +2 min na przystanek</Typography>
        </CardContent>
      </Card>

      <Stack spacing={1.5}>
        {results.length === 0 && from && to ? (
          <Paper sx={{ p: 2, borderRadius: '16px', bgcolor: 'warning.container', color: 'warning.onContainer' }}>
            <Typography variant="bodySmall">Brak bezpośrednich połączeń między tymi przystankami. Spróbuj innych przystanków.</Typography>
          </Paper>
        ) : results.map((r, idx) => {
          const diff = Math.max(0, r.depMins - now.minutes);
          const isSoon = diff < 30;
          return (
            <Card key={idx} elevation={isSoon ? 2 : 0} sx={{ borderRadius: '20px', border: 1, borderColor: isSoon ? 'primary.main' : 'divider' }}>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 2 }}>
                  <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
                    <Box sx={{ width: 44, height: 44, borderRadius: '12px', bgcolor: getLineHex(r.line.color), color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>{r.line.number}</Box>
                    <Box>
                      <Typography variant="titleMedium" sx={{ fontWeight: 700 }}>{r.depTime} → {r.arrTime} <Typography component="span" variant="labelSmall" color="text.secondary">{diff < 1 ? 'teraz' : `za ${diff} min`}</Typography></Typography>
                      <Typography variant="bodySmall" color="text.secondary">{r.line.name} • {r.dir.short}</Typography>
                    </Box>
                  </Box>
                  <Chip label={`${r.duration} min • ${r.stopsCount} przyst.`} size="small" color={isSoon ? 'primary' : 'default'} />
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 2, color: 'text.secondary' }}>
                  <Place fontSize="small" color="success" />
                  <Typography variant="labelSmall">{from} → {to}</Typography>
                </Box>
                <Box sx={{ display: 'flex', mt: 1.5, height: 6, borderRadius: 3, overflow: 'hidden', bgcolor: 'background.container' }}>
                  <Box sx={{ width: `${(r.fromIdx / r.dir.stops.length) * 100}%`, bgcolor: 'divider' }} />
                  <Box sx={{ width: `${(r.stopsCount / r.dir.stops.length) * 100}%`, bgcolor: 'primary.main' }} />
                </Box>
              </CardContent>
            </Card>
          );
        })}
      </Stack>
    </Box>
  );
}
