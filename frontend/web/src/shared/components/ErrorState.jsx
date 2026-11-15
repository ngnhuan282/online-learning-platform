import { t } from '../i18n/locale';
import useLocale from '../i18n/useLocale';
import { Alert, AlertTitle, Button } from '@mui/material';
import { getErrorMessage } from '../utils/errorUtils';
export default function ErrorState({ error, title = 'Không thể tải dữ liệu', onRetry }) {
  useLocale();
  return (
    <Alert
      severity="error"
      action={
        onRetry && (
          <Button color="inherit" onClick={onRetry}>
            {t('Thử lại')}
          </Button>
        )
      }
    >
      <AlertTitle>{t(title)}</AlertTitle>
      {t(getErrorMessage(error))}
    </Alert>
  );
}
