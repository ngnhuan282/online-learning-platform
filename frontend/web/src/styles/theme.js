import { createTheme } from '@mui/material/styles';
const heading = { fontFamily: '"Plus Jakarta Sans", Inter, sans-serif', fontWeight: 700 };
export default createTheme({
  palette: {
    primary: { main: '#2563eb' },
    secondary: { main: '#0ea5e9' },
    success: { main: '#16a34a' },
    warning: { main: '#f59e0b' },
    error: { main: '#dc2626' },
    text: { primary: '#0f172a', secondary: '#64748b' },
    background: { default: '#ffffff', paper: '#ffffff' },
    divider: '#e2e8f0',
  },
  typography: {
    fontFamily: 'Inter, Arial, sans-serif',
    h1: heading,
    h2: heading,
    h3: heading,
    h4: heading,
    h5: heading,
    h6: heading,
    button: { textTransform: 'none', fontWeight: 600 },
  },
  shape: { borderRadius: 8 },
});
