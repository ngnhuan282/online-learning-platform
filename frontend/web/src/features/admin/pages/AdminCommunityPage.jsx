import { useCallback, useState } from 'react';
import { Button } from '@mui/material';
import { commerceAdminApi as api } from '../api/commerceAdminApi';
import useLearningResource from '../../learning/hooks/useLearningResource';
import useAuth from '../../auth/hooks/useAuth';
import { can, date } from '../utils/adminUtils';
import { LoadState, PageHeading } from '../components/AdminUi';
import { AdminActionDialog, CommerceTable, CommercePager, ReasonField } from '../components/CommerceAdminUi';
import { t } from '../../../shared/i18n/locale';
import useLocale from '../../../shared/i18n/useLocale';
export default function AdminCommunityPage() {
  useLocale();
  const { user } = useAuth();
  const [hidden, setHidden] = useState(false),
    [page, setPage] = useState(0),
    [selected, setSelected] = useState(null),
    [action, setAction] = useState(null);
  const load = useCallback(options => api.posts({ hidden, page, size: 20 }, options), [hidden, page]);
  const resource = useLearningResource(load, null);
  function edit(post, kind) {
    setAction({
      post,
      hidden: kind === 'hidden' ? !post.deletedAt : !!post.deletedAt,
      locked: kind === 'locked' ? !post.locked : post.locked,
      reason: '',
    });
  }
  return (
    <>
      <PageHeading
        title="Kiểm duyệt diễn đàn"
        description="Xem bài viết, khóa thảo luận và ẩn / khôi phục nội dung."
      />
      <div className="commerce-toolbar">
        <Button
          variant={!hidden ? 'contained' : 'outlined'}
          onClick={() => {
            setHidden(false);
            setPage(0);
          }}
        >
          {t('Bài đang hiển thị')}
        </Button>
        <Button
          variant={hidden ? 'contained' : 'outlined'}
          onClick={() => {
            setHidden(true);
            setPage(0);
          }}
        >
          {t('Bài đã ẩn')}
        </Button>
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
              ['Trạng thái', r => t(r.locked ? 'Đã khóa' : 'Đang mở')],
              [
                'Thao tác',
                r => (
                  <div className="commerce-actions">
                    <Button onClick={() => setSelected(r)}>{t('Chi tiết')}</Button>
                    {can(user, 'COMMUNITY_MODERATE') && (
                      <>
                        <Button onClick={() => edit(r, 'locked')}>
                          {t(r.locked ? 'Mở khóa' : 'Khóa thảo luận')}
                        </Button>
                        <Button color="warning" onClick={() => edit(r, 'hidden')}>
                          {t(r.deletedAt ? 'Khôi phục' : 'Ẩn bài')}
                        </Button>
                      </>
                    )}
                  </div>
                ),
              ],
            ]}
          />
          <CommercePager data={resource.data} page={page} onChange={setPage} />
        </>
      )}
      {selected && (
        <PostDetails
          key={selected.id}
          post={selected}
          canModerate={can(user, 'COMMUNITY_MODERATE')}
          onClose={() => setSelected(null)}
        />
      )}
      {action && (
        <AdminActionDialog
          title="Xác nhận kiểm duyệt"
          onClose={() => setAction(null)}
          onSubmit={() =>
            api.moderate(action.post.id, {
              hidden: action.hidden,
              locked: action.locked,
              reason: action.reason,
            })
          }
          onSaved={() => {
            setAction(null);
            resource.reload();
          }}
        >
          <strong>{action.post.title}</strong>
          <p>
            {t(
              action.hidden
                ? 'Bài sẽ được ẩn khỏi diễn đàn.'
                : action.locked
                  ? 'Bài được hiển thị nhưng khóa thảo luận.'
                  : 'Bài được hiển thị và mở thảo luận.',
            )}
          </p>
          <ReasonField
            value={action.reason}
            onChange={e => setAction({ ...action, reason: e.target.value })}
          />
        </AdminActionDialog>
      )}
    </>
  );
}
function PostDetails({ post, canModerate, onClose }) {
  const load = useCallback(options => api.comments(post.id, options), [post.id]);
  const resource = useLearningResource(load, null);
  const [action, setAction] = useState(null);
  return (
    <>
      <AdminActionDialog
        title="Chi tiết bài viết"
        onClose={onClose}
        onSubmit={() => Promise.resolve({})}
        onSaved={onClose}
        actionLabel="Đóng"
      >
        <strong>{post.title}</strong>
        <p>{post.displayName}</p>
        <div className="commerce-post-body">{post.body}</div>
        <h3>{t('Bình luận')}</h3>
        <LoadState loading={resource.loading} error={resource.error} retry={resource.reload} />
        {resource.data?.map(comment => (
          <article className="commerce-comment" key={comment.id}>
            <strong>{comment.displayName}</strong>
            <p className="commerce-post-body">{comment.body}</p>
            <span>{t(comment.deletedAt ? 'Đã ẩn' : 'Đang hiển thị')}</span>
            {canModerate && (
              <Button onClick={() => setAction({ ...comment, reason: '' })}>
                {t(comment.deletedAt ? 'Khôi phục' : 'Ẩn bình luận')}
              </Button>
            )}
          </article>
        ))}
      </AdminActionDialog>
      {action && (
        <AdminActionDialog
          title="Xác nhận kiểm duyệt"
          onClose={() => setAction(null)}
          onSubmit={() =>
            api.moderateComment(post.id, action.id, {
              hidden: !action.deletedAt,
              locked: false,
              reason: action.reason,
            })
          }
          onSaved={() => {
            setAction(null);
            resource.reload();
          }}
        >
          <div className="commerce-post-body">{action.body}</div>
          <ReasonField
            value={action.reason}
            onChange={e => setAction({ ...action, reason: e.target.value })}
          />
        </AdminActionDialog>
      )}
    </>
  );
}
