import { useCallback, useState } from 'react';
import { Button } from '@mui/material';
import { Add } from '@mui/icons-material';
import { commerceAdminApi as api } from '../api/commerceAdminApi';
import useLearningResource from '../../learning/hooks/useLearningResource';
import useAuth from '../../auth/hooks/useAuth';
import { can, date } from '../utils/adminUtils';
import { LoadState, PageHeading } from '../components/AdminUi';
import {
  AdminActionDialog,
  AdminDetailsDialog,
  AdminDeleteDialog,
  AdminRowActions,
  CommerceTable,
  CommercePager,
  Field,
  ReasonField,
} from '../components/CommerceAdminUi';
import { t } from '../../../shared/i18n/locale';
import useLocale from '../../../shared/i18n/useLocale';

export default function AdminCommunityPage() {
  useLocale();
  const { user } = useAuth();
  const [hidden, setHidden] = useState(false),
    [page, setPage] = useState(0),
    [size, setSize] = useState(20);
  const [selected, setSelected] = useState(null),
    [form, setForm] = useState(null),
    [removing, setRemoving] = useState(null),
    [locking, setLocking] = useState(null);
  const load = useCallback(options => api.posts({ hidden, page, size }, options), [hidden, page, size]);
  const resource = useLearningResource(load, null);
  const saved = () => {
    setForm(null);
    setRemoving(null);
    setLocking(null);
    resource.reload();
  };
  return (
    <>
      <PageHeading
        title="Kiểm duyệt diễn đàn"
        description="Quản lý bài viết, bình luận và trạng thái thảo luận."
      >
        {can(user, 'COMMUNITY_CREATE') && (
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={() =>
              setForm({
                topicId: 1,
                kind: 'DISCUSSION',
                title: '',
                body: '',
                hidden: false,
                version: 0,
                reason: '',
              })
            }
          >
            {t('Thêm bài viết')}
          </Button>
        )}
      </PageHeading>
      <div className="commerce-toolbar">
        {[
          [false, 'Bài đang hiển thị'],
          [true, 'Bài đã ẩn'],
        ].map(([value, label]) => (
          <Button
            key={label}
            variant={hidden === value ? 'contained' : 'outlined'}
            onClick={() => {
              setHidden(value);
              setPage(0);
            }}
          >
            {t(label)}
          </Button>
        ))}
      </div>
      <LoadState loading={resource.loading} error={resource.error} retry={resource.reload} />
      {resource.data && !resource.error && (
        <>
          <CommerceTable
            rows={resource.data.content}
            columns={[
              ['Tiêu đề', 'title'],
              ['Tác giả', 'displayName'],
              ['Loại', 'kind'],
              ['Ngày tạo', r => date(r.createdAt)],
              [
                'Trạng thái',
                r => (
                  <span className={'admin-pill ' + (r.locked ? 'red' : 'green')}>
                    {t(r.locked ? 'Đã khóa' : 'Đang mở')}
                  </span>
                ),
              ],
              [
                'Thao tác',
                r => (
                  <AdminRowActions
                    actions={[
                      { kind: 'view', label: 'Xem chi tiết', onClick: () => setSelected(r) },
                      can(user, 'COMMUNITY_UPDATE') && {
                        kind: 'edit',
                        label: 'Chỉnh sửa',
                        onClick: () => setForm({ ...r, hidden: !!r.deletedAt, reason: '' }),
                      },
                      can(user, 'COMMUNITY_MODERATE') && {
                        kind: r.locked ? 'unlock' : 'lock',
                        label: r.locked ? 'Mở khóa' : 'Khóa thảo luận',
                        onClick: () => setLocking({ ...r, reason: '' }),
                      },
                      (can(user, 'COMMUNITY_DELETE') || can(user, 'COMMUNITY_MODERATE')) && {
                        kind: r.deletedAt ? 'restore' : 'delete',
                        label: r.deletedAt
                          ? 'Khôi phục'
                          : can(user, 'COMMUNITY_DELETE')
                            ? 'Xóa bài viết'
                            : 'Ẩn bài',
                        onClick: () => setRemoving(r),
                      },
                    ]}
                  />
                ),
              ],
            ]}
          />
          <CommercePager
            data={resource.data}
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
      {selected && (
        <PostDetails
          post={selected}
          user={user}
          onClose={() => {
            setSelected(null);
            resource.reload();
          }}
        />
      )}
      {form && <PostEditor form={form} setForm={setForm} onClose={() => setForm(null)} onSaved={saved} />}
      {removing && (
        <AdminDeleteDialog
          item={removing}
          title={!can(user, 'COMMUNITY_DELETE') ? (removing.deletedAt ? 'Khôi phục' : 'Ẩn bài') : undefined}
          actionLabel={
            !can(user, 'COMMUNITY_DELETE') ? (removing.deletedAt ? 'Khôi phục' : 'Ẩn bài') : undefined
          }
          description={
            removing.deletedAt
              ? 'Khôi phục nội dung. Nội dung vẫn tuân theo trạng thái hiển thị của luồng thảo luận.'
              : undefined
          }
          restore={!!removing.deletedAt}
          onClose={() => setRemoving(null)}
          onSubmit={payload =>
            !can(user, 'COMMUNITY_DELETE')
              ? api.moderate(removing.id, {
                  hidden: !removing.deletedAt,
                  locked: removing.locked,
                  reason: payload.reason,
                })
              : removing.deletedAt
                ? api.restorePost(removing.id, payload)
                : api.deletePost(removing.id, payload)
          }
          onSaved={saved}
        />
      )}
      {locking && (
        <AdminActionDialog
          title={locking.locked ? 'Mở khóa' : 'Khóa thảo luận'}
          onClose={() => setLocking(null)}
          onSubmit={() =>
            api.moderate(locking.id, {
              hidden: !!locking.deletedAt,
              locked: !locking.locked,
              reason: locking.reason,
            })
          }
          onSaved={saved}
        >
          <strong>{locking.title}</strong>
          <ReasonField
            value={locking.reason}
            onChange={e => setLocking({ ...locking, reason: e.target.value })}
          />
        </AdminActionDialog>
      )}
    </>
  );
}
function PostEditor({ form, setForm, onClose, onSaved }) {
  const change = key => event => setForm({ ...form, [key]: event.target.value });
  return (
    <AdminActionDialog
      title={form.id ? 'Chỉnh sửa bài viết' : 'Thêm bài viết'}
      onClose={onClose}
      onSubmit={() =>
        form.id
          ? api.updatePost(form.id, { ...form, topicId: Number(form.topicId) })
          : api.createPost({ ...form, topicId: Number(form.topicId) })
      }
      onSaved={onSaved}
    >
      <Field label="Chủ đề">
        <select value={form.topicId} onChange={change('topicId')}>
          {[
            [1, 'Học tập'],
            [2, 'IELTS / TOEIC'],
            [3, 'Hỏi đáp'],
            [4, 'Chia sẻ'],
          ].map(([value, label]) => (
            <option key={value} value={value}>
              {t(label)}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Loại">
        <select value={form.kind} onChange={change('kind')}>
          <option value="DISCUSSION">{t('Thảo luận')}</option>
          <option value="QUESTION">{t('Câu hỏi')}</option>
        </select>
      </Field>
      <Field label="Tiêu đề" required maxLength={160} value={form.title} onChange={change('title')} />
      <Field label="Nội dung">
        <textarea required maxLength={20000} rows={8} value={form.body} onChange={change('body')} />
      </Field>
      {!form.id && (
        <label className="commerce-check">
          <input
            type="checkbox"
            checked={form.hidden}
            onChange={e => setForm({ ...form, hidden: e.target.checked })}
          />
          {t('Lưu ở trạng thái ẩn')}
        </label>
      )}
      <ReasonField value={form.reason} onChange={change('reason')} />
    </AdminActionDialog>
  );
}
function PostDetails({ post, user, onClose }) {
  const load = useCallback(options => api.comments(post.id, options), [post.id]);
  const resource = useLearningResource(load, null);
  const [form, setForm] = useState(null),
    [removing, setRemoving] = useState(null),
    [detail, setDetail] = useState(null);
  const saved = () => {
    setForm(null);
    setRemoving(null);
    resource.reload();
  };
  return (
    <>
      <AdminDetailsDialog title="Chi tiết bài viết" onClose={onClose}>
        <strong>{post.title}</strong>
        <p>{post.displayName}</p>
        <div className="commerce-post-body">{post.body}</div>
        <div className="admin-card-heading">
          <h3>{t('Bình luận')}</h3>
          {can(user, 'COMMUNITY_CREATE') && (
            <Button startIcon={<Add />} onClick={() => setForm({ body: '', version: 0, reason: '' })}>
              {t('Thêm bình luận')}
            </Button>
          )}
        </div>
        <LoadState loading={resource.loading} error={resource.error} retry={resource.reload} />
        {resource.data && (
          <CommerceTable
            paginate
            rows={resource.data}
            columns={[
              ['Tác giả', 'displayName'],
              ['Nội dung', r => <div className="admin-text-preview">{r.body}</div>],
              ['Trạng thái', r => t(r.deletedAt ? 'Đã ẩn' : 'Đang hiển thị')],
              [
                'Thao tác',
                r => (
                  <AdminRowActions
                    actions={[
                      { kind: 'view', label: 'Xem chi tiết', onClick: () => setDetail(r) },
                      can(user, 'COMMUNITY_UPDATE') && {
                        kind: 'edit',
                        label: 'Chỉnh sửa',
                        onClick: () => setForm({ ...r, reason: '' }),
                      },
                      (can(user, 'COMMUNITY_DELETE') || can(user, 'COMMUNITY_MODERATE')) && {
                        kind: r.deletedAt ? 'restore' : 'delete',
                        label: r.deletedAt
                          ? 'Khôi phục'
                          : can(user, 'COMMUNITY_DELETE')
                            ? 'Xóa bình luận'
                            : 'Ẩn bình luận',
                        onClick: () => setRemoving(r),
                      },
                    ]}
                  />
                ),
              ],
            ]}
          />
        )}
      </AdminDetailsDialog>
      {detail && (
        <AdminDetailsDialog title="Chi tiết bình luận" onClose={() => setDetail(null)}>
          <strong>{detail.displayName}</strong>
          <div className="commerce-post-body">{detail.body}</div>
        </AdminDetailsDialog>
      )}
      {form && (
        <AdminActionDialog
          title={form.id ? 'Chỉnh sửa bình luận' : 'Thêm bình luận'}
          onClose={() => setForm(null)}
          onSubmit={() =>
            form.id ? api.updateComment(post.id, form.id, form) : api.createComment(post.id, form)
          }
          onSaved={saved}
        >
          <Field label="Nội dung">
            <textarea
              required
              maxLength={4000}
              rows={6}
              value={form.body}
              onChange={e => setForm({ ...form, body: e.target.value })}
            />
          </Field>
          <ReasonField value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} />
        </AdminActionDialog>
      )}
      {removing && (
        <AdminDeleteDialog
          item={{ ...removing, title: removing.body }}
          title={
            !can(user, 'COMMUNITY_DELETE') ? (removing.deletedAt ? 'Khôi phục' : 'Ẩn bình luận') : undefined
          }
          actionLabel={
            !can(user, 'COMMUNITY_DELETE') ? (removing.deletedAt ? 'Khôi phục' : 'Ẩn bình luận') : undefined
          }
          description={
            removing.deletedAt
              ? 'Khôi phục nội dung. Nội dung vẫn tuân theo trạng thái hiển thị của luồng thảo luận.'
              : undefined
          }
          restore={!!removing.deletedAt}
          onClose={() => setRemoving(null)}
          onSubmit={payload =>
            !can(user, 'COMMUNITY_DELETE')
              ? api.moderateComment(post.id, removing.id, {
                  hidden: !removing.deletedAt,
                  locked: false,
                  reason: payload.reason,
                })
              : removing.deletedAt
                ? api.restoreComment(post.id, removing.id, payload)
                : api.deleteComment(post.id, removing.id, payload)
          }
          onSaved={saved}
        />
      )}
    </>
  );
}
