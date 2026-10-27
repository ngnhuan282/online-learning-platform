import { useEffect, useRef, useState } from 'react';
import useAuth from '../../auth/hooks/useAuth';
import ErrorState from '../../../shared/components/ErrorState';
import EmptyState from '../../../shared/components/EmptyState';
import LearningHeader from '../components/LearningHeader';
import { formatDate } from '../../../shared/utils/formatDate';
import { learningApi } from '../api/learningApi';
import { NOTIFICATION_CATEGORIES, notificationCategory } from '../utils/notificationStream';
import '../styles/notifications.css';

const validUserId = value => /^\d+$/.test(value) && Number.isSafeInteger(Number(value)) && Number(value) > 0;
const newMessage = () => ({ userId: '', title: '', body: '' });

export default function AdminNotificationsPage() {
  const { user } = useAuth();
  return <AdminNotificationsContent key={user?.id ?? 'anonymous'} />;
}

function AdminNotificationsContent() {
  const [recipient, setRecipient] = useState('');
  const [category, setCategory] = useState('');
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [page, setPage] = useState(0);
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState({ data: null, loading: true, error: null, query: null });
  const [form, setForm] = useState(newMessage);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState(null);
  const [sent, setSent] = useState(false);
  const pending = useRef(null);
  const mounted = useRef(false);
  const query = `${recipient}:${category}:${unreadOnly}:${page}`;
  const recipientInvalid = recipient !== '' && !validUserId(recipient);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (recipientInvalid) return undefined;
    const controller = new AbortController();
    Promise.resolve().then(() => {
      if (!controller.signal.aborted) {
        setState(previous => ({
          data: previous.query === query ? previous.data : null,
          query,
          loading: true,
          error: null,
        }));
      }
    });
    learningApi
      .getAdminNotifications(
        {
          page,
          size: 20,
          unreadOnly,
          ...(recipient ? { userId: Number(recipient) } : {}),
          ...(category ? { category } : {}),
        },
        { signal: controller.signal },
      )
      .then(({ data }) => {
        if (controller.signal.aborted) return;
        if (page > 0 && page >= data.totalPages) {
          setPage(Math.max(0, data.totalPages - 1));
          return;
        }
        setState({ data, query, loading: false, error: null });
      })
      .catch(error => {
        if (!controller.signal.aborted) setState({ data: null, query, loading: false, error });
      });
    return () => controller.abort();
  }, [recipient, category, unreadOnly, page, revision, query, recipientInvalid]);

  function changeForm(field, value) {
    setForm(previous => ({ ...previous, [field]: value }));
    pending.current = null;
    setSendError(null);
    setSent(false);
  }

  async function send(event) {
    event.preventDefault();
    if (sending) return;
    if (!validUserId(form.userId) || !form.title.trim() || !form.body.trim()) {
      setSendError(new Error('Nhập ID người nhận hợp lệ, tiêu đề và nội dung.'));
      return;
    }
    pending.current ??= {
      eventId: globalThis.crypto.randomUUID(),
      userId: Number(form.userId),
      title: form.title.trim(),
      body: form.body.trim(),
    };
    setSending(true);
    setSent(false);
    setSendError(null);
    try {
      await learningApi.sendSystemNotification(pending.current);
      if (!mounted.current) return;
      pending.current = null;
      setForm(newMessage());
      setSent(true);
      setRevision(value => value + 1);
    } catch (error) {
      if (mounted.current) setSendError(error);
    } finally {
      if (mounted.current) setSending(false);
    }
  }

  const current = state.query === query && !recipientInvalid;
  const data = current ? state.data : null;
  return (
    <section className="admin-notifications learning-admin-workspace">
      <LearningHeader
        title="Quản lý thông báo"
        description="Gửi thông báo hệ thống và tra cứu lịch sử theo người nhận."
        navigation={false}
      />
      <form className="notification-compose" onSubmit={send}>
        <h2>Gửi thông báo hệ thống</h2>
        <p>
          Gửi tới một ID người dùng cụ thể. Các thông báo Course, Payment và Learning được tạo theo sự kiện
          nghiệp vụ.
        </p>
        <fieldset disabled={sending}>
          <label>
            ID người nhận
            <input
              required
              inputMode="numeric"
              value={form.userId}
              onChange={event => changeForm('userId', event.target.value)}
            />
          </label>
          <label>
            Tiêu đề
            <input
              required
              maxLength={255}
              value={form.title}
              onChange={event => changeForm('title', event.target.value)}
            />
          </label>
          <label>
            Nội dung
            <textarea
              required
              maxLength={1000}
              rows={4}
              value={form.body}
              onChange={event => changeForm('body', event.target.value)}
            />
          </label>
          <button className="button button-primary" type="submit">
            {sending ? 'Đang gửi...' : 'Gửi thông báo'}
          </button>
        </fieldset>
        {sendError && (
          <p role="alert">{sendError.message} Bạn có thể gửi lại; cùng yêu cầu sẽ không tạo bản trùng.</p>
        )}
        {sent && <p role="status">Đã gửi thông báo hệ thống.</p>}
      </form>
      <h2>Lịch sử thông báo</h2>
      <div className="notification-filters">
        <label>
          ID người nhận
          <input
            inputMode="numeric"
            value={recipient}
            placeholder="Tất cả người nhận"
            onChange={event => {
              setRecipient(event.target.value);
              setPage(0);
            }}
          />
        </label>
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
        <button
          className="button button-outline"
          type="button"
          onClick={() => setRevision(value => value + 1)}
        >
          Tải lại
        </button>
      </div>
      {recipientInvalid && <p role="alert">ID người nhận phải là số nguyên dương hợp lệ.</p>}
      {current && state.error && (
        <ErrorState error={state.error} onRetry={() => setRevision(value => value + 1)} />
      )}
      {!recipientInvalid && (!current || state.loading) && <p role="status">Đang tải thông báo...</p>}
      {current && !state.loading && !state.error && data?.content.length === 0 && (
        <EmptyState title="Chưa có thông báo phù hợp" />
      )}
      <div className="notification-list">
        {data?.content.map(notification => (
          <article
            className={`notification-item ${notification.read ? '' : 'is-unread'}`}
            key={notification.id}
          >
            <div className="notification-meta">
              <span>
                {NOTIFICATION_CATEGORIES[notificationCategory(notification)]} · Người nhận #
                {notification.userId}
              </span>
              <span>{notification.read ? 'Đã đọc' : 'Chưa đọc'}</span>
            </div>
            <h3>{notification.title}</h3>
            <p>{notification.body}</p>
            <time dateTime={notification.createdAt}>
              {formatDate(notification.createdAt, { dateStyle: 'short', timeStyle: 'short' })}
            </time>
          </article>
        ))}
      </div>
      {data && data.totalPages > 0 && (
        <nav className="notification-pagination" aria-label="Phân trang thông báo quản trị">
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
    </section>
  );
}
