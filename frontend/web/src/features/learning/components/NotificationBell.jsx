import { t } from '../../../shared/i18n/locale';
import useLocale from '../../../shared/i18n/useLocale';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../../../shared/components/Icon';
import ErrorState from '../../../shared/components/ErrorState';
import useNotifications from '../hooks/useNotifications';
import NotificationItem from './NotificationItem';
import { ROUTES } from '../../../shared/constants/routes';
import '../styles/notifications.css';

export default function NotificationBell() {
  useLocale();
  const { userId, summary, loading, error, refresh } = useNotifications();
  const [open, setOpen] = useState(false);
  const wrapper = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const closeOutside = event => {
      if (!wrapper.current?.contains(event.target)) setOpen(false);
    };
    const closeEscape = event => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', closeOutside);
    document.addEventListener('keydown', closeEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOutside);
      document.removeEventListener('keydown', closeEscape);
    };
  }, [open]);
  if (userId == null) return null;
  return (
    <div className="notification-wrap" ref={wrapper}>
      <button
        className="icon-button notification-button"
        type="button"
        aria-label={
          summary.unreadCount
            ? t('Thông báo, {count} chưa đọc', { count: summary.unreadCount })
            : t('Thông báo')
        }
        aria-expanded={open}
        onClick={() => {
          if (!open) refresh();
          setOpen(value => !value);
        }}
      >
        <Icon name="bell" size={20} />
        {summary.unreadCount > 0 && (
          <span className="notification-badge">{summary.unreadCount > 99 ? '99+' : summary.unreadCount}</span>
        )}
      </button>
      {open && (
        <div className="notification-panel" aria-label={t('Thông báo gần đây')} aria-busy={loading}>
          <strong>{t('Thông báo')}</strong>
          {error && <ErrorState error={error} onRetry={refresh} />}
          {loading && !summary.notifications.length && <p role="status">{t('Đang tải thông báo...')}</p>}
          {!loading && !error && !summary.notifications.length && <p>{t('Chưa có thông báo.')}</p>}
          <div className="notification-preview">
            {summary.notifications.map(notification => (
              <NotificationItem
                key={notification.id}
                notification={notification}
                compact
                onNavigate={() => setOpen(false)}
              />
            ))}
          </div>
          <Link to={ROUTES.NOTIFICATIONS} onClick={() => setOpen(false)}>
            {t('Xem tất cả thông báo')}
          </Link>
        </div>
      )}
    </div>
  );
}
