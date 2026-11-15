import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { AuthProvider } from '../features/auth/context/AuthContext';
import { ToastProvider } from '../shared/context/ToastContext';
import theme from '../styles/theme';
import { NotificationsProvider } from '../features/learning/context/NotificationsContext';
import { EngagementProvider } from '../features/engagement/context/EngagementContext';
export default function AppProviders({ children }) {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthProvider>
        <NotificationsProvider>
          <EngagementProvider>
            <ToastProvider>{children}</ToastProvider>
          </EngagementProvider>
        </NotificationsProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
