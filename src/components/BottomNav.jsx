import React from 'react';
import { BottomNavigation, BottomNavigationAction, Paper, Box } from '@mui/material';
import { Route, Place, AltRoute, Map } from '@mui/icons-material';

export default function BottomNav({ view, setView }) {
  return (
    <Paper
      elevation={3}
      sx={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 1100,
        borderRadius: '24px 24px 0 0',
        overflow: 'hidden',
        display: { xs: 'block', lg: 'none' },
      }}
    >
      <BottomNavigation
        value={view}
        onChange={(_, newValue) => setView(newValue)}
        showLabels
        sx={{ height: 80, bgcolor: 'background.container' }}
      >
        <BottomNavigationAction label="Linie" value="lines" icon={<Route />} />
        <BottomNavigationAction label="Przystanki" value="stops" icon={<Place />} />
        <BottomNavigationAction label="Od → Do" value="route" icon={<AltRoute />} />
        <BottomNavigationAction label="Mapa" value="map" icon={<Map />} />
      </BottomNavigation>
    </Paper>
  );
}
