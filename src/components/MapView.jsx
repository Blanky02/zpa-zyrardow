import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTheme } from '@mui/material/styles';
import {
  Avatar,
  Box,
  Button,
  Divider,
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import {
  CheckRounded,
  CloseRounded,
  FilterAltRounded,
  MapRounded,
  MyLocationRounded,
  SwapVertRounded,
  TravelExploreRounded,
  ExpandLessRounded,
  ExpandMoreRounded,
} from '@mui/icons-material';
import {
  MapContainer,
  Marker,
  Polyline,
  TileLayer,
  Tooltip,
  ZoomControl,
  useMap,
} from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import 'react-leaflet-cluster/dist/assets/MarkerCluster.css';
import 'react-leaflet-cluster/dist/assets/MarkerCluster.Default.css';
import L from 'leaflet';
import {
  findOccurrencesForStop,
  formatDestination,
  getLineHex,
  getPlatformKey,
  getRoutePlatforms,
  normalizeStopName,
} from '../utils/stops.js';
import { getScheduleForStop, parseMinutes } from '../utils/time.js';

const OSRM_CACHE_PREFIX = 'osrm_';
const OSRM_CACHE_MAX_ENTRIES = 60;

function osrmCacheKeys() {
  const keys = [];
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i);
    if (key?.startsWith(OSRM_CACHE_PREFIX)) keys.push(key);
  }
  return keys;
}

