import useLocale from '../i18n/useLocale';
import { setLocale, t } from '../i18n/locale';
import { KeyboardArrowDownRounded } from '@mui/icons-material';
import './HeaderProgress.css';

export default function LanguageSwitcher() {
  const locale = useLocale();
  return (
    <span className="language-picker">
      {locale === 'vi' ? (
        <svg className="language-flag" viewBox="0 0 30 20" aria-hidden="true">
          <path fill="#da251d" d="M0 0h30v20H0z" />
          <path fill="#ffdf00" d="m15 3 1.8 5.3h5.6l-4.5 3.3 1.7 5.3-4.6-3.3-4.6 3.3 1.7-5.3-4.5-3.3h5.6z" />
        </svg>
      ) : (
        <svg className="language-flag" viewBox="0 0 30 20" aria-hidden="true">
          <path fill="#253773" d="M0 0h30v20H0z" />
          <path stroke="#fff" strokeWidth="5" d="m0 0 30 20M30 0 0 20" />
          <path stroke="#d93846" strokeWidth="2" d="m0 0 30 20M30 0 0 20" />
          <path stroke="#fff" strokeWidth="7" d="M15 0v20M0 10h30" />
          <path stroke="#d93846" strokeWidth="4" d="M15 0v20M0 10h30" />
        </svg>
      )}
      <select
        className="language-switcher"
        aria-label={t('Ngôn ngữ')}
        value={locale}
        onChange={event => setLocale(event.target.value)}
      >
        <option value="vi">Tiếng Việt</option>
        <option value="en">English</option>
      </select>
      <KeyboardArrowDownRounded />
    </span>
  );
}
