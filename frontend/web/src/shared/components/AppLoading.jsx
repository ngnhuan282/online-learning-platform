import { t } from '../i18n/locale';
import useLocale from '../i18n/useLocale';
import { CircularProgress, Stack, Typography } from '@mui/material';
export default function AppLoading({ label = 'Đang tải…' }) {
  useLocale();
  return (
    <Stack role="status" aria-live="polite" spacing={2} sx={{ p: 4, alignItems: 'center' }}>
      <CircularProgress aria-label={label} />
      <Typography>{t(label)}</Typography>
    </Stack>
  );
}
