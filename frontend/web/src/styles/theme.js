import { createTheme } from '@mui/material/styles';

const heading = {
  fontFamily: '"Plus Jakarta Sans", Inter, sans-serif',
  fontWeight: 700,
  letterSpacing: '-0.02em',
};

export default createTheme({
  palette: {
    primary: { main: '#0f70e6', dark: '#0b5ec4', light: '#ecf5ff' },
    secondary: { main: '#12a861' },
    success: { main: '#12a861' },
    warning: { main: '#e8830c' },
    error: { main: '#dc2626' },
    text: { primary: '#132238', secondary: '#55667d' },
    background: { default: '#ffffff', paper: '#ffffff' },
    divider: '#dce5f0',
  },
  typography: {
    fontFamily: 'Inter, Arial, sans-serif',
    h1: heading,
    h2: heading,
    h3: heading,
    h4: heading,
    h5: heading,
    h6: heading,
    button: {
      fontFamily: '"Plus Jakarta Sans", Inter, sans-serif',
      textTransform: 'none',
      fontWeight: 700,
    },
  },
  shape: { borderRadius: 12 },
  components: {
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: 20,
          border: '1.5px solid #dce5f0',
          boxShadow: '0 24px 48px rgba(19, 34, 56, 0.14)',
        },
      },
    },
  },
});
