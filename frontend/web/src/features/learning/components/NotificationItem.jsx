import { useState } from 'react';
import { Link } from 'react-router-dom';
import useNotifications from '../hooks/useNotifications';
import {
  notificationActionUrl,
  notificationCategory,
  NOTIFICATION_CATEGORIES,
} from '../utils/notificationStream';
import { formatDate } from '../../../shared/utils/formatDate';

export default function NotificationItem({ notification, compact = false, onNavigate }) {
  const { markRead } = useNotifications();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const url = notificationActionUrl(notification.actionUrl);
  async function read() {
    if (notification.read || busy) return;
    setBusy(true);
    setError(null);
    try {
      await markRead(notification.id);
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <article
      className={`notification-item ${notification.read ? '' : 'is-unread'} ${compact ? 'is-compact' : ''}`}
    >
      <div className="notification-meta">
        <span className="learning-chip">{NOTIFICATION_CATEGORIES[notificationCategory(notification)]}</span>
        <span>{notification.read ? 'Đã đọc' : 'Chưa đọc'}</span>
      </div>
      <h2>{notification.title}</h2>
      <p>{notification.body}</p>
      <time dateTime={notification.createdAt}>
        {formatDate(notification.createdAt, { dateStyle: 'short', timeStyle: 'short' })}
      </time>
      <div className="notification-actions">
        {url && (
          <Link
            to={url}
            onClick={() => {
              read();
              onNavigate?.();
            }}
          >
            Xem chi tiết
          </Link>
        )}
        {!notification.read && (
          <button className="button button-outline" type="button" disabled={busy} onClick={read}>
            {busy ? 'Đang cập nhật...' : 'Đánh dấu đã đọc'}
          </button>
        )}
      </div>
      {error && <p role="alert">{error}</p>}
    </article>
  );
}
