import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { AuthProvider } from '../features/auth/context/AuthContext';
import { ToastProvider } from '../shared/context/ToastContext';
import theme from '../styles/theme';
import { NotificationsProvider } from '../features/learning/context/NotificationsContext';
export default function AppProviders({ children }) {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthProvider>
        <NotificationsProvider>
          <ToastProvider>{children}</ToastProvider>
        </NotificationsProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
