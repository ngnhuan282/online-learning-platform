import { useCallback, useState } from 'react';
import { ContentCopyOutlined, KeyOutlined } from '@mui/icons-material';
import { proApi } from '../api/proApi';
import useLearningResource from '../../learning/hooks/useLearningResource';
import useWorkspaceMutation from '../../engagement/hooks/useWorkspaceMutation';
import { ActionError, WorkspaceState } from '../../engagement/components/WorkspaceUi';
import ConfirmDialog from '../../../shared/components/ConfirmDialog';
import { formatDate } from '../../../shared/utils/formatDate';
import { t } from '../../../shared/i18n/locale';
import useLocale from '../../../shared/i18n/useLocale';
import '../styles/pro.css';
import useAuth from '../../auth/hooks/useAuth';
import { can } from '../../admin/utils/adminUtils';

const statusLabels = {
  AVAILABLE: 'Chưa sử dụng',
  USED: 'Đã sử dụng',
  EXPIRED: 'Đã hết hạn',
  REVOKED: 'Đã thu hồi',
};
export default function AdminProCodesPage() {
  useLocale();
  const { user } = useAuth();
  const load = useCallback(options => proApi.codes(options), []);
  const resource = useLearningResource(load, null);
  const mutation = useWorkspaceMutation();
  const [planCode, setPlanCode] = useState('PRO_MONTH');
  const [expiresAt, setExpiresAt] = useState('');
  const [issued, setIssued] = useState(null);
  const [revoke, setRevoke] = useState(null);
  const [notice, setNotice] = useState('');
  function create(event) {
    event.preventDefault();
    setNotice('');
    mutation.run(
      () => proApi.createCode({ planCode, expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null }),
      response => {
        setIssued(response.data);
        resource.reload();
      },
    );
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(issued.code);
      setNotice('Đã sao chép mã.');
    } catch {
      setNotice('Không thể sao chép tự động. Bạn có thể chọn và sao chép mã bên dưới.');
    }
  }
  return (
    <section className="community-workspace container">
      <header className="workspace-heading">
        <div>
          <span className="eyebrow">ChitChatGo · ADMIN</span>
          <h1>{t('Mã kích hoạt Pro')}</h1>
          <p>{t('Cấp mã dùng một lần và theo dõi 100 mã gần nhất.')}</p>
        </div>
        <KeyOutlined />
      </header>
      {can(user, 'PRO_CODE_CREATE') && (
        <form className="pro-admin-form" onSubmit={create}>
          <label>
            {t('Gói Pro')}
            <select
              value={planCode}
              onChange={event => setPlanCode(event.target.value)}
              disabled={mutation.busy}
            >
              <option value="PRO_MONTH">{t('1 tháng')}</option>
              <option value="PRO_QUARTER">{t('3 tháng')}</option>
              <option value="PRO_YEAR">{t('1 năm')}</option>
            </select>
          </label>
          <label>
            {t('Hạn sử dụng mã (tùy chọn)')}
            <input
              type="datetime-local"
              value={expiresAt}
              onChange={event => setExpiresAt(event.target.value)}
              disabled={mutation.busy}
            />
          </label>
          <button className="button button-primary" disabled={mutation.busy}>
            {t('Tạo mã kích hoạt')}
          </button>
        </form>
      )}
      <ActionError error={mutation.error} />
      {issued && (
        <article className="pro-issued-code">
          <strong>{t('Mã chỉ hiển thị đầy đủ một lần. Hãy lưu ở nơi an toàn.')}</strong>
          <code>{issued.code}</code>
          <button className="button button-outline" onClick={copy}>
            <ContentCopyOutlined fontSize="small" />
            {t('Sao chép mã')}
          </button>
        </article>
      )}
      {notice && <p role="status">{t(notice)}</p>}
      <WorkspaceState loading={resource.loading} error={resource.error} retry={resource.reload} />
      {resource.data && !resource.error && (
        <div className="workspace-table-wrap">
          <table className="ranking-table">
            <thead>
              <tr>
                {[
                  'Mã kích hoạt',
                  'Gói Pro',
                  'Ngày tạo',
                  'Hạn sử dụng',
                  'Trạng thái',
                  'Người sử dụng',
                  'Thao tác',
                ].map(label => (
                  <th key={label}>{t(label)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {resource.data.map(item => (
                <tr key={item.id}>
                  <td>
                    <code>{item.maskedCode}</code>
                  </td>
                  <td>
                    {t(item.durationMonths === 12 ? '1 năm' : '{months} tháng', {
                      months: item.durationMonths,
                    })}
                  </td>
                  <td>{formatDate(item.createdAt)}</td>
                  <td>{item.expiresAt ? formatDate(item.expiresAt) : t('Không giới hạn')}</td>
                  <td>{t(statusLabels[item.status])}</td>
                  <td>{item.redeemedBy ?? '—'}</td>
                  <td>
                    <button
                      className="text-button danger"
                      disabled={mutation.busy || item.status !== 'AVAILABLE' || !can(user, 'PRO_CODE_REVOKE')}
                      onClick={() => setRevoke(item)}
                    >
                      {t('Thu hồi')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {resource.data.length === 0 && <p className="workspace-card">{t('Chưa có mã kích hoạt nào.')}</p>}
        </div>
      )}
      <ConfirmDialog
        open={Boolean(revoke)}
        title="Thu hồi mã kích hoạt?"
        description="Mã chưa sử dụng này sẽ không thể kích hoạt Pro nữa."
        destructive
        pending={mutation.busy}
        confirmLabel={t('Thu hồi')}
        onClose={() => setRevoke(null)}
        onConfirm={() =>
          mutation.run(
            () => proApi.revokeCode(revoke.id),
            () => {
              if (issued?.info.id === revoke.id) setIssued(null);
              setRevoke(null);
              resource.reload();
            },
          )
        }
      >
        <ActionError error={mutation.error} />
      </ConfirmDialog>
    </section>
  );
}
