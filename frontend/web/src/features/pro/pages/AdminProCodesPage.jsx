import { useCallback, useState } from 'react';
import { Button } from '@mui/material';
import { Add, ContentCopyOutlined } from '@mui/icons-material';
import { proApi } from '../api/proApi';
import { commerceAdminApi as api } from '../../admin/api/commerceAdminApi';
import useLearningResource from '../../learning/hooks/useLearningResource';
import { LoadState, PageHeading } from '../../admin/components/AdminUi';
import {
  AdminActionDialog,
  AdminDetailsDialog,
  AdminRowActions,
  CommerceTable,
  CommercePager,
  Field,
  ReasonField,
} from '../../admin/components/CommerceAdminUi';
import { formatDate } from '../../../shared/utils/formatDate';
import { t } from '../../../shared/i18n/locale';
import useLocale from '../../../shared/i18n/useLocale';
import useAuth from '../../auth/hooks/useAuth';
import { can } from '../../admin/utils/adminUtils';
import '../styles/pro.css';

const statusLabels = {
  AVAILABLE: 'Chưa sử dụng',
  USED: 'Đã sử dụng',
  EXPIRED: 'Đã hết hạn',
  REVOKED: 'Đã thu hồi',
};
const localDate = iso =>
  iso ? new Date(Date.parse(iso) - new Date(iso).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '';
export default function AdminProCodesPage() {
  useLocale();
  const { user } = useAuth();
  const [page, setPage] = useState(0),
    [size, setSize] = useState(20),
    [form, setForm] = useState(null),
    [revoke, setRevoke] = useState(null),
    [detail, setDetail] = useState(null),
    [issued, setIssued] = useState(null),
    [notice, setNotice] = useState('');
  const load = useCallback(
    async options => {
      const [codes, plans] = await Promise.all([
        proApi.codes({ ...options, params: { page, size } }),
        proApi.plans(options),
      ]);
      const data = Array.isArray(codes.data)
        ? {
            content: codes.data.slice(page * size, (page + 1) * size),
            totalElements: codes.data.length,
            totalPages: Math.ceil(codes.data.length / size),
          }
        : codes.data;
      return { data: { codes: data, plans: plans.data } };
    },
    [page, size],
  );
  const resource = useLearningResource(load, null);
  const saved = () => {
    setForm(null);
    setRevoke(null);
    resource.reload();
  };
  async function copy() {
    try {
      await navigator.clipboard.writeText(issued.code);
      setNotice('Đã sao chép mã.');
    } catch {
      setNotice('Không thể sao chép tự động. Bạn có thể chọn và sao chép mã bên dưới.');
    }
  }
  return (
    <>
      <PageHeading
        title="Mã kích hoạt Pro"
        description="Phát hành mã, sửa thời hạn và thu hồi mã chưa sử dụng."
      >
        {can(user, 'PRO_CODE_CREATE') && (
          <Button
            variant="contained"
            startIcon={<Add />}
            disabled={!resource.data?.plans.length}
            onClick={() =>
              setForm({ planCode: resource.data.plans[0].code, expiresAt: '', reason: '', create: true })
            }
          >
            {t('Tạo mã kích hoạt')}
          </Button>
        )}
      </PageHeading>
      {issued && (
        <article className="admin-card pro-issued-code">
          <strong>{t('Mã chỉ hiển thị đầy đủ một lần. Hãy lưu ở nơi an toàn.')}</strong>
          <code>{issued.code}</code>
          <Button startIcon={<ContentCopyOutlined />} onClick={copy}>
            {t('Sao chép mã')}
          </Button>
        </article>
      )}
      {notice && <p role="status">{t(notice)}</p>}
      <LoadState loading={resource.loading} error={resource.error} retry={resource.reload} />
      {resource.data && !resource.error && (
        <>
          <CommerceTable
            rows={resource.data.codes.content}
            columns={[
              ['Mã kích hoạt', r => <code>{r.maskedCode}</code>],
              ['Gói Pro', r => `${r.durationMonths} ${t('tháng')}`],
              ['Ngày tạo', r => formatDate(r.createdAt)],
              ['Hạn sử dụng', r => (r.expiresAt ? formatDate(r.expiresAt) : t('Không giới hạn'))],
              [
                'Trạng thái',
                r => (
                  <span
                    className={
                      'admin-pill ' +
                      (r.status === 'AVAILABLE' ? 'green' : r.status === 'USED' ? 'purple' : 'red')
                    }
                  >
                    {t(statusLabels[r.status])}
                  </span>
                ),
              ],
              ['Người sử dụng', 'redeemedBy'],
              [
                'Thao tác',
                r => (
                  <AdminRowActions
                    actions={[
                      { kind: 'view', label: 'Xem chi tiết', onClick: () => setDetail(r) },
                      can(user, 'PRO_CODE_UPDATE') &&
                        ['AVAILABLE', 'EXPIRED'].includes(r.status) && {
                          kind: 'edit',
                          label: 'Chỉnh sửa',
                          onClick: () => setForm({ ...r, expiresAt: localDate(r.expiresAt), reason: '' }),
                        },
                      can(user, 'PRO_CODE_REVOKE') &&
                        ['AVAILABLE', 'EXPIRED'].includes(r.status) && {
                          kind: 'delete',
                          label: 'Thu hồi',
                          onClick: () => setRevoke(r),
                        },
                    ]}
                  />
                ),
              ],
            ]}
          />
          <CommercePager
            data={resource.data.codes}
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
        <AdminDetailsDialog title="Chi tiết mã Pro" onClose={() => setDetail(null)}>
          <strong>{detail.maskedCode}</strong>
          <p>
            {detail.planCode} · {t(statusLabels[detail.status])}
          </p>
          <p>{detail.expiresAt ? formatDate(detail.expiresAt) : t('Không giới hạn')}</p>
        </AdminDetailsDialog>
      )}
      {form && (
        <AdminActionDialog
          title={form.create ? 'Tạo mã kích hoạt' : 'Chỉnh sửa mã Pro'}
          actionLabel={form.create ? 'Tạo mã' : 'Lưu thay đổi'}
          onClose={() => setForm(null)}
          onSubmit={() =>
            form.create
              ? proApi.createCode({
                  planCode: form.planCode,
                  expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : null,
                })
              : api.updateCode(form.id, {
                  expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : null,
                  version: form.version || 0,
                  reason: form.reason,
                })
          }
          onSaved={response => {
            if (form.create) setIssued(response.data);
            saved();
          }}
        >
          {form.create ? (
            <Field label="Gói Pro">
              <select value={form.planCode} onChange={e => setForm({ ...form, planCode: e.target.value })}>
                {resource.data.plans.map(plan => (
                  <option key={plan.code} value={plan.code}>
                    {t(plan.name || plan.code)} · {plan.durationMonths} {t('tháng')}
                  </option>
                ))}
              </select>
            </Field>
          ) : (
            <strong>{form.maskedCode}</strong>
          )}
          <Field
            label="Hạn sử dụng mã (tùy chọn)"
            type="datetime-local"
            value={form.expiresAt}
            onChange={e => setForm({ ...form, expiresAt: e.target.value })}
          />
          {!form.create && (
            <ReasonField value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} />
          )}
        </AdminActionDialog>
      )}
      {revoke && (
        <AdminActionDialog
          title="Thu hồi mã kích hoạt?"
          actionLabel="Thu hồi"
          onClose={() => setRevoke(null)}
          onSubmit={() => proApi.revokeCode(revoke.id)}
          onSaved={() => {
            if (issued?.info.id === revoke.id) setIssued(null);
            saved();
          }}
        >
          <strong>{revoke.maskedCode}</strong>
          <p>{t('Mã chưa sử dụng này sẽ không thể kích hoạt Pro nữa.')}</p>
        </AdminActionDialog>
      )}
    </>
  );
}
