import React from 'react';
import { Box, Grid, Card, CardContent, Typography, Chip, Stack, Button, Divider, List, ListItem, ListItemButton, ListItemAvatar, Avatar, IconButton, Paper, LinearProgress } from '@mui/material';
import { DirectionsBus, Favorite, FavoriteBorder, Share, LocationOn, Schedule, ArrowForward } from '@mui/icons-material';
import { getLineHex } from '../utils/stops.js';
import { getScheduleForStop, parseMinutes, formatNow } from '../utils/time.js';
import { addRecent } from '../utils/storage.js';

function LineCard({ line, active, onClick }) {
  return (
    <Card
      onClick={onClick}
      elevation={active ? 2 : 0}
      sx={{
        cursor: 'pointer',
        borderRadius: '20px',
        bgcolor: active ? 'primary.container' : 'background.container',
        border: 1,
        borderColor: active ? 'primary.main' : 'divider',
        transition: 'all 0.2s',
        '&:hover': { elevation: 1, transform: 'translateY(-1px)' },
        height: '100%',
      }}
    >
      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
          <Avatar sx={{ bgcolor: active ? 'primary.main' : getLineHex(line.color), width: 36, height: 36, fontWeight: 700 }}>{line.number}</Avatar>
          <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: line.type === 'miejska' ? 'success.main' : 'info.main' }} />
        </Box>
        <Typography variant="labelLarge" sx={{ fontWeight: 600, lineHeight: 1.2, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', minHeight: 32 }}>{line.name}</Typography>
        <Typography variant="labelSmall" color="text.secondary" sx={{ mt: 0.5, fontSize: 11, textTransform: 'uppercase' }}>{line.directions.length} kier. • {line.type}</Typography>
      </CardContent>
    </Card>
  );
}

