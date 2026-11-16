import { useCallback, useState } from 'react';
import { Button } from '@mui/material';
import { commerceAdminApi as api } from '../api/commerceAdminApi';
import useLearningResource from '../../learning/hooks/useLearningResource';
import useAuth from '../../auth/hooks/useAuth';
import { can, money } from '../utils/adminUtils';
import { LoadState, PageHeading } from '../components/AdminUi';
import { AdminActionDialog, CommerceTable, Field, ReasonField } from '../components/CommerceAdminUi';
import { t } from '../../../shared/i18n/locale';
import useLocale from '../../../shared/i18n/useLocale';
export default function AdminProPlansPage() {
  useLocale();
  const { user } = useAuth();
  const [form, setForm] = useState(null);
  const load = useCallback(options => api.plans(options), []);
  const resource = useLearningResource(load, null);
  return (
    <>
      <PageHeading
        title="Quản lý gói Pro"
        description="Cập nhật giá và mở / ngừng bán các gói 1, 3, 12 tháng."
      />
      <p className="commerce-info">
        {t('Đơn đã tạo giữ nguyên giá và thời hạn tại thời điểm đặt. Ngừng bán không thu hồi Pro đã mua.')}
      </p>
      <LoadState loading={resource.loading} error={resource.error} retry={resource.reload} />
      {resource.data && !resource.error && (
        <CommerceTable
          rowKey="code"
          rows={resource.data}
          columns={[
            ['Mã gói', 'code'],
            ['Tên', r => t(r.name)],
            ['Số tháng', 'durationMonths'],
            ['Giá', r => money(r.price)],
            ['Trạng thái', r => t(r.active ? 'Đang mở bán' : 'Ngừng bán')],
            [
              'Thao tác',
              r =>
                can(user, 'PRO_PLAN_UPDATE') ? (
                  <Button onClick={() => setForm({ ...r, reason: '' })}>{t('Chỉnh sửa')}</Button>
                ) : (
                  '—'
                ),
            ],
          ]}
        />
      )}
      {form && (
        <AdminActionDialog
          title="Chỉnh sửa gói Pro"
          onClose={() => setForm(null)}
          onSubmit={() =>
            api.savePlan(form.code, {
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
          <strong>
            {form.code} · {form.durationMonths} {t('tháng')}
          </strong>
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
