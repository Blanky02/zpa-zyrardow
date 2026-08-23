import React, { useState } from 'react';
import {
  AppBar,
  Toolbar,
  Box,
  Typography,
  IconButton,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Divider,
  Badge,
} from '@mui/material';
import {
  DirectionsBusRounded,
  DarkModeRounded,
  LightModeRounded,
  MoreVertRounded,
  RefreshRounded,
  DownloadRounded,
  SystemUpdateAltRounded,
  CheckCircleRounded,
  CloudOffRounded,
  InfoOutlined,
} from '@mui/icons-material';

const statusLabels = {
  live: 'Dane aktualne',
  offline: 'Tryb offline',
  loading: 'Aktualizowanie danych',
  fallback: 'Dane zapasowe',
};

export default function TopAppBar({
  status,
  meta,
  darkMode,
  setDarkMode,
  onRefresh,
  canInstall,
  onInstall,
  dataChanged,
  appUpdate,
  onApplyUpdate,
}) {
  const [anchorEl, setAnchorEl] = useState(null);
  const open = Boolean(anchorEl);
  const closeMenu = () => setAnchorEl(null);

  const generatedAt = meta?.generatedAt
    ? new Date(meta.generatedAt).toLocaleDateString('pl-PL', { day: 'numeric', month: 'short', year: 'numeric' })
    : null;

  return (
    <AppBar
      position="sticky"
      elevation={0}
      sx={{
        bgcolor: 'primary.main',
        color: 'primary.contrastText',
        border: 0,
        top: 0,
        zIndex: 1200,
        pt: 'env(safe-area-inset-top)',
      }}
    >
      <Toolbar sx={{ minHeight: { xs: 68, md: 76 }, px: { xs: 2, md: 3 }, gap: 1.5 }}>
        <Box
          sx={{
            width: { xs: 40, md: 44 },
            height: { xs: 40, md: 44 },
            borderRadius: '15px',
            bgcolor: 'rgba(255,255,255,.16)',
            display: 'grid',
            placeItems: 'center',
            flexShrink: 0,
          }}
        >
          <DirectionsBusRounded />
        </Box>

        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography
            variant="titleMedium"
            sx={{ fontWeight: 750, lineHeight: 1.15, letterSpacing: '-0.02em' }}
          >
            ŻPA Żyrardów
          </Typography>
          <Typography variant="bodySmall" sx={{ opacity: 0.76, mt: 0.25 }}>
            Rozkład jazdy
          </Typography>
        </Box>

        <IconButton
          aria-label={darkMode ? 'Włącz jasny motyw' : 'Włącz ciemny motyw'}
          onClick={() => setDarkMode(!darkMode)}
          sx={{ color: 'inherit', bgcolor: 'rgba(255,255,255,.12)', '&:hover': { bgcolor: 'rgba(255,255,255,.2)' } }}
        >
          {darkMode ? <LightModeRounded /> : <DarkModeRounded />}
        </IconButton>

        <IconButton
          aria-label="Ustawienia i informacje"
          aria-controls={open ? 'app-menu' : undefined}
          aria-haspopup="true"
          aria-expanded={open ? 'true' : undefined}
          onClick={(event) => setAnchorEl(event.currentTarget)}
          sx={{ color: 'inherit' }}
        >
          <Badge color="warning" variant="dot" invisible={!dataChanged && !appUpdate}>
            <MoreVertRounded />
          </Badge>
        </IconButton>

        <Menu
          id="app-menu"
          anchorEl={anchorEl}
          open={open}
          onClose={closeMenu}
          transformOrigin={{ horizontal: 'right', vertical: 'top' }}
          anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
          slotProps={{ paper: { sx: { mt: 1, width: 292, borderRadius: '24px', p: 1 } } }}
        >
          <Box sx={{ px: 1.5, py: 1 }}>
            <Typography variant="labelLarge" sx={{ fontWeight: 700 }}>Informacje o rozkładzie</Typography>
            <Typography variant="bodySmall" color="text.secondary" sx={{ mt: 0.35 }}>
              {generatedAt ? `Dane z ${generatedAt}` : 'Dane rozkładowe ŻPA'}
            </Typography>
          </Box>

          <MenuItem disabled sx={{ opacity: '1 !important', borderRadius: '14px' }}>
            <ListItemIcon>
              {status === 'offline' || status === 'fallback'
                ? <CloudOffRounded color="warning" fontSize="small" />
                : <CheckCircleRounded color="success" fontSize="small" />}
            </ListItemIcon>
            <ListItemText
              primary={statusLabels[status] || 'Status danych'}
              secondary={meta?.version || undefined}
              primaryTypographyProps={{ variant: 'bodyMedium', fontWeight: 650 }}
              secondaryTypographyProps={{ variant: 'bodySmall', noWrap: true }}
            />
          </MenuItem>

          {dataChanged && (
            <MenuItem disabled sx={{ opacity: '1 !important', borderRadius: '14px' }}>
              <ListItemIcon><InfoOutlined color="primary" fontSize="small" /></ListItemIcon>
              <ListItemText primary="Rozkład został zaktualizowany" primaryTypographyProps={{ variant: 'bodyMedium' }} />
            </MenuItem>
          )}

          <Divider sx={{ my: 1 }} />

          {appUpdate && (
            <MenuItem onClick={() => { closeMenu(); onApplyUpdate(); }} sx={{ borderRadius: '14px' }}>
              <ListItemIcon><SystemUpdateAltRounded fontSize="small" /></ListItemIcon>
              <ListItemText primary="Zainstaluj nową wersję" />
            </MenuItem>
          )}

          {canInstall && (
            <MenuItem onClick={() => { closeMenu(); onInstall(); }} sx={{ borderRadius: '14px' }}>
              <ListItemIcon><DownloadRounded fontSize="small" /></ListItemIcon>
              <ListItemText primary="Dodaj aplikację do telefonu" />
            </MenuItem>
          )}

          <MenuItem onClick={() => { closeMenu(); onRefresh(); }} sx={{ borderRadius: '14px' }}>
            <ListItemIcon><RefreshRounded fontSize="small" /></ListItemIcon>
            <ListItemText primary="Odśwież dane" />
          </MenuItem>
        </Menu>
      </Toolbar>
    </AppBar>
  );
}
