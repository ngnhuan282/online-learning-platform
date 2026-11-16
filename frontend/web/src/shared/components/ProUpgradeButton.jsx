import { Link } from 'react-router-dom';
import { t } from '../i18n/locale';
import useLocale from '../i18n/useLocale';
import { ROUTES } from '../constants/routes';
import usePro from '../../features/pro/hooks/usePro';

export default function ProUpgradeButton() {
  useLocale();
  const { membership } = usePro();
  const label = membership?.active ? 'Pro của bạn' : 'Mở khóa PRO';
  return (
    <Link
      className={`header-pro-button ${membership?.active ? 'is-pro-member' : ''}`}
      to={ROUTES.PRO}
      aria-label={t(label)}
    >
      {!membership?.active && <span className="pro-new-dot" aria-hidden="true" />}
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="m3 7 3 11h12l3-11-5 4-4-7-4 7-5-4ZM6 21h12" />
      </svg>
      <span>{t(label)}</span>
    </Link>
  );
}
