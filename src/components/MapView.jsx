import React, { useEffect, useState } from 'react';
import { Box, Card, CardContent, Typography, Chip, Stack, Paper, Button, Select, MenuItem, IconButton, Avatar, Grid } from '@mui/material';
import { MyLocation, Place } from '@mui/icons-material';
import { MapContainer, TileLayer, CircleMarker, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import { findOccurrencesForStop, getLineHex } from '../utils/stops.js';
import { getScheduleForStop, parseMinutes } from '../utils/time.js';

function MapController({ center }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, 13);
    setTimeout(() => map.invalidateSize(), 200);
  }, [center, map]);
  return null;
}

export default function MapView({ busData, stopCoords, state, now }) {
  const [selectedLine, setSelectedLine] = useState('all');
  const [selectedDir, setSelectedDir] = useState(0);
  const [selectedStop, setSelectedStop] = useState(null);
  const [userPos, setUserPos] = useState(null);
  const [routeCoords, setRouteCoords] = useState([]);

  const stopsWithCoords = React.useMemo(() => {
    if (stopCoords && Object.keys(stopCoords).length) {
      const all = [];
      for (const key in stopCoords) {
        const v = stopCoords[key];
        if (!v.lat || !v.lon) continue;
        const baseName = key.replace(/\s*\[\d+\]$/, '').trim();
        all.push({ name: baseName, officialKey: key, lat: v.lat, lng: v.lon });
      }
      const seen = new Set();
      const deduped = [];
      for (const s of all) {
        const k = `${s.lat.toFixed(5)},${s.lng.toFixed(5)}`;
        if (!seen.has(k)) { seen.add(k); deduped.push(s); }
      }
      return deduped;
    }
    return [];
  }, [stopCoords]);

  const center = React.useMemo(() => {
    if (stopsWithCoords.length) {
      const sum = stopsWithCoords.reduce((acc, s) => ({ lat: acc.lat + s.lat, lng: acc.lng + s.lng }), { lat: 0, lng: 0 });
      return [sum.lat / stopsWithCoords.length, sum.lng / stopsWithCoords.length];
    }
    return [52.055, 20.045];
  }, [stopsWithCoords]);

  const lineObj = React.useMemo(() => {
    if (selectedLine === 'all') return null;
    return busData.lines.find(l => l.id === selectedLine) || busData.lines.find(l => l.number === selectedLine);
  }, [busData, selectedLine]);

  useEffect(() => {
    if (!lineObj) { setRouteCoords([]); return; }
    const dir = lineObj.directions[selectedDir] || lineObj.directions[0];
    if (!dir || !dir.stops_full) { setRouteCoords([]); return; }

    async function fetchRoute() {
      const coords = dir.stops_full.filter(s => s.lat && s.lon).map(s => [s.lat, s.lon]);
      if (coords.length < 2) { setRouteCoords([]); return; }
      let full = [];
      for (let i = 0; i < coords.length - 1; i++) {
        const a = coords[i], b = coords[i + 1];
        try {
          const key = `${a[1].toFixed(5)},${a[0].toFixed(5)};${b[1].toFixed(5)},${b[0].toFixed(5)}`;
          const cached = localStorage.getItem('osrm_' + key);
          if (cached) {
            const parsed = JSON.parse(cached);
            if (full.length) parsed.shift();
            full.push(...parsed);
            continue;
          }
          const url = `https://router.project-osrm.org/route/v1/driving/${a[1]},${a[0]};${b[1]},${b[0]}?overview=full&geometries=geojson`;
          const res = await fetch(url);
          if (res.ok) {
            const json = await res.json();
            if (json.routes?.[0]?.geometry?.coordinates) {
              const seg = json.routes[0].geometry.coordinates.map(c => [c[1], c[0]]);
              try { localStorage.setItem('osrm_' + key, JSON.stringify(seg)); } catch {}
              if (full.length) seg.shift();
              full.push(...seg);
              continue;
            }
          }
        } catch {}
        if (full.length === 0) full.push(a);
        full.push(b);
      }
      setRouteCoords(full.length ? full : coords);
    }
    fetchRoute();
  }, [lineObj, selectedDir]);

  const occurrences = React.useMemo(() => {
    if (!selectedStop) return [];
    return findOccurrencesForStop(busData, selectedStop);
  }, [busData, selectedStop]);

  const deps = React.useMemo(() => {
    let all = [];
    occurrences.forEach(o => {
      const sched = getScheduleForStop(o.dir, o.stopIdx, state.dayType);
      sched.forEach(t => all.push({ time: t, mins: parseMinutes(t), line: o.line, dir: o.dir }));
    });
    all.sort((a, b) => a.mins - b.mins);
    const upcoming = all.filter(d => d.mins >= now.minutes).slice(0, 10);
    return upcoming.length ? upcoming : all.slice(0, 10);
  }, [occurrences, state.dayType, now.minutes]);

  const handleLocate = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(pos => {
        setUserPos([pos.coords.latitude, pos.coords.longitude]);
      });
    }
  };

  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 380px' }, gap: 2, alignItems: 'start' }}>
      <Card sx={{ borderRadius: '28px', overflow: 'hidden' }}>
        <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: 1, borderColor: 'divider', flexWrap: 'wrap', gap: 1 }}>
          <Box>
            <Typography variant="titleMedium" sx={{ fontWeight: 700 }}>Mapa przystanków ŻPA</Typography>
            <Typography variant="labelSmall" color="text.secondary">Kliknij pinezkę • {stopsWithCoords.length} GPS • Żyrardów</Typography>
          </Box>
          <Stack direction="row" spacing={1}>
            <IconButton onClick={handleLocate} sx={{ bgcolor: 'background.container' }}><MyLocation /></IconButton>
            <Select value={selectedLine} onChange={(e) => { setSelectedLine(e.target.value); setSelectedDir(0); }} size="small" sx={{ borderRadius: '20px', minWidth: 180, bgcolor: 'background.container' }}>
              <MenuItem value="all">Wszystkie linie</MenuItem>
              {busData.lines.map(l => <MenuItem key={l.id} value={l.id}>Linia {l.number} – {l.name.slice(0, 20)}</MenuItem>)}
            </Select>
          </Stack>
        </Box>

        {lineObj && (
          <Box sx={{ px: 2, py: 1, bgcolor: 'background.container', display: 'flex', gap: 1, overflowX: 'auto', borderBottom: 1, borderColor: 'divider' }}>
            {lineObj.directions.map((d, idx) => (
              <Chip key={idx} label={d.short} onClick={() => setSelectedDir(idx)} color={idx === selectedDir ? 'primary' : 'default'} variant={idx === selectedDir ? 'filled' : 'outlined'} size="small" sx={{ borderRadius: '20px' }} />
            ))}
            <Typography variant="labelSmall" color="text.secondary" sx={{ alignSelf: 'center', ml: 1 }}>Tylko 1 kierunek na raz</Typography>
          </Box>
        )}

        <Box sx={{ height: { xs: '60vh', md: '75vh' }, width: '100%' }}>
          <MapContainer center={center} zoom={13} style={{ height: '100%', width: '100%' }} zoomControl={false}>
            <MapController center={center} />
            <TileLayer attribution="© OpenStreetMap" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            {userPos && <Marker position={userPos}><Popup>Twoja lokalizacja</Popup></Marker>}
            {selectedLine === 'all' ? (
              stopsWithCoords.map((s, i) => (
                <CircleMarker key={i} center={[s.lat, s.lng]} radius={7} pathOptions={{ fillColor: '#006A60', color: 'white', weight: 2, fillOpacity: 0.95 }} eventHandlers={{ click: () => setSelectedStop(s.name) }}>
                  <Popup><b>{s.name}</b><br/><Button size="small" variant="contained" sx={{ mt: 1, borderRadius: '12px' }} onClick={() => setSelectedStop(s.name)}>Pokaż odjazdy</Button></Popup>
                </CircleMarker>
              ))
            ) : lineObj && lineObj.directions[selectedDir]?.stops_full ? (
              lineObj.directions[selectedDir].stops_full.map((sf, idx) => (
                <Marker key={idx} position={[sf.lat, sf.lon]} icon={L.divIcon({ className: '', html: `<div style="width:26px;height:26px;background:${getLineHex(lineObj.color)};color:white;border:2px solid white;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:11px;box-shadow:0 2px 6px rgba(0,0,0,0.3)">${idx + 1}</div>`, iconSize: [26, 26], iconAnchor: [13, 13] })} eventHandlers={{ click: () => setSelectedStop(sf.official_name || sf.name) }}>
                  <Popup><b>{idx + 1}. {sf.official_name}</b><br/>Linia {lineObj.number} • {lineObj.directions[selectedDir].short}</Popup>
                </Marker>
              ))
            ) : null}
            {routeCoords.length > 1 && <Polyline positions={routeCoords} pathOptions={{ color: lineObj ? getLineHex(lineObj.color) : '#006A60', weight: 5, opacity: 0.85 }} />}
          </MapContainer>
        </Box>
        <Box sx={{ p: 1.5, bgcolor: 'background.container', display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <Typography variant="labelSmall" color="text.secondary">📍 {stopsWithCoords.length} GPS • PKS Gostynin + OSM</Typography>
        </Box>
      </Card>

      <Stack spacing={2} sx={{ position: { lg: 'sticky' }, top: 80 }}>
        <Card sx={{ borderRadius: '24px' }}>
          <CardContent>
            <Typography variant="titleSmall" sx={{ fontWeight: 600, mb: 1 }}>Wybrany przystanek</Typography>
            {selectedStop ? <><Typography variant="bodyMedium" sx={{ fontWeight: 700 }}>{selectedStop}</Typography><Typography variant="labelSmall" color="text.secondary">{stopCoords[selectedStop]?.lat?.toFixed(5)}, {stopCoords[selectedStop]?.lon?.toFixed(5)}</Typography></> : <Typography variant="bodySmall" color="text.secondary">Kliknij pinezkę na mapie</Typography>}
          </CardContent>
        </Card>

        <Card sx={{ borderRadius: '28px', bgcolor: 'primary.main', color: 'white' }}>
          <CardContent>
            <Typography variant="labelLarge" sx={{ textTransform: 'uppercase', opacity: 0.7, mb: 2 }}>Odjazdy z pinezki</Typography>
            <Stack spacing={1} sx={{ maxHeight: '40vh', overflowY: 'auto' }}>
              {deps.length ? deps.map((d, i) => (
                <Paper key={i} sx={{ p: 1.5, borderRadius: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', bgcolor: 'rgba(255,255,255,0.1)', color: 'white' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Avatar sx={{ bgcolor: getLineHex(d.line.color), width: 28, height: 28, fontSize: 11, fontWeight: 700 }}>{d.line.number}</Avatar>
                    <Typography variant="bodySmall" sx={{ fontFamily: 'Roboto Mono', fontWeight: 600 }}>{d.time}</Typography>
                  </Box>
                  <Typography variant="labelSmall" sx={{ opacity: 0.7 }}>za {Math.max(0, Math.floor(d.mins - now.minutes))} min • {d.dir.short.slice(0, 12)}</Typography>
                </Paper>
              )) : <Typography variant="bodySmall" sx={{ opacity: 0.7 }}>Brak kursów dziś</Typography>}
            </Stack>
          </CardContent>
        </Card>
      </Stack>
    </Box>
  );
}
