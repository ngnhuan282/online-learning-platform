import { t } from '../shared/i18n/locale';
import useLocale from '../shared/i18n/useLocale';
import { Link } from 'react-router-dom';
import { Alert } from '@mui/material';
import Icon from '../shared/components/Icon';
import { ROUTES } from '../shared/constants/routes';

export default function ForbiddenPage() {
  useLocale();
  return (
    <section className="status-screen container">
      <div className="status-screen-card">
        <span className="eyebrow-pill status-pill-warn">403 · ACCESS RESTRICTED</span>
        <h1>{t('Không có quyền truy cập')}</h1>
        <Alert severity="warning" role="alert" sx={{ textAlign: 'left', width: '100%' }}>
          {t('Bạn không có quyền truy cập chức năng này. Nếu vừa được cấp quyền, hãy đăng nhập lại.')}
        </Alert>
        <div className="status-screen-actions">
          <Link className="button button-primary" to={ROUTES.HOME}>
            {t('Về trang chủ')}
            <Icon name="arrow" size={17} />
          </Link>
        </div>
      </div>
    </section>
  );
}