function osrmCacheRead(key) {
  try {
    const raw = localStorage.getItem(OSRM_CACHE_PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed; // stary format: same wspolrzedne
    return Array.isArray(parsed?.c) ? parsed.c : null;
  } catch {
    return null;
  }
}

function osrmCacheWrite(key, segment) {
  const payload = JSON.stringify({ t: Date.now(), c: segment });
  try {
    // prosty LRU: przy pelnym cache usuwamy najstarsze wpisy
    const staleKeys = osrmCacheKeys();
    if (staleKeys.length >= OSRM_CACHE_MAX_ENTRIES) {
      const byAge = staleKeys
        .map(k => {
          try { return [JSON.parse(localStorage.getItem(k))?.t || 0, k]; }
          catch { return [0, k]; }
        })
        .sort((a, b) => a[0] - b[0]);
      byAge.slice(0, staleKeys.length - OSRM_CACHE_MAX_ENTRIES + 1)
        .forEach(([, k]) => localStorage.removeItem(k));
    }
    localStorage.setItem(OSRM_CACHE_PREFIX + key, payload);
  } catch {
    // przekroczony limit pamieci - wyczysc caly cache tras i sprobuj ponownie
    try {
      osrmCacheKeys().forEach(k => localStorage.removeItem(k));
      localStorage.setItem(OSRM_CACHE_PREFIX + key, payload);
    } catch {}
  }
}

function MapController({ center, zoom, bounds, viewKey }) {
  const map = useMap();
  const appliedViewKey = useRef(null);

  useEffect(() => {
    // Do not control the map on every React render. MarkerClusterGroup needs to
    // own the viewport while a user is zooming into a cluster; calling
    // fitBounds again would immediately merge the markers back into a cluster.
    if (appliedViewKey.current === viewKey) return undefined;
    appliedViewKey.current = viewKey;

    if (bounds?.length > 1) {
      map.fitBounds(bounds, { padding: [28, 28], maxZoom: zoom });
    } else {
      map.setView(center, zoom);
    }

    const invalidateTimer = window.setTimeout(() => map.invalidateSize(), 150);
    return () => window.clearTimeout(invalidateTimer);
  }, [bounds, center, map, viewKey, zoom]);
  return null;
}

function lineMarker(line, index) {
  const color = getLineHex(line.color);
  return L.divIcon({
    className: '',
    html: `<div style="width:28px;height:28px;background:${color};color:white;border:2px solid white;border-radius:10px;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:11px;box-shadow:0 3px 10px rgba(0,0,0,.28)">${index + 1}</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

const stopMarkerIcon = L.divIcon({
  className: '',
  html: '<div style="width:15px;height:15px;background:#2A9D6F;border:2px solid white;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,.28)"></div>',
  iconSize: [15, 15],
  iconAnchor: [7.5, 7.5],
});

const auditStopMarkerIcon = L.divIcon({
  className: '',
  html: '<div style="width:20px;height:20px;background:#E76F51;border:3px solid white;border-radius:50%;box-shadow:0 3px 12px rgba(120,34,15,.42)"></div>',
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

function distanceMeters(first, second) {
  const radius = 6_371_000;
  const lat1 = first.lat * Math.PI / 180;
  const lat2 = second.lat * Math.PI / 180;
  const deltaLat = (second.lat - first.lat) * Math.PI / 180;
  const deltaLon = (second.lng - first.lng) * Math.PI / 180;
  const value = Math.sin(deltaLat / 2) ** 2
    + Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) ** 2;
  return 2 * radius * Math.asin(Math.sqrt(value));
}

function clusterMarkerIcon(cluster) {
  const count = cluster.getChildCount();
  const size = count > 20 ? 46 : count > 8 ? 40 : 36;
  return L.divIcon({
    className: '',
    html: `<div style="width:${size}px;height:${size}px;background:#2A9D6F;color:white;border:3px solid rgba(255,255,255,.9);border-radius:50%;display:flex;align-items:center;justify-content:center;font:800 12px Roboto,sans-serif;box-shadow:0 5px 16px rgba(0,0,0,.28)">${count}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

export default function MapView({ busData, stopCoords, state, now }) {
  const theme = useTheme();
  const darkMap = theme.palette.mode === 'dark';
  const [selectedLine, setSelectedLine] = useState('all');
  const [selectedDir, setSelectedDir] = useState(0);
  const [selectedStop, setSelectedStop] = useState(null);
  const [userPos, setUserPos] = useState(null);
  const [routeCoords, setRouteCoords] = useState([]);
  const [filterAnchor, setFilterAnchor] = useState(null);
  const [auditMode, setAuditMode] = useState(false);
  const [showAllDepartures, setShowAllDepartures] = useState(false);

  useEffect(() => { setShowAllDepartures(false); }, [selectedStop]);

  const stopsWithCoords = useMemo(() => {
    const sourcePriority = { static: 0, route: 1, cache: 2, api: 3 };
    const routePlatforms = getRoutePlatforms(busData);
    const dynamicPlatforms = Object.entries(stopCoords || {})
      .filter(([, value]) => Number.isFinite(Number(value?.lat)) && Number.isFinite(Number(value?.lon)))
      .map(([key, value]) => ({
        id: value.id || null,
        designator: value.designator ?? null,
        name: value.name || key.replace(/\s*\[\d+\]\s*$/, '').trim(),
        lat: Number(value.lat),
        lon: Number(value.lon),
        source: value.source || 'static',
      }));

    const authoritativeNames = new Set(
      [...routePlatforms, ...dynamicPlatforms.filter(stop => stop.source !== 'static')]
        .map(stop => normalizeStopName(stop.name)),
    );
    const merged = new Map();

    [...dynamicPlatforms, ...routePlatforms]
      .sort((left, right) => (sourcePriority[left.source] || 0) - (sourcePriority[right.source] || 0))
      .forEach(platform => {
        if (platform.source === 'static' && authoritativeNames.has(normalizeStopName(platform.name))) return;
        const key = getPlatformKey(platform);
        const current = merged.get(key);
        if (!current || (sourcePriority[platform.source] || 0) >= (sourcePriority[current.source] || 0)) {
          merged.set(key, platform);
        }
      });

    return Array.from(merged.values()).map(platform => ({
      ...platform,
      lng: platform.lon,
      // Keep the Leaflet position reference stable between clock ticks. A new
      // array here makes react-leaflet call marker.setLatLng() every second,
      // which can cancel an active cluster spiderfy animation.
      position: [platform.lat, platform.lon],
    }));
  }, [busData, stopCoords]);

  const suspiciousGroups = useMemo(() => {
    const groups = new Map();
    stopsWithCoords.forEach(stop => {
      const name = normalizeStopName(stop.name);
      if (!groups.has(name)) groups.set(name, []);
      groups.get(name).push(stop);
    });

    const result = [];
    groups.forEach((platforms, name) => {
      if (platforms.length < 2) return;
      const pairs = [];
      let maxDistance = 0;
      for (let first = 0; first < platforms.length; first += 1) {
        for (let second = first + 1; second < platforms.length; second += 1) {
          const distance = distanceMeters(platforms[first], platforms[second]);
          maxDistance = Math.max(maxDistance, distance);
          if (distance >= 100) pairs.push({ first: platforms[first], second: platforms[second], distance });
        }
      }
      if (pairs.length) result.push({ name, platforms, pairs, maxDistance });
    });
    return result.sort((left, right) => right.maxDistance - left.maxDistance);
  }, [stopsWithCoords]);

  const suspiciousPlatformKeys = useMemo(() => new Set(
    suspiciousGroups.flatMap(group => group.platforms.map(getPlatformKey)),
  ), [suspiciousGroups]);

  const mapCenter = useMemo(() => {
    if (!stopsWithCoords.length) return [52.055, 20.445];
    const sum = stopsWithCoords.reduce(
      (total, stop) => ({ lat: total.lat + stop.lat, lng: total.lng + stop.lng }),
      { lat: 0, lng: 0 },
    );
    return [sum.lat / stopsWithCoords.length, sum.lng / stopsWithCoords.length];
  }, [stopsWithCoords]);

  const activeCenter = userPos || mapCenter;
  const line = useMemo(() => {
    if (selectedLine === 'all') return null;
    return busData.lines.find(item => item.id === selectedLine) || null;
  }, [busData.lines, selectedLine]);
  const direction = line?.directions[selectedDir] || line?.directions[0] || null;
  const visibleLineStops = useMemo(() => (
    direction?.stops_full
      ?.filter(stop => stop.lat && stop.lon)
      .map(stop => ({
        stop,
        position: [Number(stop.lat), Number(stop.lon)],
      })) || []
  ), [direction]);
  const destination = useMemo(() => (direction ? formatDestination(direction) : ''), [direction]);
  const visibleBounds = useMemo(() => {
    if (userPos) return null;
    if (direction?.stops_full) {
      return direction.stops_full
        .filter(stop => stop.lat && stop.lon)
        .map(stop => [Number(stop.lat), Number(stop.lon)]);
    }
    return stopsWithCoords.map(stop => [stop.lat, stop.lng]);
  }, [direction, stopsWithCoords, userPos]);

  const viewportKey = useMemo(() => {
    if (userPos) return `user:${userPos[0]}:${userPos[1]}`;
    return `selection:${selectedLine}:${selectedDir}`;
  }, [selectedDir, selectedLine, userPos]);

  useEffect(() => {
    let cancelled = false;
    if (!direction?.stops_full) {
      setRouteCoords([]);
      return undefined;
    }

    async function loadRoute() {
      const points = direction.stops_full
        .filter(stop => stop.lat && stop.lon)
        .map(stop => [stop.lat, stop.lon]);

      if (points.length < 2) {
        setRouteCoords([]);
        return;
      }

      const fullRoute = [];
      for (let index = 0; index < points.length - 1; index += 1) {
        const start = points[index];
        const end = points[index + 1];
        const key = `${start[1].toFixed(5)},${start[0].toFixed(5)};${end[1].toFixed(5)},${end[0].toFixed(5)}`;

        try {
          let segment = osrmCacheRead(key);
          if (!segment) {
            const response = await fetch(`https://router.project-osrm.org/route/v1/driving/${start[1]},${start[0]};${end[1]},${end[0]}?overview=full&geometries=geojson`);
            if (response.ok) {
              const data = await response.json();
              segment = data.routes?.[0]?.geometry?.coordinates?.map(point => [point[1], point[0]]) || null;
              if (segment) osrmCacheWrite(key, segment);
            }
          }

          if (segment?.length) {
            if (fullRoute.length) segment = segment.slice(1);
            fullRoute.push(...segment);
            continue;
          }
        } catch {}

        if (!fullRoute.length) fullRoute.push(start);
        fullRoute.push(end);
      }

      if (!cancelled) setRouteCoords(fullRoute.length ? fullRoute : points);
    }

    loadRoute();
    return () => { cancelled = true; };
  }, [direction]);

  const allDepartures = useMemo(() => {
    if (!selectedStop) return [];
    const all = [];
    findOccurrencesForStop(busData, selectedStop).forEach(occurrence => {
      getScheduleForStop(occurrence.dir, occurrence.stopIdx, state.dayType).forEach(time => {
        all.push({
          time,
          minutes: parseMinutes(time),
          line: occurrence.line,
          direction: occurrence.dir,
        });
      });
    });
    all.sort((a, b) => a.minutes - b.minutes);
    return all;
  }, [busData, selectedStop, state.dayType]);

  const departures = useMemo(() => {
    const upcoming = allDepartures.filter(item => item.minutes >= now.minutes).slice(0, 5);
    return upcoming.length ? upcoming : allDepartures.slice(0, 5);
  }, [allDepartures, now.minutes]);

  const locateUser = () => {
    navigator.geolocation?.getCurrentPosition(position => {
      setUserPos([position.coords.latitude, position.coords.longitude]);
    });
  };

  return (
    <Box sx={{ position: { xs: 'fixed', sm: 'static' }, inset: { xs: 0, sm: 'auto' }, zIndex: { xs: 1150, sm: 'auto' } }}>
      <Box sx={{ mb: { sm: 2, md: 3 }, display: { xs: 'none', sm: 'block' } }}>
        <Typography variant="headlineSmall" sx={{ fontWeight: 750, letterSpacing: '-0.025em' }}>
          Mapa przystanków
        </Typography>
      </Box>

      <Paper
        elevation={0}
        sx={{
          height: { xs: '100%', sm: 'auto' },
          display: 'flex',
          flexDirection: 'column',
          borderRadius: { xs: 0, sm: '28px' },
          border: { xs: 0, sm: 1 },
          borderColor: 'divider',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        <Box
          sx={{
            p: { xs: 0, sm: 2 },
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            flexWrap: 'wrap',
            bgcolor: { xs: 'transparent', sm: 'background.paper' },
            position: { xs: 'absolute', sm: 'static' },
            top: { xs: 'calc(env(safe-area-inset-top, 0px) + 12px)', sm: 'auto' },
            left: { xs: 16, sm: 'auto' },
            right: { xs: 112, sm: 'auto' },
            zIndex: { xs: 1001, sm: 'auto' },
            borderRadius: { xs: 0, sm: 0 },
            border: { xs: 0, sm: 0 },
            borderColor: 'divider',
            boxShadow: 'none',
          }}
        >
          <Box sx={{ width: 38, height: 38, borderRadius: '14px', bgcolor: 'primary.container', color: 'primary.onContainer', display: { xs: 'none', sm: 'grid' }, placeItems: 'center' }}>
            <MapRounded fontSize="small" />
          </Box>

          <Button
            variant="contained"
            color="inherit"
            startIcon={<FilterAltRounded />}
            onClick={(event) => setFilterAnchor(event.currentTarget)}
            sx={{
              minHeight: { xs: 40, sm: 42 },
              height: { xs: 40, sm: 'auto' },
              flex: { xs: '1 1 0', sm: '0 1 auto' },
              minWidth: 0,
              maxWidth: { xs: 'none', sm: 260 },
              borderRadius: { xs: '15px', sm: '18px' },
              border: { xs: 1, sm: 0 },
              borderColor: 'divider',
              bgcolor: auditMode ? 'warning.container' : { xs: 'background.paper', sm: 'background.container' },
              color: auditMode ? 'warning.onContainer' : 'text.primary',
              boxShadow: auditMode ? 'none' : { xs: '0 6px 18px rgba(20, 55, 48, .12)', sm: 'none' },
              justifyContent: 'flex-start',
              '&:hover': { bgcolor: 'background.containerHigh' },
            }}
          >
            <Typography variant="labelLarge" noWrap>
              {auditMode ? `Audyt GPS · ${suspiciousGroups.length}` : line ? `Linia ${line.number}` : 'Filtruj linie'}
            </Typography>
          </Button>

          <Menu
            anchorEl={filterAnchor}
            open={Boolean(filterAnchor)}
            onClose={() => setFilterAnchor(null)}
            slotProps={{ paper: { sx: { mt: 1, width: 310, maxHeight: 430, borderRadius: '22px', p: 0.75 } } }}
          >
            <MenuItem
              selected={auditMode}
              onClick={() => {
                const next = !auditMode;
                setAuditMode(next);
                if (next) {
                  setSelectedLine('all');
                  setSelectedDir(0);
                  setSelectedStop(null);
                }
                setFilterAnchor(null);
              }}
              sx={{ borderRadius: '14px' }}
            >
              <ListItemIcon><TravelExploreRounded color={auditMode ? 'warning' : 'inherit'} fontSize="small" /></ListItemIcon>
              <ListItemText
                primary="Audyt lokalizacji"
                secondary={`${suspiciousGroups.length} grup powyżej 100 m`}
              />
              {auditMode && <CheckRounded color="warning" fontSize="small" />}
            </MenuItem>
            <Divider sx={{ my: 0.75 }} />

            <MenuItem
              selected={selectedLine === 'all'}
              onClick={() => {
                setSelectedLine('all');
                setSelectedDir(0);
                setSelectedStop(null);
                setFilterAnchor(null);
              }}
              sx={{ borderRadius: '14px' }}
            >
              <ListItemIcon><MapRounded fontSize="small" /></ListItemIcon>
              <ListItemText primary="Wszystkie przystanki" />
              {selectedLine === 'all' && <CheckRounded color="primary" fontSize="small" />}
            </MenuItem>
            {busData.lines.map(item => (
              <MenuItem
                key={item.id}
                selected={selectedLine === item.id}
                onClick={() => {
                  setSelectedLine(item.id);
                  setSelectedDir(0);
                  setSelectedStop(null);
                  setAuditMode(false);
                  setFilterAnchor(null);
                }}
                sx={{ borderRadius: '14px', gap: 1 }}
              >
                <ListItemIcon>
                  <Avatar sx={{ width: 28, height: 28, bgcolor: getLineHex(item.color), color: '#fff', fontSize: 11, fontWeight: 800 }}>
                    {item.number}
                  </Avatar>
                </ListItemIcon>
                <ListItemText primary={`Linia ${item.number}`} secondary={item.name} slotProps={{ secondary: { noWrap: true } }} />
                {selectedLine === item.id && <CheckRounded color="primary" fontSize="small" />}
              </MenuItem>
            ))}
          </Menu>

          {line && line.directions.length > 1 && (
            <Button
              variant="contained"
              color="inherit"
              startIcon={<SwapVertRounded />}
              onClick={() => setSelectedDir(previous => (previous + 1) % line.directions.length)}
              aria-label={`Zmień kierunek, obecnie do ${destination}`}
              sx={{
                minHeight: { xs: 40, sm: 42 },
                height: { xs: 40, sm: 'auto' },
                minWidth: 0,
                maxWidth: { xs: '100%', sm: 300 },
                borderRadius: { xs: '15px', sm: '18px' },
                border: { xs: 1, sm: 0 },
                borderColor: 'divider',
                bgcolor: { xs: 'background.paper', sm: 'background.container' },
                color: 'text.primary',
                boxShadow: { xs: '0 6px 18px rgba(20, 55, 48, .12)', sm: 'none' },
                justifyContent: 'flex-start',
                order: { xs: 3, md: 0 },
                width: { xs: '100%', md: 'auto' },
                mt: { xs: 1, sm: 0 },
                px: { xs: 1.5, sm: 2 },
                '&:hover': { bgcolor: 'background.containerHigh' },
              }}
            >
              <Typography variant="labelLarge" noWrap>
                {destination ? `Do ${destination}` : 'Zmień kierunek'}
              </Typography>
            </Button>
          )}

          <IconButton
            aria-label="Pokaż moją lokalizację"
            onClick={locateUser}
            sx={{
              ml: { sm: 'auto' },
              width: { xs: 40, sm: 'auto' },
              height: 40,
              flexShrink: 0,
              bgcolor: { xs: 'background.paper', sm: 'background.container' },
              border: { xs: 1, sm: 0 },
              borderColor: 'divider',
              boxShadow: { xs: '0 6px 18px rgba(20, 55, 48, .12)', sm: 'none' },
            }}
          >
            <MyLocationRounded />
          </IconButton>
        </Box>

        <Box
          sx={{
            flex: { xs: 1, sm: 'none' },
            height: { xs: 'auto', sm: '66dvh', md: '70dvh' },
            minHeight: { xs: 0, sm: 520, md: 560 },
            position: 'relative',
            '& .zpa-map-tiles-dark': {
              filter: 'brightness(.66) invert(1) contrast(1.45) hue-rotate(165deg) saturate(.82) brightness(.74)',
            },
            '& .leaflet-control-zoom a': {
              bgcolor: 'background.paper',
              color: 'text.primary',
              borderColor: 'divider',
            },
            '& .leaflet-control-attribution': {
              bgcolor: darkMap ? 'rgba(25,32,31,.82)' : 'rgba(255,255,255,.82)',
              color: 'text.secondary',
            },
            '& .leaflet-control-attribution a': { color: 'primary.main' },
            '& .leaflet-bottom': {
              bottom: { xs: 'calc(80px + env(safe-area-inset-bottom, 0px))', sm: 0 },
            },
            '& .leaflet-tooltip': {
              bgcolor: 'background.paper',
              color: 'text.primary',
              borderColor: 'divider',
              boxShadow: '0 6px 18px rgba(0,0,0,.16)',
            },
          }}
        >
          <MapContainer
            center={mapCenter}
            zoom={13}
            zoomControl={false}
            style={{ height: '100%', width: '100%', background: darkMap ? '#111A18' : '#DCE9E4' }}
          >
            <MapController
              center={activeCenter}
              zoom={userPos ? 15 : 13}
              bounds={visibleBounds}
              viewKey={viewportKey}
            />
            <ZoomControl position="bottomright" />
            <TileLayer
              key={`tiles-${theme.palette.mode}`}
              attribution="© OpenStreetMap"
              className={darkMap ? 'zpa-map-tiles-dark' : ''}
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            {userPos && <Marker position={userPos}><Tooltip>Twoja lokalizacja</Tooltip></Marker>}

            {auditMode && suspiciousGroups.flatMap(group => group.pairs).map((pair, index) => (
              <Polyline
                key={`audit-${getPlatformKey(pair.first)}-${getPlatformKey(pair.second)}-${index}`}
                positions={[[pair.first.lat, pair.first.lng], [pair.second.lat, pair.second.lng]]}
                pathOptions={{ color: '#E76F51', weight: 3, opacity: 0.85, dashArray: '7 7' }}
                interactive={false}
              />
            ))}

            {!line && (
              <MarkerClusterGroup
                key={auditMode ? 'audit-clusters' : 'standard-clusters'}
                chunkedLoading
                showCoverageOnHover={false}
                spiderfyOnMaxZoom
                disableClusteringAtZoom={auditMode ? 0 : 14}
                maxClusterRadius={38}
                iconCreateFunction={clusterMarkerIcon}
              >
                {stopsWithCoords.map((stop, index) => (
                  <Marker
                    key={getPlatformKey(stop) || `${stop.lat}-${stop.lng}-${index}`}
                    position={stop.position}
                    icon={auditMode && suspiciousPlatformKeys.has(getPlatformKey(stop)) ? auditStopMarkerIcon : stopMarkerIcon}
                    eventHandlers={{ click: () => setSelectedStop(stop) }}
                  >
                    <Tooltip direction="top" offset={[0, -8]}>
                      {stop.name}{stop.designator ? ` · stanowisko ${stop.designator}` : ''}
                      {auditMode && suspiciousPlatformKeys.has(getPlatformKey(stop)) ? ' · do kontroli' : ''}
                    </Tooltip>
                  </Marker>
                ))}
              </MarkerClusterGroup>
            )}

            {line && visibleLineStops.map(({ stop, position }, index) => (
              <Marker
                key={`${stop.id || stop.official_name}-${index}`}
                position={position}
                icon={lineMarker(line, index)}
                eventHandlers={{ click: () => setSelectedStop({
                  id: stop.id || null,
                  designator: stop.designator ?? null,
                  name: stop.name || stop.official_name,
                  lat: Number(stop.lat),
                  lon: Number(stop.lon),
                  lng: Number(stop.lon),
                  source: 'route',
                }) }}
              >
                <Tooltip direction="top" offset={[0, -14]}>
                  {stop.name || stop.official_name}{stop.designator ? ` · stanowisko ${stop.designator}` : ''}
                </Tooltip>
              </Marker>
            ))}

            {routeCoords.length > 1 && (
              <Polyline positions={routeCoords} pathOptions={{ color: getLineHex(line?.color), weight: 5, opacity: 0.85 }} />
            )}
          </MapContainer>

          {auditMode && (
            <Paper
              elevation={0}
              sx={{
                position: 'absolute',
                zIndex: 1000,
                top: { xs: 'calc(env(safe-area-inset-top, 0px) + 112px)', sm: 12 },
                left: 12,
                maxWidth: { xs: 'calc(100% - 24px)', sm: 330 },
                px: 1.5,
                py: 1,
                borderRadius: '16px',
                bgcolor: 'warning.container',
                color: 'warning.onContainer',
                border: 1,
                borderColor: 'warning.main',
              }}
            >
              <Typography variant="labelLarge" sx={{ fontWeight: 800 }}>Audyt lokalizacji</Typography>
              <Typography variant="bodySmall">
                Pomarańczowe punkty: {suspiciousGroups.length} nazw ze stanowiskami oddalonymi o ponad 100 m.
              </Typography>
            </Paper>
          )}

          {selectedStop && (
            <Paper
              elevation={0}
              sx={{
                position: 'absolute',
                zIndex: 1000,
                left: { xs: 10, sm: 18 },
                right: { xs: 10, sm: 'auto' },
                bottom: { xs: 'calc(82px + env(safe-area-inset-bottom, 0px))', sm: 18 },
                width: { sm: 430 },
                maxHeight: '46%',
                overflowY: 'auto',
                borderRadius: '24px',
                border: 1,
                borderColor: 'divider',
                boxShadow: '0 16px 40px rgba(20, 55, 48, .2)',
              }}
            >
              <Box sx={{ px: 2.25, pt: 2, pb: 1.25, display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography variant="bodySmall" color="text.secondary">
                    Najbliższe odjazdy{selectedStop.designator ? ` · stanowisko ${selectedStop.designator}` : ''}
                  </Typography>
                  <Typography variant="titleMedium" sx={{ fontWeight: 750, mt: 0.25 }}>{selectedStop.name}</Typography>
                  {auditMode && (
                    <Typography variant="bodySmall" color="text.secondary" sx={{ mt: 0.5 }}>
                      GPS: {selectedStop.source === 'api' ? 'API KiedyPrzyjedzie' : selectedStop.source === 'route' ? 'dane trasy (fallback)' : 'plik offline'} · {selectedStop.lat.toFixed(6)}, {(selectedStop.lng ?? selectedStop.lon).toFixed(6)}
                    </Typography>
                  )}
                </Box>
                <IconButton size="small" aria-label="Zamknij panel" onClick={() => setSelectedStop(null)}>
                  <CloseRounded fontSize="small" />
                </IconButton>
              </Box>

              {departures.length ? (
                <Stack sx={{ px: 1.25, pb: 1.25 }}>
                  {(showAllDepartures ? allDepartures : departures).map((departure, index) => {
                    const minutes = Math.max(0, Math.floor(departure.minutes - now.minutes));
                    const past = departure.minutes < now.minutes;
                    return (
                      <Box
                        key={`${departure.line.id}-${departure.time}-${index}`}
                        sx={{ display: 'grid', gridTemplateColumns: '34px 52px minmax(0, 1fr) auto', alignItems: 'center', gap: 1, px: 1, py: 0.9, borderRadius: '14px', opacity: past && showAllDepartures ? 0.42 : 1, '&:hover': { bgcolor: 'action.hover' } }}
                      >
                        <Avatar sx={{ width: 32, height: 32, bgcolor: getLineHex(departure.line.color), fontSize: 11, fontWeight: 800 }}>
                          {departure.line.number}
                        </Avatar>
                        <Typography variant="bodyMedium" sx={{ fontFamily: 'Roboto Mono', fontWeight: 750 }}>{departure.time}</Typography>
                        <Typography variant="bodySmall" color="text.secondary" noWrap>Do {formatDestination(departure.direction)}</Typography>
                        <Typography variant="labelMedium" color="primary.main" sx={{ fontWeight: 750, whiteSpace: 'nowrap' }}>
                          {past && showAllDepartures ? '' : minutes < 1 ? 'teraz' : `${minutes} min`}
                        </Typography>
                      </Box>
                    );
                  })}
                </Stack>
              ) : (
                <Typography variant="bodyMedium" color="text.secondary" sx={{ px: 2.25, pb: 2.25 }}>
                  Brak kursów dla wybranego dnia.
                </Typography>
              )}

              {(allDepartures.length > departures.length || showAllDepartures) && departures.length > 0 && (
                <Button
                  size="small"
                  color="inherit"
                  startIcon={showAllDepartures ? <ExpandLessRounded /> : <ExpandMoreRounded />}
                  onClick={() => setShowAllDepartures(value => !value)}
                  sx={{ mx: 1.25, mb: 1.25, minHeight: 36, alignSelf: 'flex-start' }}
                >
                  {showAllDepartures ? 'Zwiń listę' : `Zobacz więcej (${allDepartures.length})`}
                </Button>
              )}
            </Paper>
          )}
        </Box>
      </Paper>
    </Box>
  );
}
