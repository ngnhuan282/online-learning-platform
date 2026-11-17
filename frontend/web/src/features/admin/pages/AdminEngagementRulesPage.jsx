import { useCallback, useState } from 'react';
import { Button } from '@mui/material';
import { Add, EditOutlined } from '@mui/icons-material';
import { commerceAdminApi as api } from '../api/commerceAdminApi';
import useLearningResource from '../../learning/hooks/useLearningResource';
import useAuth from '../../auth/hooks/useAuth';
import { can } from '../utils/adminUtils';
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
const labels = {
  lessonXp: 'XP hoàn thành bài học',
  quizXp: 'XP nộp quiz lần đầu',
  dailyGems: 'Gem mỗi ngày học',
  xpPerLevel: 'XP mỗi cấp độ',
};
const metricLabels = { FIRST_LESSON: 'Bài học đầu tiên', STREAK: 'Chuỗi học', LEVEL: 'Cấp độ' };
export default function AdminEngagementRulesPage() {
  useLocale();
  const { user } = useAuth();
  const tablePagination = useAdminPagination();
  const [form, setForm] = useState(null);
  const [trash, setTrash] = useState(false),
    [removing, setRemoving] = useState(null),
    [detail, setDetail] = useState(null);
  const load = useCallback(async options => {
    const [settings, rewards] = await Promise.all([api.settings(options), api.rewards(options)]);
    return { data: { settings: settings.data, rewards: rewards.data } };
  }, []);
  const resource = useLearningResource(load, null);
  return (
    <>
      <PageHeading
        title="Quy tắc & phần thưởng"
        description="Cấu hình XP, số XP lên cấp, gem hàng ngày và phần thưởng."
      >
        {can(user, 'REWARD_CREATE') && (
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={() =>
              setForm({
                create: true,
                kind: 'reward',
                code: '',
                label: '',
                metric: 'STREAK',
                threshold: 3,
                gems: 0,
                active: true,
                version: 0,
                reason: '',
              })
            }
          >
            {t('Thêm phần thưởng')}
          </Button>
        )}
      </PageHeading>
      <LoadState loading={resource.loading} error={resource.error} retry={resource.reload} />
      {resource.data && !resource.error && (
        <>
          <section className="admin-card commerce-section">
            <h2>{t('Quy tắc học tập')}</h2>
            <div className="commerce-stats">
              {Object.entries(labels).map(([key, label]) => (
                <div className="commerce-stat" key={key}>
                  <span>{t(label)}</span>
                  <strong>{resource.data.settings[key]}</strong>
                </div>
              ))}
            </div>
            {can(user, 'ENGAGEMENT_CONFIG_UPDATE') && (
              <Button
                startIcon={<EditOutlined />}
                onClick={() => setForm({ ...resource.data.settings, kind: 'settings', reason: '' })}
              >
                {t('Chỉnh sửa quy tắc')}
              </Button>
            )}
            <p className="commerce-info">
              {t(
                'Giá trị mới áp dụng cho hoạt động tiếp theo. Thay đổi XP mỗi cấp sẽ tính lại cấp độ theo tổng XP hiện có; phần thưởng đã nhận không được cấp lại.',
              )}
            </p>
          </section>
          <div className="commerce-toolbar">
            <Button variant={trash ? 'contained' : 'outlined'} onClick={() => setTrash(value => !value)}>
              {t(trash ? 'Xem danh sách' : 'Thùng rác')}
            </Button>
          </div>
          <CommerceTable
            paginate
            pagination={tablePagination}
            rowKey="code"
            rows={resource.data.rewards.filter(item => Boolean(item.deletedAt) === trash)}
            columns={[
              ['Mốc phần thưởng', 'code'],
              ['Tên', r => t(r.label)],
              [
                'Điều kiện',
                r =>
                  r.metric === 'FIRST_LESSON'
                    ? t(metricLabels[r.metric])
                    : `${t(metricLabels[r.metric] || r.metric)} ≥ ${r.threshold}`,
              ],
              ['Gem', 'gems'],
              [
                'Trạng thái',
                r => (
                  <span className={`admin-pill ${r.active ? 'green' : ''}`}>
                    {t(r.active ? 'Đang áp dụng' : 'Đã tắt')}
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
                        can(user, 'ENGAGEMENT_CONFIG_UPDATE') && {
                          kind: 'edit',
                          label: 'Chỉnh sửa',
                          onClick: () => setForm({ ...r, kind: 'reward', reason: '' }),
                        },
                      can(user, 'REWARD_DELETE') && {
                        kind: r.deletedAt ? 'restore' : 'delete',
                        label: r.deletedAt ? 'Khôi phục' : 'Xóa phần thưởng',
                        onClick: () => setRemoving(r),
                      },
                    ]}
                  />
                ),
              ],
            ]}
          />
        </>
      )}
      {detail && (
        <AdminDetailsDialog title="Chi tiết phần thưởng" onClose={() => setDetail(null)}>
          <strong>{t(detail.label)}</strong>
          <p>
            {detail.code} · {t(metricLabels[detail.metric] || detail.metric)} ≥ {detail.threshold} ·{' '}
            {detail.gems} Gem
          </p>
        </AdminDetailsDialog>
      )}
      {removing && (
        <AdminDeleteDialog
          item={removing}
          restore={Boolean(removing.deletedAt)}
          onClose={() => setRemoving(null)}
          onSubmit={payload =>
            removing.deletedAt
              ? api.restoreReward(removing.code, payload)
              : api.deleteReward(removing.code, payload)
          }
          onSaved={() => {
            setRemoving(null);
            resource.reload();
          }}
        />
      )}
      {form && (
        <AdminActionDialog
          title={
            form.kind === 'settings'
              ? 'Chỉnh sửa quy tắc'
              : form.create
                ? 'Thêm phần thưởng'
                : 'Chỉnh sửa phần thưởng'
          }
          onClose={() => setForm(null)}
          onSubmit={() =>
            form.kind === 'settings'
              ? api.saveSettings({
                  ...form,
                  lessonXp: Number(form.lessonXp),
                  quizXp: Number(form.quizXp),
                  dailyGems: Number(form.dailyGems),
                  xpPerLevel: Number(form.xpPerLevel),
                })
              : form.create
                ? api.createReward({ ...form, gems: Number(form.gems), threshold: Number(form.threshold) })
                : api.updateReward(form.code, {
                    ...form,
                    gems: Number(form.gems),
                    threshold: Number(form.threshold),
                  })
          }
          onSaved={() => {
            setForm(null);
            resource.reload();
          }}
        >
          {form.kind === 'settings' ? (
            Object.entries(labels).map(([key, label]) => (
              <Field
                key={key}
                label={label}
                required
                type="number"
                step="1"
                min={key === 'dailyGems' ? 0 : 1}
                max="100000"
                value={form[key]}
                onChange={e => setForm({ ...form, [key]: e.target.value })}
              />
            ))
          ) : (
            <>
              <Field
                label="Mã phần thưởng"
                required
                pattern="[A-Z][A-Z0-9_]{1,31}"
                maxLength={32}
                disabled={!form.create}
                value={form.code}
                onChange={e => setForm({ ...form, code: e.target.value.toUpperCase() })}
              />
              <Field
                label="Tên phần thưởng"
                required
                maxLength={120}
                value={form.label}
                onChange={e => setForm({ ...form, label: e.target.value })}
              />
              <Field label="Điều kiện">
                <select
                  value={form.metric}
                  onChange={e =>
                    setForm({
                      ...form,
                      metric: e.target.value,
                      threshold: e.target.value === 'FIRST_LESSON' ? 1 : form.threshold,
                    })
                  }
                >
                  {[
                    ['FIRST_LESSON', 'Bài học đầu tiên'],
                    ['STREAK', 'Chuỗi học'],
                    ['LEVEL', 'Cấp độ'],
                  ].map(([value, label]) => (
                    <option key={value} value={value}>
                      {t(label)}
                    </option>
                  ))}
                </select>
              </Field>
              <Field
                label="Ngưỡng đạt"
                type="number"
                required
                min="1"
                max="10000"
                disabled={form.metric === 'FIRST_LESSON'}
                value={form.threshold}
                onChange={e => setForm({ ...form, threshold: e.target.value })}
              />
              <Field
                label="Gem"
                required
                type="number"
                min="0"
                max="1000000"
                step="1"
                value={form.gems}
                onChange={e => setForm({ ...form, gems: e.target.value })}
              />
              <label className="commerce-check">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={e => setForm({ ...form, active: e.target.checked })}
                />
                {t('Bật phần thưởng')}
              </label>
            </>
          )}
          <ReasonField value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} />
        </AdminActionDialog>
      )}
    </>
  );
}
