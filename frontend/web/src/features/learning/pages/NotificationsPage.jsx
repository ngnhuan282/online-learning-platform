import { useEffect, useState } from 'react';
import ErrorState from '../../../shared/components/ErrorState';
import EmptyState from '../../../shared/components/EmptyState';
import { learningApi } from '../api/learningApi';
import useNotifications from '../hooks/useNotifications';
import NotificationItem from '../components/NotificationItem';
import { NOTIFICATION_CATEGORIES } from '../utils/notificationStream';
import '../styles/notifications.css';

export default function NotificationsPage() {
  const notifications = useNotifications();
  return <NotificationsContent key={notifications.userId ?? 'anonymous'} notifications={notifications} />;
}

function NotificationsContent({ notifications }) {
  const { userId, revision, summary, markAllRead, refresh } = notifications;
  const [category, setCategory] = useState('');
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [page, setPage] = useState(0);
  const [retry, setRetry] = useState(0);
  const [state, setState] = useState({ data: null, loading: true, error: null, query: null });
  const [updating, setUpdating] = useState(false);
  const [actionError, setActionError] = useState(null);
  const query = `${userId}:${category}:${unreadOnly}:${page}`;

  useEffect(() => {
    const controller = new AbortController();
    if (userId == null) {
      Promise.resolve().then(() => {
        if (!controller.signal.aborted) {
          setState({ data: null, loading: false, error: null, query: null });
        }
      });
      return () => controller.abort();
    }
    Promise.resolve().then(() => {
      if (controller.signal.aborted) return;
      setState(previous => ({
        data: previous.query === query ? previous.data : null,
        query,
        loading: true,
        error: null,
      }));
    });
    learningApi
      .getNotificationFeed(
        { page, size: 20, ...(category ? { category } : {}), unreadOnly },
        { signal: controller.signal },
      )
      .then(({ data }) => {
        if (controller.signal.aborted) return;
        if (page > 0 && page >= data.totalPages) {
          setPage(Math.max(0, data.totalPages - 1));
          return;
        }
        setState({ data, loading: false, error: null, query });
      })
      .catch(error => {
        if (!controller.signal.aborted) setState({ data: null, query, loading: false, error });
      });
    return () => controller.abort();
  }, [userId, page, category, unreadOnly, revision, retry, query]);

  async function readAll() {
    setUpdating(true);
    setActionError(null);
    try {
      await markAllRead();
    } catch (error) {
      setActionError(error);
    } finally {
      setUpdating(false);
    }
  }
  const data = state.query === query ? state.data : null;
  const reload = () => {
    setRetry(value => value + 1);
    refresh();
  };
  return (
    <section className="learning-page">
      <div className="learning-shell">
        <div className="learning-page-header">
          <div>
            <p>Notifications</p>
            <h1>Thông báo của bạn</h1>
          </div>
          <button
            className="button button-outline"
            type="button"
            disabled={updating || !summary.unreadCount}
            onClick={readAll}
          >
            {updating ? 'Đang cập nhật...' : 'Đánh dấu tất cả đã đọc'}
          </button>
        </div>
        <div className="notification-filters">
          <label>
            Loại thông báo
            <select
              value={category}
              onChange={event => {
                setCategory(event.target.value);
                setPage(0);
              }}
            >
              <option value="">Tất cả</option>
              {Object.entries(NOTIFICATION_CATEGORIES).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <input
              type="checkbox"
              checked={unreadOnly}
              onChange={event => {
                setUnreadOnly(event.target.checked);
                setPage(0);
              }}
            />
            Chỉ chưa đọc
          </label>
          <button className="button button-outline" type="button" onClick={reload}>
            Tải lại
          </button>
        </div>
        {state.query === query && state.error && <ErrorState error={state.error} onRetry={reload} />}
        {actionError && (
          <ErrorState error={actionError} title="Không thể đánh dấu đã đọc" onRetry={readAll} />
        )}
        {state.loading && <p role="status">Đang tải thông báo...</p>}
        {!state.loading && !state.error && data?.content.length === 0 && (
          <EmptyState title="Chưa có thông báo" description="Thông báo phù hợp sẽ xuất hiện tại đây." />
        )}
        <div className="notification-list" aria-busy={state.loading}>
          {data?.content.map(notification => (
            <NotificationItem key={notification.id} notification={notification} />
          ))}
        </div>
        {data && data.totalPages > 0 && (
          <nav className="notification-pagination" aria-label="Phân trang thông báo">
            <button
              className="button button-outline"
              type="button"
              disabled={page === 0 || state.loading}
              onClick={() => setPage(value => value - 1)}
            >
              Trang trước
            </button>
            <span>
              Trang {page + 1} / {data.totalPages} · {data.totalElements} thông báo
            </span>
            <button
              className="button button-outline"
              type="button"
              disabled={data.last || state.loading}
              onClick={() => setPage(value => value + 1)}
            >
              Trang sau
            </button>
          </nav>
        )}
      </div>
    </section>
  );
}
