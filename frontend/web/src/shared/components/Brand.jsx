import { t } from '../i18n/locale';
import useLocale from '../i18n/useLocale';
import { Link } from 'react-router-dom';
import CatMascot from './CatMascot';
import './Brand.css';

export default function Brand({ to = '/', label = 'ChitChatGo — Trang chủ' }) {
  useLocale();
  return (
    <Link to={to} className="brand" aria-label={t(label)}>
      <span className="brand-icon brand-icon-mascot">
        <CatMascot variant="icon" />
      </span>
      <span className="brand-wordmark">
        <span>
          ChitChat<span className="brand-accent">Go</span>
        </span>
        <small>ENGLISH ACADEMY</small>
      </span>
    </Link>
  );
}