export default function LinesView({ busData, state, setState, currentLine, currentDir, now, favorites, recents, toggleFavorite, onSelectStop, setToast }) {
  const [nextTick, setNextTick] = React.useState(0);
  React.useEffect(() => {
    const id = setInterval(() => setNextTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  if (!currentLine || !currentDir) return null;

  const schedule = getScheduleForStop(currentDir, state.stopIdx, state.dayType);
  const nowMin = now.minutes;
  const upcoming = schedule.map(t => ({ time: t, mins: parseMinutes(t) })).filter(o => o.mins >= nowMin).slice(0, 4);
  const next = upcoming[0];
  const diffMin = next ? Math.max(0, Math.floor(next.mins - nowMin)) : null;
  const diffSec = next ? Math.max(0, Math.floor((next.mins - nowMin - diffMin) * 60)) : null;

  const grouped = {};
  schedule.forEach(t => { const h = t.split(':')[0]; (grouped[h] = grouped[h] || []).push(t); });
  const hours = Object.keys(grouped).sort((a, b) => Number(a) - Number(b));

  const totalStops = currentDir.stops.length;
  const progress = totalStops > 1 ? (state.stopIdx / (totalStops - 1)) * 100 : 100;

  const isFav = favorites.some(f => f.stop === currentDir.stops[state.stopIdx]);

  return (
    <Grid container spacing={2}>
      {/* Left - Lines */}
      <Grid item xs={12} lg={3}>
        <Stack spacing={2} sx={{ position: { lg: 'sticky' }, top: { lg: 80 } }}>
          <Card sx={{ borderRadius: '24px' }}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="titleSmall" sx={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'text.secondary' }}>Wybierz linię</Typography>
                <Chip label={`${busData.lines.length} linii`} size="small" color="primary" variant="outlined" />
              </Box>
              <Grid container spacing={1.5}>
                {busData.lines.map(line => (
                  <Grid item xs={3} sm={2} lg={4} key={line.id}>
                    <LineCard line={line} active={line.id === state.lineId} onClick={() => setState(prev => ({ ...prev, lineId: line.id, dirIdx: 0, stopIdx: 0 }))} />
                  </Grid>
                ))}
              </Grid>
              <Paper variant="outlined" sx={{ mt: 2, p: 1.5, borderRadius: '12px', bgcolor: 'background.container', borderStyle: 'dashed' }}>
                <Typography variant="labelSmall" color="text.secondary">Ostatnia aktualizacja: {busData.meta?.generatedAt ? new Date(busData.meta.generatedAt).toLocaleString('pl-PL') : '—'}</Typography>
              </Paper>
            </CardContent>
          </Card>

          <Card sx={{ borderRadius: '24px', display: { xs: 'none', lg: 'block' } }}>
            <CardContent>
              <Typography variant="titleSmall" sx={{ fontWeight: 600, mb: 1.5 }}>❤️ Ulubione</Typography>
              {favorites.length === 0 ? (
                <Typography variant="bodySmall" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>Brak ulubionych<br/><span style={{ fontSize: 10 }}>Kliknij serce przy przystanku</span></Typography>
              ) : (
                <Stack spacing={1}>
                  {favorites.map((f, i) => (
                    <Paper key={i} variant="outlined" sx={{ p: 1.5, borderRadius: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Box>
                        <Typography variant="bodySmall" sx={{ fontWeight: 600 }}>{f.stop}</Typography>
                        <Typography variant="labelSmall" color="text.secondary">{f.lines?.join(', ')}</Typography>
                      </Box>
                      <IconButton size="small" onClick={() => toggleFavorite(f.stop, [])}>✕</IconButton>
                    </Paper>
                  ))}
                </Stack>
              )}
            </CardContent>
          </Card>

          <Card sx={{ borderRadius: '24px', display: { xs: 'none', lg: 'block' } }}>
            <CardContent>
              <Typography variant="titleSmall" sx={{ fontWeight: 600, mb: 1.5 }}>Ostatnio</Typography>
              {recents.length === 0 ? <Typography variant="bodySmall" color="text.secondary">Brak historii</Typography> :
                <Stack spacing={1}>
                  {recents.map((r, i) => (
                    <Button key={i} variant="contained" disableElevation onClick={() => setState(prev => ({ ...prev, lineId: r.lineId, dirIdx: r.dirIdx, stopIdx: r.stopIdx }))} sx={{ justifyContent: 'flex-start', bgcolor: 'background.container', color: 'text.primary', borderRadius: '16px', p: 1, '&:hover': { bgcolor: 'background.containerHigh' } }}>
                      <Avatar sx={{ bgcolor: getLineHex(r.lineColor), width: 28, height: 28, fontSize: 12, mr: 1 }}>{r.lineNumber}</Avatar>
                      <Typography variant="bodySmall" sx={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{r.stop}</Typography>
                    </Button>
                  ))}
                </Stack>
              }
            </CardContent>
          </Card>
        </Stack>
      </Grid>

      {/* Center */}
      <Grid item xs={12} lg={5}>
        <Stack spacing={2}>
          <Card sx={{ borderRadius: '24px', p: 1 }}>
            <CardContent sx={{ pb: '8px !important' }}>
              <Stack direction="row" spacing={1} sx={{ overflowX: 'auto', pb: 1 }}>
                {currentLine.directions.map((d, i) => (
                  <Chip key={i} label={d.short} onClick={() => setState(prev => ({ ...prev, dirIdx: i, stopIdx: 0 }))} color={i === state.dirIdx ? 'primary' : 'default'} variant={i === state.dirIdx ? 'filled' : 'outlined'} sx={{ borderRadius: '20px', fontWeight: 600 }} />
                ))}
              </Stack>
              <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                {['weekday', 'saturday', 'sunday'].map(day => (
                  <Chip key={day} label={day === 'weekday' ? 'PN-PT' : day === 'saturday' ? 'SOBOTA' : 'NIEDZIELA'} onClick={() => setState(prev => ({ ...prev, dayType: day }))} color={state.dayType === day ? 'primary' : 'default'} variant={state.dayType === day ? 'filled' : 'outlined'} sx={{ borderRadius: '20px', fontSize: 12 }} />
                ))}
              </Stack>
              <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Avatar sx={{ bgcolor: getLineHex(currentLine.color), width: 40, height: 40, fontWeight: 700 }}>{currentLine.number}</Avatar>
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="titleMedium" sx={{ fontWeight: 700, lineHeight: 1.1 }}>{currentLine.name}</Typography>
                  <Typography variant="bodySmall" color="text.secondary" sx={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{currentDir.label}</Typography>
                </Box>
                <Chip label={`${currentDir.stops.length} przyst.`} size="small" variant="outlined" sx={{ ml: 'auto' }} />
              </Box>
            </CardContent>
          </Card>

          <Card sx={{ borderRadius: '24px', overflow: 'hidden' }}>
            <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: 1, borderColor: 'divider' }}>
              <Typography variant="titleSmall" sx={{ fontWeight: 700 }}>Przystanki</Typography>
              <Chip label={`${currentDir.stops.length}`} size="small" />
            </Box>
            <List disablePadding sx={{ maxHeight: 520, overflowY: 'auto' }}>
              {currentDir.stops.map((stop, i) => {
                const sched = getScheduleForStop(currentDir, i, state.dayType);
                const active = i === state.stopIdx;
                const nextIdx = sched.findIndex(t => parseMinutes(t) >= now.minutes);
                const fav = favorites.some(f => f.stop === stop);
                return (
                  <ListItem key={i} disablePadding divider>
                    <ListItemButton selected={active} onClick={() => { setState(prev => ({ ...prev, stopIdx: i })); const line = currentLine; const newRecents = addRecent(line, state.dirIdx, i, stop); }} sx={{ py: 1.5, gap: 1.5, '&.Mui-selected': { bgcolor: 'primary.container' } }}>
                      <Avatar sx={{ width: 32, height: 32, fontSize: 12, fontWeight: 700, bgcolor: active ? 'primary.main' : 'background.containerHighest', color: active ? 'white' : 'text.primary', border: 1, borderColor: 'outline.variant' }}>{i + 1}</Avatar>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant="bodyMedium" sx={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{stop}</Typography>
                        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mt: 0.5 }}>
                          <Typography variant="labelSmall" color="text.secondary">{sched.length} kursów</Typography>
                          {nextIdx !== -1 && <Chip label={`nast. ${sched[nextIdx]}`} size="small" sx={{ height: 20, fontSize: 10, bgcolor: active ? 'primary.main' : 'success.container', color: active ? 'white' : 'success.onContainer' }} />}
                        </Box>
                      </Box>
                      <IconButton size="small" onClick={(e) => { e.stopPropagation(); toggleFavorite(stop, [currentLine.number]); }} sx={{ bgcolor: fav ? 'error.container' : 'background.container' }}>
                        {fav ? <Favorite fontSize="small" color="error" /> : <FavoriteBorder fontSize="small" />}
                      </IconButton>
                    </ListItemButton>
                  </ListItem>
                );
              })}
            </List>
          </Card>

          <Card sx={{ borderRadius: '24px' }}>
            <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: 1, borderColor: 'divider' }}>
              <Typography variant="titleSmall" sx={{ fontWeight: 700 }}>Rozkład</Typography>
              <Typography variant="labelSmall" color="primary" sx={{ fontWeight: 600, maxWidth: '50%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{currentDir.stops[state.stopIdx]}</Typography>
            </Box>
            <CardContent>
              {hours.length ? (
                <Grid container spacing={1.5}>
                  {hours.map(h => (
                    <Grid item xs={12} sm={6} key={h}>
                      <Paper variant="outlined" sx={{ p: 1.5, borderRadius: '16px', bgcolor: 'background.container' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                          <Avatar sx={{ width: 28, height: 28, fontSize: 12, fontWeight: 700, bgcolor: 'primary.main' }}>{h}</Avatar>
                          <Divider sx={{ flex: 1 }} />
                        </Box>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                          {grouped[h].map(t => {
                            const isNext = parseMinutes(t) >= now.minutes && schedule.findIndex(x => parseMinutes(x) >= now.minutes) === schedule.indexOf(t);
                            const isPast = parseMinutes(t) < now.minutes;
                            return (
                              <Chip key={t} label={t} size="small" color={isNext ? 'primary' : 'default'} variant={isNext ? 'filled' : 'outlined'} sx={{ fontFamily: 'Roboto Mono', fontSize: 12, textDecoration: isPast ? 'line-through' : 'none', opacity: isPast ? 0.5 : 1 }} />
                            );
                          })}
                        </Box>
                      </Paper>
                    </Grid>
                  ))}
                </Grid>
              ) : <Typography sx={{ textAlign: 'center', py: 4 }} color="text.secondary">Brak kursów</Typography>}
            </CardContent>
          </Card>
        </Stack>
      </Grid>

      {/* Right - Next Bus */}
      <Grid item xs={12} lg={4}>
        <Stack spacing={2} sx={{ position: { lg: 'sticky' }, top: { lg: 80 } }}>
          <Card sx={{ borderRadius: '28px', bgcolor: 'primary.main', color: 'white', overflow: 'hidden', position: 'relative' }}>
            <Box sx={{ position: 'absolute', top: -80, right: -80, width: 240, height: 240, borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,255,255,0.15) 0%, transparent 70%)' }} />
            <CardContent sx={{ p: 3, position: 'relative' }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Box>
                  <Typography variant="labelSmall" sx={{ textTransform: 'uppercase', letterSpacing: 2, opacity: 0.7 }}>Następny odjazd</Typography>
                  <Chip label={`Linia ${currentLine.number}`} sx={{ mt: 1, bgcolor: 'white', color: 'primary.main', fontWeight: 700 }} />
                </Box>
                <Box sx={{ width: 40, height: 40, borderRadius: '50%', bgcolor: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#4ade80', animation: 'pulse 1.5s infinite' }} />
                </Box>
              </Box>

              <Box sx={{ mt: 4 }}>
                <Typography variant="h1" sx={{ fontSize: 56, fontWeight: 700, lineHeight: 0.9, fontFamily: 'Roboto Mono' }}>{next ? (diffMin < 60 ? `${String(diffMin).padStart(2, '0')}:${String(diffSec).padStart(2, '0')}` : next.time) : '--:--'}</Typography>
                <Typography variant="bodyMedium" sx={{ mt: 1, opacity: 0.8 }}>{next ? `odjazd o ${next.time} • za ${diffMin} min` : 'Koniec kursów na dziś'}</Typography>
              </Box>

              <Grid container spacing={1} sx={{ mt: 3 }}>
                <Grid item xs={4}><Paper sx={{ p: 1.5, borderRadius: '16px', bgcolor: 'rgba(255,255,255,0.1)', color: 'white' }}><Typography variant="labelSmall" sx={{ opacity: 0.6, textTransform: 'uppercase', fontSize: 10 }}>Kierunek</Typography><Typography variant="bodySmall" sx={{ mt: 0.5, fontSize: 12 }}>{currentDir.short.slice(0, 20)}</Typography></Paper></Grid>
                <Grid item xs={4}><Paper sx={{ p: 1.5, borderRadius: '16px', bgcolor: 'rgba(255,255,255,0.1)', color: 'white' }}><Typography variant="labelSmall" sx={{ opacity: 0.6, textTransform: 'uppercase', fontSize: 10 }}>Przystanek</Typography><Typography variant="bodySmall" sx={{ mt: 0.5, fontSize: 12 }}>{currentDir.stops[state.stopIdx]?.slice(0, 18)}</Typography></Paper></Grid>
                <Grid item xs={4}><Paper sx={{ p: 1.5, borderRadius: '16px', bgcolor: 'rgba(255,255,255,0.1)', color: 'white' }}><Typography variant="labelSmall" sx={{ opacity: 0.6, textTransform: 'uppercase', fontSize: 10 }}>Dzień</Typography><Typography variant="bodySmall" sx={{ mt: 0.5, fontSize: 12 }}>{state.dayType === 'weekday' ? 'PN-PT' : state.dayType === 'saturday' ? 'SOB' : 'NDZ'}</Typography></Paper></Grid>
              </Grid>

              <Box sx={{ mt: 3 }}>
                <Typography variant="labelSmall" sx={{ textTransform: 'uppercase', opacity: 0.6, mb: 1, display: 'block' }}>Kolejne odjazdy</Typography>
                <Stack spacing={1}>
                  {upcoming.map((o, idx) => (
                    <Box key={idx} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 1.5, borderRadius: '16px', bgcolor: idx === 0 ? 'white' : 'rgba(255,255,255,0.1)', color: idx === 0 ? 'primary.main' : 'white' }}>
                      <Typography variant="bodyMedium" sx={{ fontFamily: 'Roboto Mono', fontWeight: 600 }}>{o.time}</Typography>
                      <Typography variant="labelSmall">{idx === 0 ? 'TERAZ' : `za ${Math.floor(o.mins - nowMin)} min`}</Typography>
                    </Box>
                  ))}
                </Stack>
              </Box>

              <Stack direction="row" spacing={1} sx={{ mt: 3 }}>
                <Button fullWidth variant="contained" sx={{ bgcolor: 'white', color: 'primary.main', '&:hover': { bgcolor: 'grey.100' }, borderRadius: '24px' }} startIcon={<Share />} onClick={() => { if (navigator.share) navigator.share({ title: `ŻPA ${currentLine.number}`, text: currentDir.stops[state.stopIdx], url: location.href }); else { navigator.clipboard.writeText(location.href); setToast({ open: true, message: 'Skopiowano link', severity: 'success' }); } }}>Udostępnij</Button>
                <IconButton onClick={() => toggleFavorite(currentDir.stops[state.stopIdx], [currentLine.number])} sx={{ bgcolor: 'rgba(255,255,255,0.15)', color: 'white', width: 48, height: 48 }}>{isFav ? <Favorite /> : <FavoriteBorder />}</IconButton>
              </Stack>
            </CardContent>
          </Card>

          <Card sx={{ borderRadius: '24px' }}>
            <CardContent>
              <Typography variant="titleSmall" sx={{ fontWeight: 600, mb: 2 }}>Symulacja przejazdu</Typography>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}><Typography variant="labelSmall" color="text.secondary">Start</Typography><Typography variant="labelSmall" color="text.secondary">{Math.round(progress)}%</Typography><Typography variant="labelSmall" color="text.secondary">Koniec</Typography></Box>
              <LinearProgress variant="determinate" value={progress} sx={{ height: 8, borderRadius: 4, mb: 2 }} />
              <Stack spacing={0.5} sx={{ maxHeight: 200, overflowY: 'auto' }}>
                {currentDir.stops.map((s, i) => (
                  <Box key={i} sx={{ display: 'flex', gap: 1, alignItems: 'center', opacity: i < state.stopIdx ? 0.5 : 1, textDecoration: i < state.stopIdx ? 'line-through' : 'none' }}>
                    <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: i === state.stopIdx ? 'primary.main' : i < state.stopIdx ? 'text.primary' : 'outline.variant' }} />
                    <Typography variant="bodySmall" sx={{ fontWeight: i === state.stopIdx ? 700 : 400, color: i === state.stopIdx ? 'primary.main' : 'text.primary' }}>{s}</Typography>
                  </Box>
                ))}
              </Stack>
            </CardContent>
          </Card>
        </Stack>
      </Grid>
    </Grid>
  );
}
