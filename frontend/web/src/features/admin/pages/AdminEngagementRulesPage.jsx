import { useCallback, useState } from 'react';
import { Button } from '@mui/material';
import { commerceAdminApi as api } from '../api/commerceAdminApi';
import useLearningResource from '../../learning/hooks/useLearningResource';
import useAuth from '../../auth/hooks/useAuth';
import { can } from '../utils/adminUtils';
import { LoadState, PageHeading } from '../components/AdminUi';
import { AdminActionDialog, CommerceTable, Field, ReasonField } from '../components/CommerceAdminUi';
import { t } from '../../../shared/i18n/locale';
import useLocale from '../../../shared/i18n/useLocale';
const labels = {
  lessonXp: 'XP hoàn thành bài học',
  quizXp: 'XP nộp quiz lần đầu',
  dailyGems: 'Gem mỗi ngày học',
  xpPerLevel: 'XP mỗi cấp độ',
};
export default function AdminEngagementRulesPage() {
  useLocale();
  const { user } = useAuth();
  const [form, setForm] = useState(null);
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
      />
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
              <Button onClick={() => setForm({ ...resource.data.settings, kind: 'settings', reason: '' })}>
                {t('Chỉnh sửa quy tắc')}
              </Button>
            )}
            <p className="commerce-info">
              {t(
                'Giá trị mới áp dụng cho hoạt động tiếp theo. Thay đổi XP mỗi cấp sẽ tính lại cấp độ theo tổng XP hiện có; phần thưởng đã nhận không được cấp lại.',
              )}
            </p>
          </section>
          <CommerceTable
            rowKey="code"
            rows={resource.data.rewards}
            columns={[
              ['Mốc phần thưởng', 'code'],
              ['Gem', 'gems'],
              ['Trạng thái', r => t(r.active ? 'Đang áp dụng' : 'Đã tắt')],
              [
                'Thao tác',
                r =>
                  can(user, 'ENGAGEMENT_CONFIG_UPDATE') ? (
                    <Button onClick={() => setForm({ ...r, kind: 'reward', reason: '' })}>
                      {t('Chỉnh sửa')}
                    </Button>
                  ) : (
                    '—'
                  ),
              ],
            ]}
          />
        </>
      )}
      {form && (
        <AdminActionDialog
          title={form.kind === 'settings' ? 'Chỉnh sửa quy tắc' : 'Chỉnh sửa phần thưởng'}
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
              : api.saveReward(form.code, { ...form, gems: Number(form.gems) })
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
              <strong>{form.code}</strong>
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
