import { createTheme } from '@mui/material/styles';

// Material 3 inspired theme with ŻPA brand green as primary
// Residents-focused: high contrast, large touch targets

const getTheme = (mode = 'light') => createTheme({
  palette: {
    mode,
    primary: {
      main: '#006A60', // ŻPA teal green - Material 3 primary
      light: '#4CDAD0',
      dark: '#004A44',
      contrastText: '#FFFFFF',
      container: '#9EF2E4',
      onContainer: '#00201D',
    },
    secondary: {
      main: '#4A635F',
      light: '#A6CEC9',
      dark: '#354B48',
      contrastText: '#FFFFFF',
      container: '#CCE8E3',
      onContainer: '#051F1D',
    },
    tertiary: {
      main: '#456179',
      container: '#CCE5FF',
      onContainer: '#001E31',
    },
    error: {
      main: '#BA1A1A',
      container: '#FFDAD6',
      onContainer: '#410002',
    },
    success: {
      main: '#006A60',
      container: '#9EF2E4',
      onContainer: '#00201D',
    },
    warning: {
      main: '#7A5900',
      container: '#FFDF9D',
      onContainer: '#261A00',
    },
    info: {
      main: '#006496',
      container: '#CCE5FF',
      onContainer: '#001E31',
    },
    background: {
      default: mode === 'light' ? '#FAFDFB' : '#0E1415',
      paper: mode === 'light' ? '#FFFFFF' : '#1A2121',
      container: mode === 'light' ? '#EDEEE8' : '#1E2524',
      containerHigh: mode === 'light' ? '#E6E9E7' : '#282F2E',
      containerHighest: mode === 'light' ? '#E0E3E1' : '#333B39',
    },
    surface: {
      main: mode === 'light' ? '#FAFDFB' : '#0E1415',
      variant: mode === 'light' ? '#DAE5E2' : '#3F4947',
    },
    outline: {
      main: mode === 'light' ? '#6F7977' : '#899390',
      variant: mode === 'light' ? '#BEC9C6' : '#404C4A',
    },
    // Custom line colors mapped to MUI
    lines: {
      0: '#0d9488',
      1: '#059669',
      2: '#0284c7',
      3: '#7c3aed',
      4: '#2563eb',
      5: '#ea580c',
      7: '#10b981',
      8: '#0ea5e9',
      9: '#e11d48',
      10: '#d97706',
    }
  },
  typography: {
    fontFamily: '"Roboto", "Inter", system-ui, sans-serif',
    fontSize: 14,
    h1: { fontWeight: 700, letterSpacing: '-0.02em' },
    h2: { fontWeight: 600, letterSpacing: '-0.01em' },
    h5: { fontWeight: 700 },
    button: { textTransform: 'none', fontWeight: 500, letterSpacing: 0.1 },
    // Material 3 custom variants
    displayLarge: { fontSize: '57px', lineHeight: '64px', fontWeight: 400 },
    headlineSmall: { fontSize: '24px', lineHeight: '32px', fontWeight: 400 },
    titleLarge: { fontSize: '22px', lineHeight: '28px', fontWeight: 400 },
    titleMedium: { fontSize: '16px', lineHeight: '24px', fontWeight: 500, letterSpacing: 0.15 },
    titleSmall: { fontSize: '14px', lineHeight: '20px', fontWeight: 500, letterSpacing: 0.1 },
    bodyLarge: { fontSize: '16px', lineHeight: '24px', fontWeight: 400 },
    bodyMedium: { fontSize: '14px', lineHeight: '20px', fontWeight: 400 },
    bodySmall: { fontSize: '12px', lineHeight: '16px', fontWeight: 400 },
    labelLarge: { fontSize: '14px', fontWeight: 500, letterSpacing: 0.1, lineHeight: '20px' },
    labelMedium: { fontSize: '12px', fontWeight: 500, letterSpacing: 0.5, lineHeight: '16px' },
    labelSmall: { fontSize: '11px', fontWeight: 500, letterSpacing: 0.5, lineHeight: '16px' },
  },
  shape: {
    borderRadius: 16,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: '20px',
          padding: '10px 24px',
          minHeight: '40px',
          fontWeight: 500,
        },
        contained: {
          boxShadow: 'none',
          '&:hover': { boxShadow: '0 1px 2px rgba(0,0,0,0.3), 0 1px 3px 1px rgba(0,0,0,0.15)' },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: '24px',
          boxShadow: '0 1px 2px rgba(0,0,0,0.08), 0 1px 3px 1px rgba(0,0,0,0.08)',
          border: '1px solid transparent',
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: '8px',
          fontWeight: 500,
          height: '32px',
        },
        filled: {
          backgroundColor: mode === 'light' ? '#E6E9E7' : '#333B39',
        },
      },
    },
    MuiBottomNavigation: {
      styleOverrides: {
        root: {
          borderRadius: '0px',
          height: '80px',
          backgroundColor: mode === 'light' ? '#E6E9E7' : '#282F2E',
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: mode === 'light' ? '#FAFDFB' : '#0E1415',
          color: mode === 'light' ? '#191C1C' : '#E0E3E1',
          boxShadow: 'none',
          borderBottom: `1px solid ${mode === 'light' ? '#E0E3E1' : '#333B39'}`,
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        rounded: {
          borderRadius: '24px',
        },
      },
    },
  },
});

export default getTheme;
