import { t } from '../shared/i18n/locale';
import useLocale from '../shared/i18n/useLocale';
import { Link } from 'react-router-dom';
import { ROUTES } from '../shared/constants/routes';

export default function NotFoundPage() {
  useLocale();
  return (
    <section className="container section">
      <h1>{t('Không tìm thấy trang')}</h1>
      <p>{t('Đường dẫn không tồn tại hoặc nội dung đã được chuyển đi.')}</p>
      <Link className="button button-primary" to={ROUTES.HOME}>
        {t('Về trang chủ')}
      </Link>
    </section>
  );
}
