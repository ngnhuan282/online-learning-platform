import { t } from '../shared/i18n/locale';
import useLocale from '../shared/i18n/useLocale';
import { Link } from 'react-router-dom';
import { Alert, Button, Stack } from '@mui/material';
import { ROUTES } from '../shared/constants/routes';

export default function ForbiddenPage() {
  useLocale();
  return (
    <Stack spacing={2} sx={{ maxWidth: 600, mx: 'auto', my: 6, px: 2 }}>
      <Alert severity="warning" role="alert">
        {t('Bạn không có quyền truy cập chức năng này. Nếu vừa được cấp quyền, hãy đăng nhập lại.')}
      </Alert>
      <Button component={Link} to={ROUTES.HOME} variant="outlined">
        {t('Về trang chủ')}
      </Button>
    </Stack>
  );
}
