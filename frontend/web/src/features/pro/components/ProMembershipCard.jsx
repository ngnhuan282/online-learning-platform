import { Link } from 'react-router-dom';
import { WorkspacePremiumOutlined } from '@mui/icons-material';
import usePro from '../hooks/usePro';
import { t } from '../../../shared/i18n/locale';
import useLocale from '../../../shared/i18n/useLocale';
import { formatDate } from '../../../shared/utils/formatDate';
import { ROUTES } from '../../../shared/constants/routes';
import '../styles/pro.css';

export default function ProMembershipCard() {
  useLocale();
  const { membership, loading, error, refresh } = usePro();
  return (
    <article className={`pro-membership-card ${membership?.active ? 'is-pro' : ''}`}>
      <WorkspacePremiumOutlined />
      <div>
        <strong>
          {t(
            membership?.active
              ? 'ChitChatGo Pro đang hoạt động'
              : membership?.expiresAt
                ? 'Pro đã hết hạn'
                : membership
                  ? 'Gói miễn phí'
                  : 'Trạng thái thành viên',
          )}
        </strong>
        <p>
          {error
            ? t('Chưa tải được trạng thái Pro.')
            : loading
              ? t('Đang tải...')
              : membership?.expiresAt
                ? t('Hạn Pro: {date}', {
                    date: formatDate(membership.expiresAt, {
                      year: 'numeric',
                      month: '2-digit',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    }),
                  })
                : t('Khám phá các gói Pro để mở rộng quyền học.')}
        </p>
      </div>
      {error ? (
        <button className="text-button" onClick={refresh}>
          {t('Thử lại')}
        </button>
      ) : (
        <Link to={ROUTES.PRO}>{t(membership?.active ? 'Quản lý Pro' : 'Xem gói Pro')}</Link>
      )}
    </article>
  );
}
