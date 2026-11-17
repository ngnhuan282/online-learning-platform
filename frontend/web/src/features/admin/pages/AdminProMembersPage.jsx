import { useCallback, useState } from 'react';
import { Button } from '@mui/material';
import { Add, LockOutlined, LockOpenOutlined } from '@mui/icons-material';
import { proApi } from '../../pro/api/proApi';
import { commerceAdminApi as api } from '../api/commerceAdminApi';
import useLearningResource from '../../learning/hooks/useLearningResource';
import useAuth from '../../auth/hooks/useAuth';
import { can, date } from '../utils/adminUtils';
import { LoadState, PageHeading } from '../components/AdminUi';
import {
  AdminActionDialog,
  CommerceTable,
  CommercePager,
  CommerceSearch,
  Field,
  ReasonField,
  AdminRowActions,
  AdminDetailsDialog,
} from '../components/CommerceAdminUi';
import { t } from '../../../shared/i18n/locale';
import useLocale from '../../../shared/i18n/useLocale';
const memberStatus = m =>
  m.suspended
    ? 'Tạm khóa'
    : m.active || (m.expiresAt && Date.parse(m.expiresAt) > Date.now())
      ? 'Đang hoạt động'
      : m.expiresAt
        ? 'Đã hết hạn'
        : 'Miễn phí';
