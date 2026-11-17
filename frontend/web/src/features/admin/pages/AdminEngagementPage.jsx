import { useCallback, useState } from 'react';
import { Button } from '@mui/material';
import { Add, EditOutlined } from '@mui/icons-material';
import { commerceAdminApi as api } from '../api/commerceAdminApi';
import useLearningResource from '../../learning/hooks/useLearningResource';
import useAuth from '../../auth/hooks/useAuth';
import { can, date, number } from '../utils/adminUtils';
import { LoadState, PageHeading } from '../components/AdminUi';
import {
  AdminActionDialog,
  CommerceTable,
  CommercePager,
  CommerceSearch,
  Field,
  ReasonField,
  AdminRowActions,
} from '../components/CommerceAdminUi';
import { t } from '../../../shared/i18n/locale';
import useLocale from '../../../shared/i18n/useLocale';

export default function AdminEngagementPage() {
  useLocale();
  const { user } = useAuth();
  const [draft, setDraft] = useState(''),
    [keyword, setKeyword] = useState(''),
    [page, setPage] = useState(0),
    [size, setSize] = useState(20),
    [selected, setSelected] = useState(null);
  const load = useCallback(options => api.learners({ keyword, page, size }, options), [keyword, page, size]);
  const resource = useLearningResource(load, null);
  return (
    <>
      <PageHeading
        title="Gem, XP & cấp độ"
        description="Tra cứu học viên, điều chỉnh có lý do và xem lịch sử thay đổi."
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
              ['Gem', r => number(r.gems)],
              ['XP', r => number(r.totalXp)],
              ['Cấp độ', 'level'],
              ['Chuỗi học', 'currentStreak'],
              ['Freeze', 'streakFreezes'],
              [
                'Thao tác',
                r => (
                  <AdminRowActions
                    actions={[{ kind: 'view', label: 'Xem chi tiết', onClick: () => setSelected(r.userId) }]}
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
      {selected && (
        <LearnerEditor
          key={selected}
          id={selected}
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
function LearnerEditor({ id, user, onClose }) {
  const viewInventory = can(user, 'INVENTORY_VIEW');
  const manageInventory = can(user, 'INVENTORY_MANAGE');
  const load = useCallback(
    async options => {
      const [profile, history, inventory, items] = await Promise.all([
        api.learner(id, options),
        api.adjustments(id, options),
        viewInventory ? api.inventory(id, options) : Promise.resolve({ data: [] }),
        manageInventory ? api.items(options) : Promise.resolve({ data: [] }),
      ]);
      return {
        data: { profile: profile.data, history: history.data, inventory: inventory.data, items: items.data },
      };
    },
    [id, viewInventory, manageInventory],
  );
  const resource = useLearningResource(load, null);
  const operations = [
    ['gemsDelta', 'Điều chỉnh gem', 'GEM_ADJUST'],
    ['xpDelta', 'Điều chỉnh XP', 'XP_ADJUST'],
    ['targetLevel', 'Đặt cấp độ', 'XP_ADJUST'],
    ['freezesDelta', 'Điều chỉnh freeze', 'STREAK_ADJUST'],
    ['restoredStreak', 'Khôi phục chuỗi đến hôm qua', 'STREAK_ADJUST'],
  ].filter(([, , permission]) => can(user, permission));
  const [action, setAction] = useState(null);
  const [inventoryAction, setInventoryAction] = useState(null);
  const giftItems =
    resource.data?.items.filter(
      item =>
        item.itemType !== 'FREEZE' &&
        !item.deletedAt &&
        !resource.data.inventory.some(owned => owned.itemCode === item.code),
    ) || [];
  const p = resource.data?.profile;
  return (
    <>
      <AdminActionDialog
        title="Tài khoản học tập"
        onClose={onClose}
        onSubmit={() => Promise.resolve({})}
        onSaved={onClose}
        actionLabel="Đóng"
      >
        <LoadState loading={resource.loading} error={resource.error} retry={resource.reload} />
        {p && (
          <>
            <strong>
              {p.displayName} · #{id}
            </strong>
            <div className="commerce-stats">
              {[
                ['Gem', p.gems],
                ['XP', p.totalXp],
                ['Cấp độ', p.level],
                ['Chuỗi học', p.currentStreak],
                ['Freeze', p.streakFreezes],
              ].map(([label, value]) => (
                <div className="commerce-stat" key={label}>
                  <span>{t(label)}</span>
                  <strong>{number(value)}</strong>
                </div>
              ))}
            </div>
            {!!operations.length && (
              <Button
                startIcon={<EditOutlined />}
                type="button"
                variant="outlined"
                onClick={() =>
                  setAction({
                    kind: operations[0][0],
                    amount: '',
                    reason: '',
                    requestId: crypto.randomUUID(),
                  })
                }
              >
                {t('Điều chỉnh tài khoản học tập')}
              </Button>
            )}
            <p className="commerce-info">
              {t(
                'XP điều chỉnh thủ công thay đổi cấp độ, không cộng điểm thi đua trên bảng xếp hạng. Khôi phục chuỗi không tạo ngày học hoặc gem thưởng giả.',
              )}
            </p>
            {viewInventory && (
              <section>
                <h3>{t('Kho đồ học viên')}</h3>
                {manageInventory && (
                  <Button
                    startIcon={<Add />}
                    disabled={!giftItems.length}
                    onClick={() => setInventoryAction({ code: giftItems[0]?.code, owned: true, reason: '' })}
                  >
                    {t('Cấp vật phẩm')}
                  </Button>
                )}
                <CommerceTable
                  paginate
                  rowKey="itemCode"
                  rows={resource.data.inventory}
                  columns={[
                    ['Vật phẩm', r => t(r.nameKey)],
                    ['Ngày nhận', r => date(r.acquiredAt)],
                    ['Trạng thái', r => t(r.active ? 'Đang hiển thị' : 'Đã ẩn')],
                    [
                      'Thao tác',
                      r =>
                        manageInventory ? (
                          <AdminRowActions
                            actions={[
                              {
                                kind: 'delete',
                                label: 'Thu hồi vật phẩm',
                                onClick: () =>
                                  setInventoryAction({ code: r.itemCode, owned: false, reason: '' }),
                              },
                            ]}
                          />
                        ) : (
                          '—'
                        ),
                    ],
                  ]}
                />
              </section>
            )}
            <CommerceTable
              paginate
              rows={resource.data.history}
              columns={[
                ['Thời gian', r => date(r.createdAt)],
                ['Gem', r => `${r.gemsBefore} → ${r.gemsAfter}`],
                ['XP', r => `${r.xpBefore} → ${r.xpAfter}`],
                ['Freeze', r => `${r.freezesBefore} → ${r.freezesAfter}`],
                ['Người thực hiện', 'actorId'],
                ['Lý do', 'reason'],
              ]}
            />
          </>
        )}
      </AdminActionDialog>
      {inventoryAction && (
        <AdminActionDialog
          title={inventoryAction.owned ? 'Cấp vật phẩm' : 'Thu hồi vật phẩm'}
          onClose={() => setInventoryAction(null)}
          onSubmit={() =>
            api.saveInventory(id, inventoryAction.code, {
              owned: inventoryAction.owned,
              reason: inventoryAction.reason,
            })
          }
          onSaved={() => {
            setInventoryAction(null);
            resource.reload();
          }}
        >
          <strong>
            {p?.displayName} · #{id}
          </strong>
          {inventoryAction.owned ? (
            <Field label="Vật phẩm">
              <select
                required
                value={inventoryAction.code}
                onChange={e => setInventoryAction({ ...inventoryAction, code: e.target.value })}
              >
                {giftItems.map(item => (
                  <option value={item.code} key={item.code}>
                    {t(item.nameKey)} · {item.code}
                  </option>
                ))}
              </select>
            </Field>
          ) : (
            <strong>{inventoryAction.code}</strong>
          )}
          <p className="commerce-info">
            {t(
              'Cấp vật phẩm không trừ gem. Thu hồi vật phẩm không hoàn gem và sẽ tháo vật phẩm nếu học viên đang sử dụng.',
            )}
          </p>
          <ReasonField
            value={inventoryAction.reason}
            onChange={e => setInventoryAction({ ...inventoryAction, reason: e.target.value })}
          />
        </AdminActionDialog>
      )}
      {action && (
        <AdminActionDialog
          title="Xác nhận điều chỉnh"
          onClose={() => setAction(null)}
          onSubmit={() =>
            api.adjust(id, {
              requestId: action.requestId,
              reason: action.reason,
              gemsDelta: 0,
              xpDelta: 0,
              freezesDelta: 0,
              targetLevel: null,
              restoredStreak: null,
              [action.kind]: Number(action.amount),
            })
          }
          onSaved={() => {
            setAction(null);
            resource.reload();
          }}
        >
          <strong>
            {p?.displayName} · #{id}
          </strong>
          <Field label="Thao tác">
            <select
              value={action.kind}
              onChange={e =>
                setAction({ ...action, kind: e.target.value, amount: '', requestId: crypto.randomUUID() })
              }
            >
              {operations.map(([key, label]) => (
                <option value={key} key={key}>
                  {t(label)}
                </option>
              ))}
            </select>
          </Field>
          <Field
            label={
              action.kind === 'targetLevel' || action.kind === 'restoredStreak'
                ? 'Giá trị mới'
                : 'Số cộng / trừ (dùng số âm để trừ)'
            }
            type="number"
            step="1"
            required
            min={
              action.kind === 'targetLevel'
                ? 1
                : action.kind === 'restoredStreak'
                  ? 0
                  : action.kind === 'freezesDelta'
                    ? -7
                    : -1000000
            }
            max={
              action.kind === 'freezesDelta'
                ? 7
                : action.kind === 'targetLevel' || action.kind === 'restoredStreak'
                  ? 10000
                  : 1000000
            }
            value={action.amount}
            onChange={e => setAction({ ...action, amount: e.target.value, requestId: crypto.randomUUID() })}
          />
          {action.kind === 'targetLevel' && (
            <p className="commerce-info">{t('Đặt cấp độ sẽ đặt tổng XP về mốc bắt đầu của cấp đó.')}</p>
          )}
          <ReasonField
            value={action.reason}
            onChange={e => setAction({ ...action, reason: e.target.value, requestId: crypto.randomUUID() })}
          />
        </AdminActionDialog>
      )}
    </>
  );
}
