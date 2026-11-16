import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { AuthProvider } from '../features/auth/context/AuthContext';
import { ToastProvider } from '../shared/context/ToastContext';
import theme from '../styles/theme';
import { NotificationsProvider } from '../features/learning/context/NotificationsContext';
import { EngagementProvider } from '../features/engagement/context/EngagementContext';
import { ProProvider } from '../features/pro/context/ProContext';
export default function AppProviders({ children }) {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthProvider>
        <NotificationsProvider>
          <EngagementProvider>
            <ProProvider>
              <ToastProvider>{children}</ToastProvider>
            </ProProvider>
          </EngagementProvider>
        </NotificationsProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
