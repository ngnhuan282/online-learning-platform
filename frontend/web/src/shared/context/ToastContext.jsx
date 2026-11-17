import { createContext, useCallback, useEffect, useRef, useState } from 'react';
import CheckCircleOutline from '@mui/icons-material/CheckCircleOutlineOutlined';
import ErrorOutline from '@mui/icons-material/ErrorOutlineOutlined';
import Close from '@mui/icons-material/Close';
import { IconButton } from '@mui/material';
import { t } from '../i18n/locale';
import useLocale from '../i18n/useLocale';
import { ADMIN_FEEDBACK_EVENT } from '../utils/adminFeedback';
import './toast.css';

// Context is exported for useToast, alongside its provider.
// eslint-disable-next-line react-refresh/only-export-components
export const ToastContext = createContext(null);

function ToastNotice({ notice, onClose }) {
  useEffect(() => {
    const timer = setTimeout(() => onClose(notice.id), notice.duration);
    return () => clearTimeout(timer);
  }, [notice.id, notice.duration, onClose]);
  const failed = notice.severity === 'error';
  return (
    <div className={`app-toast app-toast--${notice.severity}`} role={failed ? 'alert' : 'status'}>
      <span className="app-toast-icon">{failed ? <ErrorOutline /> : <CheckCircleOutline />}</span>
      <div className="app-toast-content">
        <strong>{t(failed ? 'Thất bại' : 'Thành công')}</strong>
        <p>{t(notice.message)}</p>
      </div>
      <IconButton size="small" aria-label={t('Đóng thông báo')} onClick={() => onClose(notice.id)}>
        <Close fontSize="small" />
      </IconButton>
      <span className="app-toast-countdown" style={{ animationDuration: `${notice.duration}ms` }} />
    </div>
  );
}

export function ToastProvider({ children }) {
  useLocale();
  const [notices, setNotices] = useState([]);
  const sequence = useRef(0);
  const showToast = useCallback((message, options = {}) => {
    if (!message) return;
    const settings = typeof options === 'string' ? { severity: options } : options;
    const notice = {
      id: ++sequence.current,
      message,
      severity: settings.severity === 'error' ? 'error' : 'success',
      duration: settings.duration || 5000,
    };
    setNotices(previous => [...previous.slice(-2), notice]);
  }, []);
  const closeToast = useCallback(id => setNotices(previous => previous.filter(item => item.id !== id)), []);
  useEffect(() => {
    const receive = event => showToast(event.detail?.message, event.detail);
    window.addEventListener(ADMIN_FEEDBACK_EVENT, receive);
    return () => window.removeEventListener(ADMIN_FEEDBACK_EVENT, receive);
  }, [showToast]);

  return (
    <ToastContext.Provider value={showToast}>
      {children}
      <div className="app-toast-stack" aria-label={t('Thông báo hệ thống')}>
        {notices.map(notice => (
          <ToastNotice key={notice.id} notice={notice} onClose={closeToast} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}
