import { createTheme } from '@mui/material/styles';

const getTheme = (mode = 'light') => {
  const light = mode === 'light';

  return createTheme({
    palette: {
      mode,
      primary: {
        main: '#2A9D6F',
        light: '#61C99A',
        dark: '#176D4D',
        contrastText: '#FFFFFF',
        container: light ? '#B7F1E7' : '#183F31',
        onContainer: light ? '#00201C' : '#C8F4DC',
      },
      secondary: {
        main: light ? '#4B635F' : '#B1CCC6',
        contrastText: light ? '#FFFFFF' : '#1D3531',
        container: light ? '#CDE8E2' : '#334B47',
        onContainer: light ? '#06201C' : '#CDE8E2',
      },
      error: {
        main: light ? '#BA1A1A' : '#FFB4AB',
        container: light ? '#FFDAD6' : '#93000A',
        onContainer: light ? '#410002' : '#FFDAD6',
      },
      success: {
        main: light ? '#006B5F' : '#74D8C9',
        container: light ? '#B7F1E7' : '#174F48',
        onContainer: light ? '#00201C' : '#D4FFF7',
      },
      warning: {
        main: light ? '#765A00' : '#F0C03D',
        container: light ? '#FFE08A' : '#594400',
        onContainer: light ? '#241A00' : '#FFE08A',
      },
      background: {
        default: light ? '#F4F7F4' : '#0F1514',
        paper: light ? '#FFFFFF' : '#19201F',
        container: light ? '#E9EFEC' : '#222A28',
        containerHigh: light ? '#E1E9E5' : '#2B3432',
        containerHighest: light ? '#D9E2DE' : '#35403D',
      },
      divider: light ? '#DCE5E1' : '#34413E',
      text: {
        primary: light ? '#17201E' : '#E2EAE7',
        secondary: light ? '#586460' : '#B5C0BC',
      },
      outline: {
        main: light ? '#6F7976' : '#89938F',
        variant: light ? '#BEC9C5' : '#404946',
      },
      lines: {
        0: '#0D9488',
        1: '#059669',
        2: '#0284C7',
        3: '#7C3AED',
        4: '#2563EB',
        5: '#EA580C',
        7: '#10B981',
        8: '#0EA5E9',
        9: '#E11D48',
        10: '#D97706',
      },
    },
    typography: {
      fontFamily: '"Roboto", system-ui, -apple-system, sans-serif',
      fontSize: 14,
      h1: { fontWeight: 750, letterSpacing: '-0.035em' },
      h2: { fontWeight: 750, letterSpacing: '-0.03em' },
      h3: { fontWeight: 750, letterSpacing: '-0.025em' },
      button: { textTransform: 'none', fontWeight: 650, letterSpacing: 0 },
      displayLarge: { fontSize: '52px', lineHeight: 1.08, fontWeight: 750, letterSpacing: '-0.04em' },
      headlineSmall: { fontSize: '26px', lineHeight: '34px', fontWeight: 700 },
      titleLarge: { fontSize: '22px', lineHeight: '29px', fontWeight: 650 },
      titleMedium: { fontSize: '16px', lineHeight: '23px', fontWeight: 600, letterSpacing: 0 },
      titleSmall: { fontSize: '14px', lineHeight: '20px', fontWeight: 600, letterSpacing: 0 },
      bodyLarge: { fontSize: '16px', lineHeight: '24px', fontWeight: 400 },
      bodyMedium: { fontSize: '14px', lineHeight: '21px', fontWeight: 400 },
      bodySmall: { fontSize: '12px', lineHeight: '18px', fontWeight: 400 },
      labelLarge: { fontSize: '14px', lineHeight: '20px', fontWeight: 600, letterSpacing: 0 },
      labelMedium: { fontSize: '12px', lineHeight: '17px', fontWeight: 600, letterSpacing: 0.1 },
      labelSmall: { fontSize: '11px', lineHeight: '16px', fontWeight: 600, letterSpacing: 0.15 },
    },
    shape: { borderRadius: 24 },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            minWidth: 320,
            backgroundColor: light ? '#F4F7F4' : '#0F1514',
          },
          '*': { boxSizing: 'border-box' },
          '*:focus-visible': {
            outline: `3px solid ${light ? 'rgba(0,107,95,.28)' : 'rgba(116,216,201,.35)'}`,
            outlineOffset: 2,
          },
          '@keyframes pulse': {
            '0%, 100%': { opacity: 1 },
            '50%': { opacity: 0.45 },
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: { backgroundImage: 'none' },
          rounded: { borderRadius: 24 },
        },
      },
      MuiCard: {
        defaultProps: { elevation: 0 },
        styleOverrides: {
          root: {
            borderRadius: 24,
            backgroundImage: 'none',
            border: `1px solid ${light ? '#DCE5E1' : '#34413E'}`,
          },
        },
      },
      MuiButton: {
        styleOverrides: {
          root: {
            minHeight: 44,
            borderRadius: 18,
            paddingInline: 20,
            boxShadow: 'none',
          },
          contained: {
            boxShadow: 'none',
            '&:hover': { boxShadow: 'none' },
          },
        },
      },
      MuiIconButton: {
        styleOverrides: {
          root: { borderRadius: 15 },
        },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            borderRadius: 18,
            backgroundColor: light ? '#F7FAF8' : '#202826',
            '& .MuiOutlinedInput-notchedOutline': { borderColor: light ? '#CAD5D1' : '#46514E' },
            '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: light ? '#7A8984' : '#92A09B' },
            '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderWidth: 2 },
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: { borderRadius: 12, fontWeight: 650 },
        },
      },
      MuiListItemButton: {
        styleOverrides: {
          root: { borderRadius: 16 },
        },
      },
      MuiMenu: {
        styleOverrides: {
          paper: {
            border: `1px solid ${light ? '#DCE5E1' : '#34413E'}`,
            boxShadow: '0 18px 48px rgba(20, 55, 48, .16)',
          },
        },
      },
      MuiAutocomplete: {
        styleOverrides: {
          paper: {
            border: `1px solid ${light ? '#DCE5E1' : '#34413E'}`,
            boxShadow: '0 16px 36px rgba(20, 55, 48, .15)',
          },
        },
      },
      MuiBottomNavigation: {
        styleOverrides: {
          root: { backgroundColor: light ? '#FFFFFF' : '#19201F' },
        },
      },
      MuiAppBar: {
        styleOverrides: {
          root: { backgroundImage: 'none' },
        },
      },
      MuiToggleButton: {
        styleOverrides: {
          root: {
            borderRadius: '14px !important',
            textTransform: 'none',
          },
        },
      },
    },
  });
};

export default getTheme;
