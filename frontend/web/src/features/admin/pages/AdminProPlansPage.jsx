import { useCallback, useState } from 'react';
import { Button } from '@mui/material';
import { Add } from '@mui/icons-material';
import { commerceAdminApi as api } from '../api/commerceAdminApi';
import useLearningResource from '../../learning/hooks/useLearningResource';
import useAuth from '../../auth/hooks/useAuth';
import { can, money } from '../utils/adminUtils';
import { LoadState, PageHeading } from '../components/AdminUi';
import {
  AdminActionDialog,
  CommerceTable,
  Field,
  ReasonField,
  AdminRowActions,
  AdminDeleteDialog,
  AdminDetailsDialog,
} from '../components/CommerceAdminUi';
import { t } from '../../../shared/i18n/locale';
import useLocale from '../../../shared/i18n/useLocale';
import useAdminPagination from '../hooks/useAdminPagination';
export default function AdminProPlansPage() {
  useLocale();
  const { user } = useAuth();
  const tablePagination = useAdminPagination();
  const [form, setForm] = useState(null);
  const [trash, setTrash] = useState(false),
    [removing, setRemoving] = useState(null),
    [detail, setDetail] = useState(null);
  const load = useCallback(options => api.plans(options), []);
  const resource = useLearningResource(load, null);
  return (
    <>
      <PageHeading
        title="Quản lý gói Pro"
        description="Thêm, sửa, xóa và quản lý các gói Pro 1, 3, 12 tháng."
      >
        {can(user, 'PRO_PLAN_CREATE') && (
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={() =>
              setForm({
                create: true,
                code: 'PRO_',
                name: '',
                durationMonths: 1,
                price: '',
                active: true,
                reason: '',
              })
            }
          >
            {t('Thêm gói Pro')}
          </Button>
        )}
      </PageHeading>
      <div className="commerce-toolbar">
        <Button variant={trash ? 'contained' : 'outlined'} onClick={() => setTrash(value => !value)}>
          {t(trash ? 'Xem danh sách' : 'Thùng rác')}
        </Button>
      </div>
      <p className="commerce-info">
        {t('Đơn đã tạo giữ nguyên giá và thời hạn tại thời điểm đặt. Ngừng bán không thu hồi Pro đã mua.')}
      </p>
      <LoadState loading={resource.loading} error={resource.error} retry={resource.reload} />
      {resource.data && !resource.error && (
        <CommerceTable
          paginate
          pagination={tablePagination}
          rowKey="code"
          rows={resource.data.filter(item => Boolean(item.deletedAt) === trash)}
          columns={[
            ['Mã gói', 'code'],
            ['Tên', r => t(r.name)],
            ['Số tháng', 'durationMonths'],
            ['Giá', r => money(r.price)],
            [
              'Trạng thái',
              r => (
                <span className={`admin-pill ${r.active ? 'green' : ''}`}>
                  {t(r.active ? 'Đang mở bán' : 'Ngừng bán')}
                </span>
              ),
            ],
            [
              'Thao tác',
              r => (
                <AdminRowActions
                  actions={[
                    { kind: 'view', label: 'Xem chi tiết', onClick: () => setDetail(r) },
                    !r.deletedAt &&
                      can(user, 'PRO_PLAN_UPDATE') && {
                        kind: 'edit',
                        label: 'Chỉnh sửa',
                        onClick: () => setForm({ ...r, reason: '' }),
                      },
                    can(user, 'PRO_PLAN_DELETE') && {
                      kind: r.deletedAt ? 'restore' : 'delete',
                      label: r.deletedAt ? 'Khôi phục' : 'Xóa gói Pro',
                      onClick: () => setRemoving(r),
                    },
                  ]}
                />
              ),
            ],
          ]}
        />
      )}
      {detail && (
        <AdminDetailsDialog title="Chi tiết gói Pro" onClose={() => setDetail(null)}>
          <strong>{detail.name}</strong>
          <p>
            {detail.code} · {detail.durationMonths} {t('tháng')}
          </p>
          <p>{money(detail.price)}</p>
        </AdminDetailsDialog>
      )}
      {removing && (
        <AdminDeleteDialog
          item={removing}
          restore={Boolean(removing.deletedAt)}
          onClose={() => setRemoving(null)}
          onSubmit={payload =>
            removing.deletedAt
              ? api.restorePlan(removing.code, payload)
              : api.deletePlan(removing.code, payload)
          }
          onSaved={() => {
            setRemoving(null);
            resource.reload();
          }}
        />
      )}
      {form && (
        <AdminActionDialog
          title={form.create ? 'Thêm gói Pro' : 'Chỉnh sửa gói Pro'}
          onClose={() => setForm(null)}
          onSubmit={() =>
            form.create
              ? api.createPlan({
                  ...form,
                  price: Number(form.price),
                  durationMonths: Number(form.durationMonths),
                })
              : api.savePlan(form.code, {
                  name: form.name,
                  price: Number(form.price),
                  active: form.active,
                  version: form.version,
                  reason: form.reason,
                })
          }
          onSaved={() => {
            setForm(null);
            resource.reload();
          }}
        >
          {form.create ? (
            <>
              <Field
                label="Mã gói"
                required
                pattern="PRO_[A-Z0-9_]{1,28}"
                maxLength={32}
                value={form.code}
                onChange={e => setForm({ ...form, code: e.target.value.toUpperCase() })}
              />
              <Field label="Số tháng">
                <select
                  value={form.durationMonths}
                  onChange={e => setForm({ ...form, durationMonths: Number(e.target.value) })}
                >
                  {[1, 3, 12].map(value => (
                    <option key={value} value={value}>
                      {value} {t('tháng')}
                    </option>
                  ))}
                </select>
              </Field>
            </>
          ) : (
            <strong>
              {form.code} · {form.durationMonths} {t('tháng')}
            </strong>
          )}
          <Field
            label="Tên gói"
            required
            maxLength={120}
            value={form.name}
            onChange={e => setForm({ ...form, name: e.target.value })}
          />
          <Field
            label="Giá VND"
            type="number"
            step="1"
            required
            min="1"
            max="100000000"
            value={form.price}
            onChange={e => setForm({ ...form, price: e.target.value })}
          />
          <label className="commerce-check">
            <input
              type="checkbox"
              checked={form.active}
              onChange={e => setForm({ ...form, active: e.target.checked })}
            />
            {t('Mở bán')}
          </label>
          <ReasonField value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} />
        </AdminActionDialog>
      )}
    </>
  );
}
