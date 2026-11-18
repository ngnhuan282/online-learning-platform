import { t } from '../shared/i18n/locale';
import useLocale from '../shared/i18n/useLocale';
import { Link } from 'react-router-dom';
import CatMascot from '../shared/components/CatMascot';
import Icon from '../shared/components/Icon';
import { ROUTES } from '../shared/constants/routes';

export default function NotFoundPage() {
  useLocale();
  return (
    <section className="status-screen container">
      <div className="status-screen-card">
        <div className="status-screen-mascot" aria-hidden="true">
          <CatMascot variant="icon" />
        </div>
        <span className="eyebrow-pill">404 · PAGE NOT FOUND</span>
        <h1>{t('Không tìm thấy trang')}</h1>
        <p>{t('Đường dẫn không tồn tại hoặc nội dung đã được chuyển đi.')}</p>
        <div className="status-screen-actions">
          <Link className="button button-primary" to={ROUTES.HOME}>
            {t('Về trang chủ')}
            <Icon name="arrow" size={17} />
          </Link>
          <Link className="button button-outline" to={ROUTES.COURSES}>
            {t('Khóa học')}
          </Link>
        </div>
      </div>
    </section>
  );
}
