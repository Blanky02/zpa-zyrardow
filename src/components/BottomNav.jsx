import React from 'react';
import { BottomNavigation, BottomNavigationAction, Paper, Box } from '@mui/material';
import { AltRouteRounded, DirectionsBusRounded, MapRounded } from '@mui/icons-material';

const actions = [
  { value: 'route', label: 'Od → Do', icon: <AltRouteRounded /> },
  { value: 'lines', label: 'Linie', icon: <DirectionsBusRounded /> },
  { value: 'map', label: 'Mapa', icon: <MapRounded /> },
];

function Navigation({ view, setView, desktop = false }) {
  return (
    <BottomNavigation
      value={view}
      onChange={(_, nextView) => setView(nextView)}
      showLabels
      sx={{
        width: desktop ? 430 : '100%',
        height: desktop ? 58 : 70,
        bgcolor: desktop ? 'transparent' : 'background.paper',
        px: desktop ? 0.75 : 1,
        '& .MuiBottomNavigationAction-root': {
          minWidth: 0,
          maxWidth: 'none',
          borderRadius: desktop ? '18px' : '16px',
          mx: 0.25,
          color: 'text.secondary',
        },
        '& .Mui-selected': {
          color: 'primary.main',
          bgcolor: 'primary.container',
        },
        '& .MuiBottomNavigationAction-label': {
          fontWeight: 650,
          fontSize: 12,
          mt: 0.25,
        },
      }}
    >
      {actions.map(action => (
        <BottomNavigationAction key={action.value} {...action} />
      ))}
    </BottomNavigation>
  );
}

export default function BottomNav({ view, setView }) {
  return (
    <>
      <Box
        sx={{
          display: { xs: 'none', md: 'flex' },
          position: 'sticky',
          top: 84,
          zIndex: 1100,
          justifyContent: 'center',
          py: 1.5,
          pointerEvents: 'none',
        }}
      >
        <Paper
          elevation={0}
          sx={{
            p: 0.5,
            borderRadius: '22px',
            border: 1,
            borderColor: 'divider',
            bgcolor: 'background.paper',
            boxShadow: '0 8px 30px rgba(20, 55, 48, .08)',
            pointerEvents: 'auto',
          }}
        >
          <Navigation view={view} setView={setView} desktop />
        </Paper>
      </Box>

      <Paper
        component="nav"
        aria-label="Główna nawigacja"
        elevation={0}
        sx={{
          display: { xs: 'block', md: 'none' },
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 1300,
          borderRadius: 0,
          borderTop: 1,
          borderColor: 'divider',
          pb: 'env(safe-area-inset-bottom)',
          bgcolor: 'background.paper',
        }}
      >
        <Navigation view={view} setView={setView} />
      </Paper>
    </>
  );
}
