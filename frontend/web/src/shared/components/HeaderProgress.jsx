import { Link } from 'react-router-dom';
import { DiamondRounded, LocalFireDepartmentRounded } from '@mui/icons-material';
import useEngagement from '../../features/engagement/hooks/useEngagement';
import { t, getIntlLocale } from '../i18n/locale';
import useLocale from '../i18n/useLocale';
import { ROUTES } from '../constants/routes';
import './HeaderProgress.css';

export default function HeaderProgress() {
  useLocale();
  const { summary, error } = useEngagement();
  return (
    <div className="header-progress">
      <Link
        className="header-gems"
        to={`${ROUTES.SHOP}?tab=topup`}
        aria-label={summary ? t('Nạp Gem: {gems} kim cương', { gems: summary.gems }) : t('Nạp Gem')}
        title={t('Nạp Gem')}
      >
        <DiamondRounded />
        <span>{summary ? summary.gems.toLocaleString(getIntlLocale()) : '—'}</span>
      </Link>
      <Link
        className={`header-streak ${summary?.activeToday ? 'is-active' : ''}`}
        to={ROUTES.ACHIEVEMENTS}
        aria-label={
          summary ? t('Chuỗi học: {days} ngày', { days: summary.currentStreak }) : t('Chuỗi ngày học')
        }
        title={error ? t('Không thể tải dữ liệu') : t('Chuỗi ngày học')}
      >
        <LocalFireDepartmentRounded />
        <span>{summary?.currentStreak ?? '—'}</span>
      </Link>
    </div>
  );
}
