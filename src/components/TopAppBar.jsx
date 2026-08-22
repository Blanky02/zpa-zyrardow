import React, { useState } from 'react';
import { AppBar, Toolbar, Box, Typography, IconButton, InputBase, Paper, Chip, Badge, Button, Stack, Avatar } from '@mui/material';
import { Search as SearchIcon, DarkMode, LightMode, Refresh, Share, FavoriteBorder, Schedule } from '@mui/icons-material';
import { getLineHex } from '../utils/stops.js';

export default function TopAppBar({ status, meta, now, searchQuery, setSearchQuery, filteredStops, onSelectStop, darkMode, setDarkMode, onRefresh, onSelectView, currentView }) {
  const [focused, setFocused] = useState(false);

  const statusColor = status === 'live' ? 'success' : status === 'offline' ? 'warning' : 'default';
  const statusText = status === 'live' ? 'Live' : status === 'offline' ? 'Offline cache' : status === 'loading' ? 'Ładowanie...' : 'Demo';

  return (
    <AppBar position="sticky" elevation={0} sx={{ backdropFilter: 'blur(16px)', bgcolor: 'background.paper', borderBottom: 1, borderColor: 'divider' }}>
      <Toolbar sx={{ height: 64, px: { xs: 1, md: 2 }, gap: 2, justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0 }}>
          <Avatar sx={{ bgcolor: 'primary.main', width: 40, height: 40, fontWeight: 700, fontSize: 18 }}>Ż</Avatar>
          <Box sx={{ minWidth: 0, display: { xs: 'none', sm: 'block' } }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="titleMedium" sx={{ fontWeight: 700, lineHeight: 1, letterSpacing: '-0.02em' }}>ŻPA ŻYRARDÓW</Typography>
              <Chip label="v3 MUI" size="small" color="primary" sx={{ height: 20, fontSize: 10, fontWeight: 700 }} />
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
              <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: status === 'live' ? 'success.main' : status === 'offline' ? 'warning.main' : 'grey.400', animation: status === 'live' ? 'pulse 1.5s infinite' : 'none' }} />
              <Typography variant="labelSmall" color="text.secondary" sx={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 }}>{statusText} • {meta?.version || 'v3'}</Typography>
            </Box>
          </Box>
          <Box sx={{ display: { xs: 'flex', sm: 'none' }, flexDirection: 'column', minWidth: 0 }}>
            <Typography variant="labelLarge" sx={{ fontWeight: 700, lineHeight: 1 }}>ŻPA</Typography>
            <Typography variant="labelSmall" color="text.secondary" sx={{ fontSize: 10 }}>{statusText}</Typography>
          </Box>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1, justifyContent: 'flex-end', maxWidth: 600 }}>
          <Paper
            elevation={focused ? 2 : 0}
            sx={{
              display: { xs: 'none', md: 'flex' },
              alignItems: 'center',
              flex: 1,
              maxWidth: 360,
              height: 48,
              borderRadius: '28px',
              bgcolor: 'background.container',
              px: 2,
              gap: 1,
              border: 1,
              borderColor: focused ? 'primary.main' : 'transparent',
              transition: 'all 0.2s',
            }}
          >
            <SearchIcon color="action" />
            <InputBase
              placeholder="Szukaj przystanku, np. PKP, Zalew..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => setTimeout(() => setFocused(false), 200)}
              sx={{ flex: 1, fontSize: 14 }}
            />
            {searchQuery && (
              <IconButton size="small" onClick={() => setSearchQuery('')}>✕</IconButton>
            )}
          </Paper>

          <Box sx={{ display: { xs: 'none', md: 'flex' }, alignItems: 'center', gap: 1, bgcolor: 'background.container', borderRadius: '24px', px: 1.5, py: 0.5, height: 40 }}>
            <Schedule fontSize="small" />
            <Typography variant="labelLarge" sx={{ fontFamily: 'Roboto Mono', fontWeight: 600 }}>{now.h}:{now.m}:{now.s}</Typography>
            <Chip label={now.day} size="small" sx={{ height: 20, fontSize: 10, fontWeight: 700, bgcolor: 'background.containerHighest' }} />
          </Box>

          <IconButton onClick={() => setDarkMode(!darkMode)} sx={{ bgcolor: 'background.container', width: 40, height: 40 }}>
            {darkMode ? <LightMode /> : <DarkMode />}
          </IconButton>

          <Button onClick={onRefresh} variant="contained" disableElevation sx={{ display: { xs: 'none', md: 'flex' }, borderRadius: '20px', bgcolor: 'background.container', color: 'text.primary', '&:hover': { bgcolor: 'background.containerHigh' } }} startIcon={<Refresh />}>
            Odśwież
          </Button>
        </Box>
      </Toolbar>

      {/* Mobile search */}
      <Box sx={{ display: { xs: 'flex', md: 'none' }, px: 2, pb: 1.5 }}>
        <Paper sx={{ display: 'flex', alignItems: 'center', flex: 1, height: 48, borderRadius: '24px', bgcolor: 'background.container', px: 2, gap: 1 }}>
          <SearchIcon color="action" />
          <InputBase placeholder="Szukaj przystanku..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} sx={{ flex: 1, fontSize: 15 }} />
        </Paper>
      </Box>

      {/* Search results dropdown */}
      {filteredStops.length > 0 && (
        <Paper elevation={3} sx={{ position: 'absolute', top: { xs: 110, md: 64 }, left: { xs: 16, md: 'auto' }, right: { xs: 16, md: 80 }, maxWidth: 400, borderRadius: '16px', overflow: 'hidden', zIndex: 1200, maxHeight: 400, overflowY: 'auto' }}>
          {filteredStops.map((m, idx) => (
            <Box
              key={idx}
              onClick={() => { onSelectStop(m.lineId, m.dirIdx, m.stopIdx); setSearchQuery(''); onSelectView('lines'); }}
              sx={{ display: 'flex', alignItems: 'center', gap: 1.5, p: 1.5, cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' }, borderBottom: 1, borderColor: 'divider' }}
            >
              <Avatar sx={{ bgcolor: getLineHex(m.lineColor), width: 36, height: 36, fontSize: 14, fontWeight: 700 }}>{m.lineNumber}</Avatar>
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Typography variant="bodyMedium" sx={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.stop}</Typography>
                <Typography variant="bodySmall" color="text.secondary">{m.lineName} • {m.dirLabel}</Typography>
              </Box>
            </Box>
          ))}
        </Paper>
      )}
    </AppBar>
  );
}
