import { useCallback, useState } from 'react';
import { Button } from '@mui/material';
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
    [selected, setSelected] = useState(null);
  const load = useCallback(options => api.members({ keyword, page, size: 20 }, options), [keyword, page]);
  const resource = useLearningResource(load, null);
  return (
    <>
      <PageHeading
        title="Thành viên Pro"
        description="Tra cứu thời hạn, cấp Pro quản trị và quản lý trạng thái truy cập."
      />
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
              ['Trạng thái', r => t(memberStatus(r))],
              ['Thao tác', r => <Button onClick={() => setSelected(r)}>{t('Chi tiết')}</Button>],
            ]}
          />
          <CommercePager data={resource.data} page={page} onChange={setPage} />
        </>
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
function MemberEditor({ member, user, onClose }) {
  const id = member.userId;
  const load = useCallback(options => api.member(id, options), [id]);
  const resource = useLearningResource(load, null);
  const [action, setAction] = useState(null);
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
                  onClick={() =>
                    setAction({
                      kind: 'grant',
                      planCode: 'PRO_MONTH',
                      reason: '',
                      requestId: crypto.randomUUID(),
                    })
                  }
                >
                  {t('Cấp Pro')}
                </Button>
                {membership.expiresAt && (
                  <Button
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
                  r =>
                    can(user, 'PRO_MEMBER_MANAGE') && r.sourceType === 'ADMIN' && !r.revokedAt ? (
                      <Button
                        color="warning"
                        onClick={() => setAction({ kind: 'revoke', grantId: r.id, reason: '' })}
                      >
                        {t('Thu hồi')}
                      </Button>
                    ) : (
                      '—'
                    ),
                ],
              ]}
            />
          </>
        )}
      </AdminActionDialog>
      {action && (
        <AdminActionDialog
          title={
            action.kind === 'grant'
              ? 'Cấp Pro'
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
          {action.kind === 'grant' && (
            <Field label="Gói Pro">
              <select
                value={action.planCode}
                onChange={e =>
                  setAction({ ...action, planCode: e.target.value, requestId: crypto.randomUUID() })
                }
              >
                {[
                  ['PRO_MONTH', '1 tháng'],
                  ['PRO_QUARTER', '3 tháng'],
                  ['PRO_YEAR', '1 năm'],
                ].map(([code, label]) => (
                  <option key={code} value={code}>
                    {t(label)}
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
