import { t } from '../i18n/locale';
import useLocale from '../i18n/useLocale';
import { Stack, Typography } from '@mui/material';
export default function PageHeader({ title, description, action }) {
  useLocale();
  return (
    <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={2} sx={{ mb: 3 }}>
      <div>
        <Typography component="h1" variant="h4">
          {t(title)}
        </Typography>
        {description && (
          <Typography color="text.secondary" sx={{ mt: 1 }}>
            {t(description)}
          </Typography>
        )}
      </div>
      {action}
    </Stack>
  );
}
