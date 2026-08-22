import React, { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { ThemeProvider } from '@mui/material/styles';
import {
  Alert,
  Box,
  CircularProgress,
  Container,
  CssBaseline,
  Skeleton,
  Snackbar,
  Stack,
  Typography,
} from '@mui/material';
import getTheme from './theme.js';
import { useTimetables } from './hooks/useTimetables.js';
import { loadState, saveState, getFavorites, saveFavorites, addRecent } from './utils/storage.js';
import { formatNow } from './utils/time.js';
import TopAppBar from './components/TopAppBar.jsx';
import BottomNav from './components/BottomNav.jsx';
import RouteView from './components/RouteView.jsx';
import LinesView from './components/LinesView.jsx';

const MapView = lazy(() => import('./components/MapView.jsx'));

function LazyFallback() {
  return (
    <Stack spacing={1.5} sx={{ maxWidth: 1100, mx: 'auto' }}>
      <Skeleton variant="rounded" height={70} sx={{ borderRadius: '24px' }} />
      <Skeleton variant="rounded" height={480} sx={{ borderRadius: '28px' }} />
    </Stack>
  );
}

function App() {
  const { busData, stopCoords, status, meta, newData } = useTimetables();
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('zpa_theme');
    if (saved) return saved === 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });
  const [view, setView] = useState('route');
  const [state, setState] = useState(() => {
    const saved = loadState();
    const day = new Date().getDay();
    const defaultDay = day === 0 ? 'sunday' : day === 6 ? 'saturday' : 'weekday';
    return saved || { lineId: '1', dirIdx: 0, stopIdx: 0, dayType: defaultDay };
  });
  const [favorites, setFavorites] = useState(() => getFavorites());
  const [now, setNow] = useState(() => formatNow());
  const [toast, setToast] = useState({ open: false, message: '', severity: 'info' });
  const [installPrompt, setInstallPrompt] = useState(null);
  const [pwaUpdate, setPwaUpdate] = useState(false);

  const theme = useMemo(() => getTheme(darkMode ? 'dark' : 'light'), [darkMode]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(formatNow()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => { saveState(state); }, [state]);
  useEffect(() => { localStorage.setItem('zpa_theme', darkMode ? 'dark' : 'light'); }, [darkMode]);

  useEffect(() => {
    const handleInstallPrompt = (event) => {
      event.preventDefault();
      setInstallPrompt(event);
    };
    window.addEventListener('beforeinstallprompt', handleInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleInstallPrompt);
  }, []);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return undefined;
    const handleUpdate = () => setPwaUpdate(true);
    navigator.serviceWorker.addEventListener('controllerchange', handleUpdate);
    window.addEventListener('pwa-update-available', handleUpdate);
    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', handleUpdate);
      window.removeEventListener('pwa-update-available', handleUpdate);
    };
  }, []);

  const handleInstall = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(null);
  };

  const handleRefresh = () => {
    localStorage.removeItem('zpa_data');
    window.location.reload();
  };

  const toggleFavorite = (stopName, lines) => {
    const existingIndex = favorites.findIndex(favorite => favorite.stop === stopName);
    let nextFavorites;

    if (existingIndex >= 0) {
      nextFavorites = favorites.filter((_, index) => index !== existingIndex);
      setToast({ open: true, message: 'Usunięto z ulubionych', severity: 'info' });
    } else {
      nextFavorites = [...favorites, { stop: stopName, lines, added: new Date().toISOString() }];
      setToast({ open: true, message: 'Przystanek zapisany w ulubionych', severity: 'success' });
    }

    setFavorites(nextFavorites);
    saveFavorites(nextFavorites);
    return existingIndex < 0;
  };

  const handleSelectStop = (lineId, dirIdx, stopIdx) => {
    setState(previous => ({ ...previous, lineId, dirIdx, stopIdx }));
    if (!busData) return;

    const line = busData.lines.find(item => item.id === lineId);
    const stop = line?.directions[dirIdx]?.stops[stopIdx];
    if (line && stop) addRecent(line, dirIdx, stopIdx, stop);
  };

  const currentLine = useMemo(() => {
    if (!busData) return null;
    return busData.lines.find(line => line.id === state.lineId) || busData.lines[0];
  }, [busData, state.lineId]);

  const currentDir = useMemo(() => {
    if (!currentLine) return null;
    return currentLine.directions[state.dirIdx] || currentLine.directions[0];
  }, [currentLine, state.dirIdx]);

  if (!busData) {
    return (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Box sx={{ minHeight: '100dvh', bgcolor: 'primary.main', color: 'primary.contrastText', display: 'grid', placeItems: 'center', p: 3 }}>
          <Box sx={{ textAlign: 'center' }}>
            <Box sx={{ width: 72, height: 72, mx: 'auto', borderRadius: '24px', bgcolor: 'rgba(255,255,255,.14)', display: 'grid', placeItems: 'center', mb: 2.5 }}>
              <CircularProgress size={34} sx={{ color: 'white' }} />
            </Box>
            <Typography variant="titleLarge" sx={{ fontWeight: 750 }}>Pobieramy rozkład</Typography>
            <Typography variant="bodyMedium" sx={{ opacity: 0.72, mt: 0.75 }}>To potrwa tylko chwilę.</Typography>
          </Box>
        </Box>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ bgcolor: 'background.default', minHeight: '100dvh', pb: { xs: '92px', md: 4 } }}>
        <TopAppBar
          status={status}
          meta={meta}
          darkMode={darkMode}
          setDarkMode={setDarkMode}
          onRefresh={handleRefresh}
          canInstall={Boolean(installPrompt)}
          onInstall={handleInstall}
          dataChanged={newData}
          appUpdate={pwaUpdate}
          onApplyUpdate={() => window.location.reload()}
        />

        <BottomNav view={view} setView={setView} />

        <Container maxWidth="xl" component="main" sx={{ pt: { xs: 2.5, md: 1 }, px: { xs: 1.5, sm: 2.5, lg: 3 } }}>
          {view === 'route' && (
            <RouteView busData={busData} state={state} setState={setState} now={now} />
          )}

          {view === 'lines' && (
            <LinesView
              busData={busData}
              state={state}
              setState={setState}
              currentLine={currentLine}
              currentDir={currentDir}
              now={now}
              favorites={favorites}
              toggleFavorite={toggleFavorite}
              onSelectStop={handleSelectStop}
            />
          )}

          <Suspense fallback={<LazyFallback />}>
            {view === 'map' && (
              <MapView busData={busData} stopCoords={stopCoords} state={state} now={now} />
            )}
          </Suspense>
        </Container>

        <Snackbar
          open={toast.open}
          autoHideDuration={2800}
          onClose={() => setToast(previous => ({ ...previous, open: false }))}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
          sx={{ mb: { xs: '76px', md: 0 } }}
        >
          <Alert
            onClose={() => setToast(previous => ({ ...previous, open: false }))}
            severity={toast.severity}
            variant="filled"
            sx={{ borderRadius: '18px' }}
          >
            {toast.message}
          </Alert>
        </Snackbar>
      </Box>
    </ThemeProvider>
  );
}

export default App;
