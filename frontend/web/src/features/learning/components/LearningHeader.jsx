import { t } from '../../../shared/i18n/locale';
import useLocale from '../../../shared/i18n/useLocale';
import '../styles/workspace.css';

export default function LearningHeader({ title, description, children }) {
  useLocale();
  return (
    <header className="learning-page-header">
      <div>
        <h1>{t(title)}</h1>
        {description && <p className="learning-page-description">{t(description)}</p>}
      </div>
      {children && <div className="learning-header-actions">{children}</div>}
    </header>
  );
}
