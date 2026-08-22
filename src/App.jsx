import React, { useState, useEffect, useMemo } from 'react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { Box, Container, CircularProgress, Typography, Snackbar, Alert, Fab, useMediaQuery } from '@mui/material';
import { Refresh as RefreshIcon } from '@mui/icons-material';
import getTheme from './theme.js';
import { useTimetables } from './hooks/useTimetables.js';
import { loadState, saveState, getFavorites, saveFavorites, getRecents, addRecent } from './utils/storage.js';
import { parseMinutes, getScheduleForStop, formatNow } from './utils/time.js';
import TopAppBar from './components/TopAppBar.jsx';
import BottomNav from './components/BottomNav.jsx';
import LinesView from './components/LinesView.jsx';
import StopsView from './components/StopsView.jsx';
import RouteView from './components/RouteView.jsx';
import MapView from './components/MapView.jsx';

function App() {
  const { busData, stopCoords, status, meta, newData, setNewData } = useTimetables();
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('zpa_theme');
    if (saved) return saved === 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });
  const [view, setView] = useState('lines'); // lines | stops | route | map
  const [state, setState] = useState(() => {
    const saved = loadState();
    const defaultDay = new Date().getDay() === 0 ? 'sunday' : new Date().getDay() === 6 ? 'saturday' : 'weekday';
    return saved || { lineId: '1', dirIdx: 0, stopIdx: 0, dayType: defaultDay };
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [favorites, setFavorites] = useState(() => getFavorites());
  const [recents, setRecents] = useState(() => getRecents());
  const [now, setNow] = useState(() => formatNow());
  const [toast, setToast] = useState({ open: false, message: '', severity: 'info' });
  const [installPrompt, setInstallPrompt] = useState(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);

  const isMobile = useMediaQuery('(max-width:900px)');

  const theme = useMemo(() => getTheme(darkMode ? 'dark' : 'light'), [darkMode]);

  // Clock
  useEffect(() => {
    const id = setInterval(() => setNow(formatNow()), 1000);
    return () => clearInterval(id);
  }, []);

  // Save state
  useEffect(() => {
    saveState(state);
  }, [state]);

  // Save theme
  useEffect(() => {
    localStorage.setItem('zpa_theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  // PWA install prompt
  useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      setInstallPrompt(e);
      const dismissed = localStorage.getItem('zpa_install_dismissed');
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
      if (!dismissed && !isStandalone) setShowInstallBanner(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    console.log('Install outcome', outcome);
    setInstallPrompt(null);
    setShowInstallBanner(false);
  };

  const dismissInstall = () => {
    setShowInstallBanner(false);
    localStorage.setItem('zpa_install_dismissed', '1');
  };

  const toggleFavorite = (stopName, lines) => {
    const idx = favorites.findIndex(f => f.stop === stopName);
    let newFavs;
    if (idx >= 0) {
      newFavs = [...favorites];
      newFavs.splice(idx, 1);
      setToast({ open: true, message: 'Usunięto z ulubionych', severity: 'info' });
    } else {
      newFavs = [...favorites, { stop: stopName, lines, added: new Date().toISOString() }];
      setToast({ open: true, message: 'Dodano do ulubionych ❤️', severity: 'success' });
    }
    setFavorites(newFavs);
    saveFavorites(newFavs);
    return idx < 0;
  };

  const handleSelectStop = (lineId, dirIdx, stopIdx) => {
    setState(prev => ({ ...prev, lineId, dirIdx, stopIdx }));
    if (busData) {
      const line = busData.lines.find(l => l.id === lineId);
      if (line) {
        const dir = line.directions[dirIdx];
        const stop = dir?.stops[stopIdx];
        if (stop) {
          const newRecents = addRecent(line, dirIdx, stopIdx, stop);
          setRecents(newRecents);
        }
      }
    }
  };

  const handleRefresh = () => {
    localStorage.removeItem('zpa_data');
    window.location.reload();
  };

  const currentLine = useMemo(() => {
    if (!busData) return null;
    return busData.lines.find(l => l.id === state.lineId) || busData.lines[0];
  }, [busData, state.lineId]);

  const currentDir = useMemo(() => {
    if (!currentLine) return null;
    return currentLine.directions[state.dirIdx] || currentLine.directions[0];
  }, [currentLine, state.dirIdx]);

  const allStops = useMemo(() => {
    if (!busData) return [];
    const stops = [];
    busData.lines.forEach(line => {
      line.directions.forEach((dir, dirIdx) => {
        dir.stops.forEach((stop, stopIdx) => {
          stops.push({ lineId: line.id, lineNumber: line.number, lineName: line.name, lineColor: line.color, dirIdx, dirLabel: dir.short, stop, stopIdx });
        });
      });
    });
    return stops;
  }, [busData]);

  const filteredStops = useMemo(() => {
    if (!searchQuery || searchQuery.length < 2) return [];
    const q = searchQuery.toLowerCase();
    return allStops.filter(s => s.stop.toLowerCase().includes(q)).slice(0, 8);
  }, [allStops, searchQuery]);

  if (!busData) {
    return (
      <ThemeProvider theme={theme}>
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', gap: 2, p: 3 }}>
          <CircularProgress size={48} />
          <Typography variant="titleMedium" sx={{ fontWeight: 600 }}>Pobieram aktualny rozkład...</Typography>
          <Typography variant="bodySmall" color="text.secondary">Status: {status} • {meta?.version || 'ładowanie'}</Typography>
        </Box>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider theme={theme}>
      <Box sx={{ bgcolor: 'background.default', minHeight: '100vh', pb: isMobile ? '80px' : 0 }}>
        <TopAppBar
          status={status}
          meta={meta}
          now={now}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          filteredStops={filteredStops}
          onSelectStop={handleSelectStop}
          darkMode={darkMode}
          setDarkMode={setDarkMode}
          onRefresh={handleRefresh}
          onSelectView={setView}
          currentView={view}
        />

        {newData && (
          <Alert
            severity="success"
            sx={{ borderRadius: 0, justifyContent: 'center' }}
            onClose={() => setNewData(false)}
            action={<></>}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box sx={{ width: 8, height: 8, bgcolor: 'white', borderRadius: '50%', animation: 'pulse 1.5s infinite' }} />
              <strong>Nowy rozkład!</strong> Wykryto zmianę na stronie ZPA/PKS. Dane zostały zaktualizowane.
            </Box>
          </Alert>
        )}

        {showInstallBanner && (
          <Alert
            severity="info"
            sx={{ borderRadius: 0, bgcolor: 'primary.main', color: 'white', '.MuiAlert-icon': { color: 'white' } }}
            onClose={dismissInstall}
            action={
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Box component="button" onClick={handleInstall} sx={{ bgcolor: 'white', color: 'primary.main', border: 'none', borderRadius: '20px', px: 2, py: 0.5, fontWeight: 700, cursor: 'pointer' }}>Zainstaluj</Box>
              </Box>
            }
          >
            <strong>Zainstaluj ŻPA Żyrardów</strong> – działa offline, szybki dostęp z pulpitu, PWA
          </Alert>
        )}

        <Container maxWidth="xl" sx={{ py: 2, px: { xs: 1, md: 2 } }}>
          {view === 'lines' && (
            <LinesView
              busData={busData}
              stopCoords={stopCoords}
              state={state}
              setState={setState}
              currentLine={currentLine}
              currentDir={currentDir}
              now={now}
              favorites={favorites}
              recents={recents}
              toggleFavorite={toggleFavorite}
              onSelectStop={handleSelectStop}
              setToast={setToast}
            />
          )}
          {view === 'stops' && (
            <StopsView
              busData={busData}
              state={state}
              setState={setState}
              now={now}
            />
          )}
          {view === 'route' && (
            <RouteView
              busData={busData}
              state={state}
              setState={setState}
              now={now}
            />
          )}
          {view === 'map' && (
            <MapView
              busData={busData}
              stopCoords={stopCoords}
              state={state}
              setState={setState}
              now={now}
            />
          )}
        </Container>

        <BottomNav view={view} setView={setView} />

        <Snackbar
          open={toast.open}
          autoHideDuration={3000}
          onClose={() => setToast(prev => ({ ...prev, open: false }))}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
          sx={{ mb: isMobile ? '80px' : 0 }}
        >
          <Alert onClose={() => setToast(prev => ({ ...prev, open: false }))} severity={toast.severity} sx={{ borderRadius: '24px', boxShadow: 3 }}>
            {toast.message}
          </Alert>
        </Snackbar>

        {isMobile && view === 'lines' && (
          <Fab
            color="primary"
            sx={{ position: 'fixed', bottom: 90, right: 16, borderRadius: '16px' }}
            onClick={handleRefresh}
          >
            <RefreshIcon />
          </Fab>
        )}
      </Box>
    </ThemeProvider>
  );
}

export default App;
