import { t } from '../../../shared/i18n/locale';
import useLocale from '../../../shared/i18n/useLocale';
import { useEffect, useRef, useState } from 'react';
import useAuth from '../../auth/hooks/useAuth';
import ErrorState from '../../../shared/components/ErrorState';
import EmptyState from '../../../shared/components/EmptyState';
import { PageHeading } from '../../admin/components/AdminUi';
import {
  CommerceTable,
  CommercePager,
  AdminRowActions,
  AdminDetailsDialog,
} from '../../admin/components/CommerceAdminUi';
import { notifyAdminFailure } from '../../../shared/utils/adminFeedback';
import { formatDate } from '../../../shared/utils/formatDate';
import { learningApi } from '../api/learningApi';
import { NOTIFICATION_CATEGORIES, notificationCategory } from '../utils/notificationStream';
import '../styles/notifications.css';
import { can } from '../../admin/utils/adminUtils';

const validUserId = value => /^\d+$/.test(value) && Number.isSafeInteger(Number(value)) && Number(value) > 0;
const newMessage = () => ({ userId: '', title: '', body: '' });

export default function AdminNotificationsPage() {
  useLocale();
  const { user } = useAuth();
  return <AdminNotificationsContent key={user?.id ?? 'anonymous'} />;
}

function AdminNotificationsContent() {
  useLocale();
  const { user } = useAuth();
  const [recipient, setRecipient] = useState('');
  const [category, setCategory] = useState('');
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(20),
    [detail, setDetail] = useState(null);
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState({ data: null, loading: true, error: null, query: null });
  const [form, setForm] = useState(newMessage);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState(null);
  const [sent, setSent] = useState(false);
  const pending = useRef(null);
  const mounted = useRef(false);
  const query = `${recipient}:${category}:${unreadOnly}:${page}:${size}`;
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
          size,
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
  }, [recipient, category, unreadOnly, page, size, revision, query, recipientInvalid]);

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
      const failure = new Error('Nhập ID người nhận hợp lệ, tiêu đề và nội dung.');
      setSendError(failure);
      notifyAdminFailure(failure);
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
      <PageHeading
        title={t('Quản lý thông báo')}
        description={t('Gửi thông báo hệ thống và tra cứu lịch sử theo người nhận.')}
      />
      {can(user, 'NOTIFICATION_MANAGE') && (
        <form className="notification-compose" onSubmit={send}>
          <h2>{t('Gửi thông báo hệ thống')}</h2>
          <p>
            {t(
              'Gửi tới một ID người dùng cụ thể. Các thông báo Course, Payment và Learning được tạo theo sự kiện nghiệp vụ.',
            )}
          </p>
          <fieldset disabled={sending}>
            <label>
              {t('ID người nhận')}
              <input
                required
                inputMode="numeric"
                value={form.userId}
                onChange={event => changeForm('userId', event.target.value)}
              />
            </label>
            <label>
              {t('Tiêu đề')}
              <input
                required
                maxLength={255}
                value={form.title}
                onChange={event => changeForm('title', event.target.value)}
              />
            </label>
            <label>
              {t('Nội dung')}
              <textarea
                required
                maxLength={1000}
                rows={4}
                value={form.body}
                onChange={event => changeForm('body', event.target.value)}
              />
            </label>
            <button className="button button-primary" type="submit">
              {sending ? t('Đang gửi...') : t('Gửi thông báo')}
            </button>
          </fieldset>
          {sendError && (
            <p role="alert">
              {t(sendError.message)} {t('Bạn có thể gửi lại; cùng yêu cầu sẽ không tạo bản trùng.')}
            </p>
          )}
          {sent && <p role="status">{t('Đã gửi thông báo hệ thống.')}</p>}
        </form>
      )}
      <h2>{t('Lịch sử thông báo')}</h2>
      <div className="notification-filters">
        <label>
          {t('ID người nhận')}
          <input
            inputMode="numeric"
            value={recipient}
            placeholder={t('Tất cả người nhận')}
            onChange={event => {
              setRecipient(event.target.value);
              setPage(0);
            }}
          />
        </label>
        <label>
          {t('Loại thông báo')}
          <select
            value={category}
            onChange={event => {
              setCategory(event.target.value);
              setPage(0);
            }}
          >
            <option value="">{t('Tất cả')}</option>
            {Object.entries(NOTIFICATION_CATEGORIES).map(([key, label]) => (
              <option key={key} value={key}>
                {t(label)}
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
          {t('Chỉ chưa đọc')}
        </label>
        <button
          className="button button-outline"
          type="button"
          onClick={() => setRevision(value => value + 1)}
        >
          {t('Tải lại')}
        </button>
      </div>
      {recipientInvalid && <p role="alert">{t('ID người nhận phải là số nguyên dương hợp lệ.')}</p>}
      {current && state.error && (
        <ErrorState error={state.error} onRetry={() => setRevision(value => value + 1)} />
      )}
      {!recipientInvalid && (!current || state.loading) && <p role="status">{t('Đang tải thông báo...')}</p>}
      {current && !state.loading && !state.error && data?.content.length === 0 && (
        <EmptyState title={t('Chưa có thông báo phù hợp')} />
      )}
      {data && (
        <>
          <CommerceTable
            rows={data.content}
            columns={[
              ['ID người nhận', 'userId'],
              ['Tiêu đề', 'title'],
              ['Loại thông báo', row => t(NOTIFICATION_CATEGORIES[notificationCategory(row)])],
              ['Trạng thái', row => t(row.read ? 'Đã đọc' : 'Chưa đọc')],
              ['Ngày tạo', row => formatDate(row.createdAt, { dateStyle: 'short', timeStyle: 'short' })],
              [
                'Thao tác',
                row => (
                  <AdminRowActions
                    actions={[{ kind: 'view', label: 'Xem chi tiết', onClick: () => setDetail(row) }]}
                  />
                ),
              ],
            ]}
          />
          <CommercePager
            data={data}
            page={page}
            size={size}
            onChange={setPage}
            onSizeChange={value => {
              setSize(value);
              setPage(0);
            }}
          />
        </>
      )}
      {detail && (
        <AdminDetailsDialog title="Chi tiết thông báo" onClose={() => setDetail(null)}>
          <strong>{detail.title}</strong>
          <p>{detail.body}</p>
          <p>
            {t('Người nhận #')}
            {detail.userId}
          </p>
        </AdminDetailsDialog>
      )}
    </section>
  );
}
