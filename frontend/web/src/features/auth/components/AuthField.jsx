import { t } from '../../../shared/i18n/locale';
import useLocale from '../../../shared/i18n/useLocale';
import { useState } from 'react';
import VisibilityOutlined from '@mui/icons-material/VisibilityOutlined';
import VisibilityOffOutlined from '@mui/icons-material/VisibilityOffOutlined';

export default function AuthField({ name, label, icon, type = 'text', error, hint, ...inputProps }) {
  useLocale();
  const [visible, setVisible] = useState(false);
  const password = type === 'password';
  const describedBy =
    [hint && `${name}-hint`, error && `${name}-error`].filter(Boolean).join(' ') || undefined;
  return (
    <div className={`auth-field ${error ? 'has-error' : ''}`}>
      <label htmlFor={name}>{t(label)}</label>
      <div className="auth-input-wrap">
        <span className="auth-input-icon" aria-hidden="true">
          {icon}
        </span>
        <input
          id={name}
          name={name}
          type={password && visible ? 'text' : type}
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy}
          {...inputProps}
        />
        {password && (
          <button
            type="button"
            className="auth-password-toggle"
            aria-label={`${visible ? t('Ẩn') : t('Hiện')} ${label.toLowerCase()}`}
            aria-pressed={visible}
            onClick={() => setVisible(!visible)}
          >
            {visible ? <VisibilityOffOutlined /> : <VisibilityOutlined />}
          </button>
        )}
      </div>
      {hint && (
        <p className="auth-field-hint" id={`${name}-hint`}>
          {t(hint)}
        </p>
      )}
      {error && (
        <p className="auth-field-error" id={`${name}-error`}>
          {t(error)}
        </p>
      )}
    </div>
  );
}
