import React, { useState } from 'react';
import {
  Box,
  Typography,
  IconButton,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Divider,
  Badge,
  Slide,
  useMediaQuery,
  useScrollTrigger,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import {
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

const floatingActionSx = {
  width: 40,
  height: 40,
  color: 'text.primary',
  bgcolor: 'background.paper',
  border: 1,
  borderColor: 'divider',
  boxShadow: '0 6px 18px rgba(20, 55, 48, .12)',
  '&:hover': { bgcolor: 'background.paper' },
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
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const scrolledDown = useScrollTrigger();
  const hideControls = isMobile && scrolledDown;

  const generatedAt = meta?.generatedAt
    ? new Date(meta.generatedAt).toLocaleDateString('pl-PL', { day: 'numeric', month: 'short', year: 'numeric' })
    : null;

  return (
    <Slide appear={false} direction="down" in={!hideControls}>
      <Box
        component="header"
        sx={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 1200,
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'flex-end',
          gap: 1.5,
          px: { xs: 2, md: 3 },
          pt: 'calc(env(safe-area-inset-top, 0px) + 12px)',
          pointerEvents: 'none',
        }}
      >
      <Box sx={{ display: 'flex', gap: 1, pointerEvents: 'auto' }}>
        <IconButton
          aria-label={darkMode ? 'Włącz jasny motyw' : 'Włącz ciemny motyw'}
          onClick={() => setDarkMode(!darkMode)}
          sx={floatingActionSx}
        >
          {darkMode ? <LightModeRounded /> : <DarkModeRounded />}
        </IconButton>

        <IconButton
          aria-label="Ustawienia i informacje"
          aria-controls={open ? 'app-menu' : undefined}
          aria-haspopup="true"
          aria-expanded={open ? 'true' : undefined}
          onClick={(event) => setAnchorEl(event.currentTarget)}
          sx={floatingActionSx}
        >
          <Badge color="warning" variant="dot" invisible={!dataChanged && !appUpdate}>
            <MoreVertRounded />
          </Badge>
        </IconButton>
      </Box>

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
      </Box>
    </Slide>
  );
}
