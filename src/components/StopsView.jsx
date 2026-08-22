import React, { useState, useMemo } from 'react';
import { Box, Card, CardContent, Typography, TextField, Chip, Stack, Paper, Grid, List, ListItem, ListItemButton, Avatar, InputAdornment } from '@mui/material';
import { Search, Place, DirectionsBus } from '@mui/icons-material';
import { getUniqueStops, findOccurrencesForStop } from '../utils/stops.js';
import { getScheduleForStop, parseMinutes, dayLabel } from '../utils/time.js';
import { getLineHex } from '../utils/stops.js';

export default function StopsView({ busData, state, setState, now }) {
  const [filter, setFilter] = useState('');
  const [selected, setSelected] = useState(null);

  const unique = useMemo(() => getUniqueStops(busData), [busData]);
  const filtered = useMemo(() => {
    if (!filter) return unique;
    const q = filter.toLowerCase();
    return unique.filter(u => u.name.toLowerCase().includes(q));
  }, [unique, filter]);

  const occurrences = useMemo(() => {
    if (!selected) return [];
    return findOccurrencesForStop(busData, selected);
  }, [busData, selected]);

  const allDeps = useMemo(() => {
    if (!occurrences.length) return [];
    let deps = [];
    occurrences.forEach(occ => {
      const sched = getScheduleForStop(occ.dir, occ.stopIdx, state.dayType);
      sched.forEach(t => {
        deps.push({ time: t, mins: parseMinutes(t), line: occ.line, dir: occ.dir });
      });
    });
    deps.sort((a, b) => a.mins - b.mins);
    return deps;
  }, [occurrences, state.dayType]);

  const upcoming = useMemo(() => {
    const nowMin = now.minutes;
    const up = allDeps.filter(d => d.mins >= nowMin).slice(0, 12);
    return up.length ? up : allDeps.slice(0, 12);
  }, [allDeps, now.minutes]);

  const byHour = useMemo(() => {
    const map = {};
    allDeps.forEach(d => { const h = d.time.split(':')[0]; (map[h] = map[h] || []).push(d); });
    return map;
  }, [allDeps]);

  return (
    <Grid container spacing={2}>
      <Grid item xs={12} md={4}>
        <Card sx={{ borderRadius: '24px', position: { md: 'sticky' }, top: { md: 80 } }}>
          <CardContent>
            <Typography variant="titleMedium" sx={{ fontWeight: 700 }}>Wybierz przystanek</Typography>
            <Typography variant="bodySmall" color="text.secondary" sx={{ mb: 2 }}>Zobaczysz wszystkie linie i godziny które przez niego przejeżdżają</Typography>

            <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
              {['weekday', 'saturday', 'sunday'].map(day => (
                <Chip key={day} label={day === 'weekday' ? 'PN-PT' : day === 'saturday' ? 'SOB' : 'NDZ'} onClick={() => setState(prev => ({ ...prev, dayType: day }))} color={state.dayType === day ? 'primary' : 'default'} variant={state.dayType === day ? 'filled' : 'outlined'} size="small" />
              ))}
            </Stack>

            <TextField
              fullWidth
              placeholder="Filtruj np. Girarda, PKP, D.A..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              size="small"
              InputProps={{ startAdornment: <InputAdornment position="start"><Search /></InputAdornment>, sx: { borderRadius: '16px', bgcolor: 'background.container' } }}
            />

            <Typography variant="labelSmall" color="text.secondary" sx={{ mt: 1, display: 'block' }}>{filtered.length} przystanków • {busData.lines.length} linii</Typography>

            <List dense sx={{ maxHeight: '60vh', overflowY: 'auto', mt: 1 }}>
              {filtered.slice(0, 100).map((u, i) => (
                <ListItem key={i} disablePadding>
                  <ListItemButton selected={selected === u.name} onClick={() => setSelected(u.name)} sx={{ borderRadius: '16px', mb: 0.5, border: 1, borderColor: selected === u.name ? 'primary.main' : 'divider', bgcolor: selected === u.name ? 'primary.container' : 'background.container' }}>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant="bodySmall" sx={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.name}</Typography>
                      <Typography variant="labelSmall" color="text.secondary">{u.linesCount} linii: {u.lines}</Typography>
                    </Box>
                    <Chip label={`${u.count}`} size="small" sx={{ ml: 1, height: 20, fontSize: 10 }} />
                  </ListItemButton>
                </ListItem>
              ))}
            </List>
          </CardContent>
        </Card>
      </Grid>

      <Grid item xs={12} md={8}>
        <Stack spacing={2}>
          <Card sx={{ borderRadius: '24px' }}>
            <CardContent>
              {!selected ? <Typography color="text.secondary">Wybierz przystanek z lewej listy aby zobaczyć odjazdy</Typography> : (
                <>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                    <Avatar sx={{ bgcolor: 'primary.main' }}><Place /></Avatar>
                    <Box>
                      <Typography variant="titleMedium" sx={{ fontWeight: 700 }}>{selected}</Typography>
                      <Typography variant="bodySmall" color="text.secondary">{occurrences.length} połączeń • Linie: {[...new Set(occurrences.map(o => o.line.number))].join(', ')}</Typography>
                    </Box>
                  </Box>
                  <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
                    {[...new Set(occurrences.map(o => o.line.number))].map(num => <Chip key={num} label={num} color="primary" size="small" />)}
                  </Stack>
                </>
              )}
            </CardContent>
          </Card>

          {selected && (
            <>
              <Card sx={{ borderRadius: '28px', bgcolor: 'primary.main', color: 'white' }}>
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                    <Typography variant="labelLarge" sx={{ textTransform: 'uppercase', opacity: 0.7 }}>Najbliższe odjazdy</Typography>
                    <Chip label={`${String(now.date.getHours()).padStart(2, '0')}:${String(now.date.getMinutes()).padStart(2, '0')}`} size="small" sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white' }} />
                  </Box>
                  <Stack spacing={1}>
                    {upcoming.map((dep, idx) => {
                      const diff = Math.max(0, Math.floor(dep.mins - now.minutes));
                      const isSoon = diff < 30;
                      return (
                        <Paper key={idx} sx={{ p: 1.5, borderRadius: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', bgcolor: isSoon ? 'white' : 'rgba(255,255,255,0.1)', color: isSoon ? 'primary.main' : 'white' }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                            <Avatar sx={{ bgcolor: getLineHex(dep.line.color), width: 36, height: 36, fontWeight: 700 }}>{dep.line.number}</Avatar>
                            <Box>
                              <Typography variant="bodyMedium" sx={{ fontWeight: 700, fontFamily: 'Roboto Mono' }}>{dep.time} <span style={{ fontSize: 11, opacity: 0.6 }}>{diff < 1 ? 'teraz' : `za ${diff} min`}</span></Typography>
                              <Typography variant="labelSmall" sx={{ opacity: 0.7 }}>{dep.dir.label}</Typography>
                            </Box>
                          </Box>
                          <Box sx={{ textAlign: 'right' }}>
                            <Chip label={dayLabel(state.dayType)} size="small" sx={{ height: 20, fontSize: 10, bgcolor: isSoon ? 'primary.main' : 'rgba(255,255,255,0.2)', color: isSoon ? 'white' : 'white' }} />
                            <Typography variant="labelSmall" sx={{ display: 'block', mt: 0.5, fontSize: 10, opacity: 0.6 }}>{dep.dir.stops.length - dep.stopIdx} przyst. do końca</Typography>
                          </Box>
                        </Paper>
                      );
                    })}
                  </Stack>
                </CardContent>
              </Card>

              <Card sx={{ borderRadius: '24px' }}>
                <CardContent>
                  <Typography variant="titleSmall" sx={{ fontWeight: 600, mb: 2 }}>Wszystkie kursy dziś</Typography>
                  {Object.keys(byHour).sort().map(h => (
                    <Box key={h} sx={{ mb: 2 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                        <Avatar sx={{ width: 24, height: 24, fontSize: 11, bgcolor: 'primary.main' }}>{h}</Avatar>
                        <Box sx={{ flex: 1, height: 1, bgcolor: 'divider' }} />
                      </Box>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                        {byHour[h].map((d, i) => (
                          <Chip key={i} icon={<Avatar sx={{ bgcolor: getLineHex(d.line.color), width: 20, height: 20, fontSize: 10, color: 'white' }}>{d.line.number}</Avatar>} label={d.time} size="small" variant="outlined" sx={{ fontFamily: 'Roboto Mono' }} />
                        ))}
                      </Box>
                    </Box>
                  ))}
                </CardContent>
              </Card>
            </>
          )}
        </Stack>
      </Grid>
    </Grid>
  );
}