export default function AdminProMembersPage() {
  useLocale();
  const { user } = useAuth();
  const [draft, setDraft] = useState(''),
    [keyword, setKeyword] = useState(''),
    [page, setPage] = useState(0),
    [size, setSize] = useState(20),
    [selected, setSelected] = useState(null),
    [creating, setCreating] = useState(false);
  const load = useCallback(options => api.members({ keyword, page, size }, options), [keyword, page, size]);
  const resource = useLearningResource(load, null);
  return (
    <>
      <PageHeading
        title="Thành viên Pro"
        description="Tra cứu thời hạn, cấp Pro quản trị và quản lý trạng thái truy cập."
      >
        {can(user, 'PRO_MEMBER_MANAGE') && (
          <Button variant="contained" startIcon={<Add />} onClick={() => setCreating(true)}>
            {t('Cấp Pro')}
          </Button>
        )}
      </PageHeading>
      <CommerceSearch
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onSubmit={() => {
          setKeyword(draft);
          setPage(0);
        }}
      />
      <LoadState loading={resource.loading} error={resource.error} retry={resource.reload} />
      {resource.data && !resource.error && (
        <>
          <CommerceTable
            rowKey="userId"
            rows={resource.data.content}
            columns={[
              ['ID học viên', 'userId'],
              ['Học viên', 'displayName'],
              ['Gói', 'planCode'],
              ['Hạn Pro', r => (r.expiresAt ? date(r.expiresAt) : '—')],
              [
                'Trạng thái',
                r => (
                  <span
                    className={`admin-pill ${r.suspended ? 'amber' : r.expiresAt && Date.parse(r.expiresAt) > Date.now() ? 'green' : r.expiresAt ? 'red' : ''}`}
                  >
                    {t(memberStatus(r))}
                  </span>
                ),
              ],
              [
                'Thao tác',
                r => (
                  <AdminRowActions
                    actions={[{ kind: 'view', label: 'Xem chi tiết', onClick: () => setSelected(r) }]}
                  />
                ),
              ],
            ]}
          />
          <CommercePager
            data={resource.data}
            page={page}
            onChange={setPage}
            size={size}
            onSizeChange={value => {
              setSize(value);
              setPage(0);
            }}
          />
        </>
      )}
      {creating && (
        <CreateGrant
          onClose={() => setCreating(false)}
          onSaved={() => {
            setCreating(false);
            resource.reload();
          }}
        />
      )}
      {selected && (
        <MemberEditor
          key={selected.userId}
          member={selected}
          user={user}
          onClose={() => {
            setSelected(null);
            resource.reload();
          }}
        />
      )}
    </>
  );
}
function CreateGrant({ onClose, onSaved }) {
  const load = useCallback(options => proApi.plans(options), []);
  const resource = useLearningResource(load, null);
  const [form, setForm] = useState({ userId: '', planCode: '', reason: '', requestId: crypto.randomUUID() });
  const planCode = form.planCode || resource.data?.[0]?.code || '';
  const change = key => event =>
    setForm({ ...form, [key]: event.target.value, requestId: crypto.randomUUID() });
  return (
    <AdminActionDialog
      title="Cấp Pro"
      onClose={onClose}
      onSubmit={() =>
        api.grant(Number(form.userId), { planCode, requestId: form.requestId, reason: form.reason })
      }
      onSaved={onSaved}
    >
      <LoadState loading={resource.loading} error={resource.error} retry={resource.reload} />
      <Field
        label="ID học viên"
        type="number"
        required
        min="1"
        max="9007199254740991"
        step="1"
        value={form.userId}
        onChange={change('userId')}
      />
      <Field label="Gói Pro">
        <select required value={planCode} onChange={change('planCode')}>
          <option value="" disabled>
            {t('Chọn gói Pro')}
          </option>
          {resource.data?.map(plan => (
            <option value={plan.code} key={plan.code}>
              {t(plan.name || plan.code)} · {plan.durationMonths} {t('tháng')}
            </option>
          ))}
        </select>
      </Field>
      <ReasonField value={form.reason} onChange={change('reason')} />
    </AdminActionDialog>
  );
}
function MemberEditor({ member, user, onClose }) {
  const id = member.userId;
  const load = useCallback(
    async options => {
      const [member, plans] = await Promise.all([api.member(id, options), proApi.plans(options)]);
      return { data: { ...member.data, plans: plans.data } };
    },
    [id],
  );
  const resource = useLearningResource(load, null);
  const [action, setAction] = useState(null);
  const [grantDetail, setGrantDetail] = useState(null);
  const membership = resource.data?.membership;
  return (
    <>
      <AdminActionDialog
        title="Chi tiết thành viên Pro"
        onClose={onClose}
        onSubmit={() => Promise.resolve({})}
        onSaved={onClose}
        actionLabel="Đóng"
      >
        <strong>
          {member.displayName} · #{id}
        </strong>
        <LoadState loading={resource.loading} error={resource.error} retry={resource.reload} />
        {membership && (
          <>
            <p>
              {t(memberStatus(membership))} · {membership.expiresAt ? date(membership.expiresAt) : '—'}
            </p>
            {can(user, 'PRO_MEMBER_MANAGE') && (
              <div className="commerce-actions">
                <Button
                  startIcon={<Add />}
                  disabled={!resource.data.plans.length}
                  onClick={() =>
                    setAction({
                      kind: 'grant',
                      planCode: resource.data.plans[0].code,
                      reason: '',
                      requestId: crypto.randomUUID(),
                    })
                  }
                >
                  {t('Cấp Pro')}
                </Button>
                {membership.expiresAt && (
                  <Button
                    startIcon={membership.suspended ? <LockOpenOutlined /> : <LockOutlined />}
                    color={membership.suspended ? 'primary' : 'warning'}
                    onClick={() =>
                      setAction({
                        kind: 'suspend',
                        suspended: !membership.suspended,
                        reason: '',
                        version: membership.version,
                      })
                    }
                  >
                    {t(membership.suspended ? 'Mở lại Pro' : 'Tạm khóa Pro')}
                  </Button>
                )}
              </div>
            )}
            <p className="commerce-info">
              {t(
                'Tạm khóa chỉ chặn quyền Pro, không hoàn tiền và không ảnh hưởng khóa học đã mua riêng. Mở lại vẫn dùng hạn cũ. Chỉ thu hồi trực tiếp khoản Pro do quản trị cấp.',
              )}
            </p>
            <CommerceTable
              paginate
              rows={resource.data.grants}
              columns={[
                ['Nguồn', 'sourceType'],
                ['Gói', 'planCode'],
                ['Ngày cấp', r => date(r.grantedAt)],
                ['Người cấp', 'actorId'],
                ['Lý do', 'adminReason'],
                ['Trạng thái', r => t(r.revokedAt ? 'Đã thu hồi' : 'Đã cấp')],
                [
                  'Thao tác',
                  r => (
                    <AdminRowActions
                      actions={[
                        { kind: 'view', label: 'Xem chi tiết', onClick: () => setGrantDetail(r) },
                        can(user, 'PRO_MEMBER_MANAGE') &&
                          r.sourceType === 'ADMIN' &&
                          !r.revokedAt && {
                            kind: 'edit',
                            label: 'Chỉnh sửa',
                            onClick: () => setAction({ ...r, kind: 'edit', grantId: r.id, reason: '' }),
                          },
                        can(user, 'PRO_MEMBER_MANAGE') &&
                          r.sourceType === 'ADMIN' &&
                          !r.revokedAt && {
                            kind: 'delete',
                            label: 'Thu hồi',
                            onClick: () => setAction({ kind: 'revoke', grantId: r.id, reason: '' }),
                          },
                      ]}
                    />
                  ),
                ],
              ]}
            />
          </>
        )}
      </AdminActionDialog>
      {grantDetail && (
        <AdminDetailsDialog title="Chi tiết cấp Pro" onClose={() => setGrantDetail(null)}>
          <strong>{grantDetail.planCode}</strong>
          <p>
            {grantDetail.sourceType} · {date(grantDetail.grantedAt)}
          </p>
          <p>{grantDetail.adminReason}</p>
        </AdminDetailsDialog>
      )}
      {action && (
        <AdminActionDialog
          title={
            action.kind === 'grant'
              ? 'Cấp Pro'
              : action.kind === 'edit'
                ? 'Chỉnh sửa Pro quản trị'
                : action.kind === 'suspend'
                  ? action.suspended
                    ? 'Tạm khóa Pro'
                    : 'Mở lại Pro'
                  : 'Thu hồi Pro quản trị'
          }
          onClose={() => setAction(null)}
          onSubmit={() =>
            action.kind === 'grant'
              ? api.grant(id, {
                  planCode: action.planCode,
                  requestId: action.requestId,
                  reason: action.reason,
                })
              : action.kind === 'edit'
                ? api.updateGrant(id, action.grantId, {
                    planCode: action.planCode,
                    version: action.version,
                    reason: action.reason,
                  })
                : action.kind === 'suspend'
                  ? api.suspend(id, {
                      suspended: action.suspended,
                      version: action.version,
                      reason: action.reason,
                    })
                  : api.revokeGrant(id, action.grantId, { reason: action.reason })
          }
          onSaved={() => {
            setAction(null);
            resource.reload();
          }}
        >
          <strong>
            {member.displayName} · #{id}
          </strong>
          {['grant', 'edit'].includes(action.kind) && (
            <Field label="Gói Pro">
              <select
                value={action.planCode}
                onChange={e =>
                  setAction({ ...action, planCode: e.target.value, requestId: crypto.randomUUID() })
                }
              >
                {action.planCode && !resource.data.plans.some(plan => plan.code === action.planCode) && (
                  <option value={action.planCode}>
                    {action.planCode} · {t('Ngừng bán')}
                  </option>
                )}
                {resource.data.plans.map(plan => (
                  <option key={plan.code} value={plan.code}>
                    {t(plan.name || plan.code)} · {plan.durationMonths} {t('tháng')}
                  </option>
                ))}
              </select>
            </Field>
          )}
          <ReasonField
            value={action.reason}
            onChange={e =>
              setAction({
                ...action,
                reason: e.target.value,
                ...(action.kind === 'grant' ? { requestId: crypto.randomUUID() } : {}),
              })
            }
          />
        </AdminActionDialog>
      )}
    </>
  );
}
