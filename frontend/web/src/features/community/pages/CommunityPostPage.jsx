import { useCallback, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import useAuth from '../../auth/hooks/useAuth';
import { communityApi } from '../api/communityApi';
import { topicLabels } from '../utils/communityUi';
import useLearningResource from '../../learning/hooks/useLearningResource';
import useWorkspaceMutation from '../../engagement/hooks/useWorkspaceMutation';
import { ActionError, Pagination, WorkspaceState } from '../../engagement/components/WorkspaceUi';
import PostEditor from '../components/PostEditor';
import ConfirmDialog from '../../../shared/components/ConfirmDialog';
import { t, getIntlLocale } from '../../../shared/i18n/locale';
import useLocale from '../../../shared/i18n/useLocale';
import { can } from '../../admin/utils/adminUtils';

const emptyTopics = [];
function PostDetail({ id }) {
  useLocale();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [page, setPage] = useState(0);
  const [body, setBody] = useState('');
  const [editing, setEditing] = useState(false);
  const [commentEdit, setCommentEdit] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const mutation = useWorkspaceMutation();
  const load = useCallback(options => communityApi.post(id, options), [id]);
  const loadComments = useCallback(
    options => communityApi.comments(id, { page, size: 20 }, options),
    [id, page],
  );
  const postResource = useLearningResource(load, null);
  const comments = useLearningResource(loadComments, null);
  const topics = useLearningResource(communityApi.topics, emptyTopics);
  const post = postResource.data;
  const admin = user?.roles?.includes('ADMIN') || can(user, 'COMMUNITY_MODERATE');
  const owner = post && user?.id === post.authorId;
  const canWrite = post && (!post.locked || admin);
  const refresh = () => {
    postResource.reload();
    comments.reload();
  };
  const date = value => new Date(value).toLocaleString(getIntlLocale(), { timeZone: 'Asia/Ho_Chi_Minh' });
  function remove() {
    mutation.run(
      () =>
        deleting.type === 'post' ? communityApi.remove(id) : communityApi.removeComment(id, deleting.id),
      () => {
        if (deleting.type === 'post') navigate('/community');
        else {
          setDeleting(null);
          setPage(0);
          refresh();
        }
      },
    );
  }
  return (
    <section className="community-workspace container">
      <Link className="workspace-back" to="/community">
        ← {t('Quay lại diễn đàn')}
      </Link>
      <WorkspaceState loading={postResource.loading} error={postResource.error} retry={postResource.reload} />
      {post && !postResource.error && (
        <>
          <article className="workspace-card post-detail">
            <div className="post-tags">
              <span>{t(topicLabels[post.topicCode] || post.topicCode)}</span>
              <span>{t(post.kind === 'QUESTION' ? 'Hỏi đáp' : 'Thảo luận')}</span>
              {post.acceptedCommentId && <span className="answered">✓ {t('Đã giải đáp')}</span>}
            </div>
            <h1>{post.title}</h1>
            <div className="post-meta">
              <strong>{post.authorName}</strong>
              <time dateTime={post.createdAt}>{date(post.createdAt)}</time>
            </div>
            <div className="post-body">{post.body}</div>
            <div className="workspace-actions">
              {(owner || admin) && canWrite && (
                <>
                  <button
                    className="button button-outline"
                    disabled={mutation.busy}
                    onClick={() => setEditing(true)}
                  >
                    {t('Sửa')}
                  </button>
                  <button
                    className="button button-outline danger"
                    disabled={mutation.busy}
                    onClick={() => setDeleting({ type: 'post' })}
                  >
                    {t('Xóa')}
                  </button>
                </>
              )}
              {admin && (
                <button
                  className="button button-outline"
                  disabled={mutation.busy}
                  onClick={() => mutation.run(() => communityApi.lock(id, !post.locked), refresh)}
                >
                  {t(post.locked ? 'Mở lại thảo luận' : 'Khóa thảo luận')}
                </button>
              )}
            </div>
          </article>
          <ActionError error={mutation.error} />
          <h2>{t('{count} bình luận', { count: post.commentCount })}</h2>
          <WorkspaceState loading={comments.loading} error={comments.error} retry={comments.reload} />
          {!comments.loading && !comments.error && comments.data?.content.length === 0 && (
            <p>{t('Chưa có bình luận.')}</p>
          )}
          <div className="comment-list">
            {!comments.error &&
              comments.data?.content.map(comment => (
                <article
                  key={comment.id}
                  className={`workspace-card ${post.acceptedCommentId === comment.id ? 'accepted-comment' : ''}`}
                >
                  {post.acceptedCommentId === comment.id && (
                    <p className="answered">✓ {t('Lời giải được chọn')}</p>
                  )}
                  <div className="post-meta">
                    <strong>{comment.authorName}</strong>
                    <time dateTime={comment.createdAt}>{date(comment.createdAt)}</time>
                  </div>
                  {commentEdit?.id === comment.id ? (
                    <form
                      className="workspace-form"
                      onSubmit={event => {
                        event.preventDefault();
                        if (commentEdit.body.trim())
                          mutation.run(
                            () => communityApi.updateComment(id, comment.id, commentEdit.body),
                            () => {
                              setCommentEdit(null);
                              refresh();
                            },
                          );
                      }}
                    >
                      <textarea
                        required
                        maxLength={4000}
                        rows={4}
                        aria-label={t('Nội dung')}
                        value={commentEdit.body}
                        disabled={mutation.busy}
                        onChange={e => setCommentEdit(current => ({ ...current, body: e.target.value }))}
                      />
                      <div className="workspace-actions">
                        <button
                          className="button button-primary"
                          disabled={mutation.busy || !commentEdit.body.trim()}
                        >
                          {t('Lưu thay đổi')}
                        </button>
                        <button
                          type="button"
                          className="button button-outline"
                          disabled={mutation.busy}
                          onClick={() => setCommentEdit(null)}
                        >
                          {t('Hủy')}
                        </button>
                      </div>
                    </form>
                  ) : (
                    <p className="post-body">{comment.body}</p>
                  )}
                  <div className="workspace-actions">
                    {canWrite && (admin || user?.id === comment.authorId) && (
                      <>
                        <button
                          className="text-button"
                          disabled={mutation.busy}
                          onClick={() => setCommentEdit({ id: comment.id, body: comment.body })}
                        >
                          {t('Sửa')}
                        </button>
                        <button
                          className="text-button danger"
                          disabled={mutation.busy}
                          onClick={() => setDeleting({ type: 'comment', id: comment.id })}
                        >
                          {t('Xóa')}
                        </button>
                      </>
                    )}
                    {canWrite && (owner || admin) && post.kind === 'QUESTION' && (
                      <button
                        className="text-button"
                        disabled={mutation.busy}
                        onClick={() =>
                          mutation.run(
                            () =>
                              communityApi.answer(
                                id,
                                post.acceptedCommentId === comment.id ? null : comment.id,
                              ),
                            refresh,
                          )
                        }
                      >
                        {t(post.acceptedCommentId === comment.id ? 'Bỏ chọn lời giải' : 'Chọn làm lời giải')}
                      </button>
                    )}
                  </div>
                </article>
              ))}
          </div>
          {comments.data && (
            <Pagination
              page={page}
              totalPages={comments.data.totalPages}
              disabled={comments.loading}
              onChange={setPage}
            />
          )}
          {canWrite ? (
            <form
              className="workspace-card workspace-form"
              onSubmit={event => {
                event.preventDefault();
                if (body.trim())
                  mutation.run(
                    () => communityApi.addComment(id, body),
                    () => {
                      setBody('');
                      setPage(Math.floor(post.commentCount / 20));
                      refresh();
                    },
                  );
              }}
            >
              <label>
                {t('Bình luận')}
                <textarea
                  required
                  rows={4}
                  maxLength={4000}
                  value={body}
                  disabled={mutation.busy}
                  placeholder={t('Viết bình luận của bạn...')}
                  onChange={e => setBody(e.target.value)}
                />
              </label>
              <button className="button button-primary" disabled={mutation.busy || !body.trim()}>
                {t('Gửi bình luận')}
              </button>
            </form>
          ) : (
            <p role="status">🔒 {t('Bài viết đã khóa bình luận.')}</p>
          )}
          {editing && (
            <PostEditor
              post={post}
              topics={topics.data}
              busy={mutation.busy}
              error={mutation.error}
              onClose={() => setEditing(false)}
              onSave={payload =>
                mutation.run(
                  () => communityApi.update(id, payload),
                  () => {
                    setEditing(false);
                    refresh();
                  },
                )
              }
            />
          )}
        </>
      )}
      <ConfirmDialog
        open={Boolean(deleting)}
        title={t('Xác nhận xóa nội dung này?')}
        confirmLabel={t('Xóa')}
        destructive
        pending={mutation.busy}
        onClose={() => setDeleting(null)}
        onConfirm={remove}
      />
    </section>
  );
}

export default function CommunityPostPage() {
  const { id } = useParams();
  const { user } = useAuth();
  return <PostDetail key={`${id}:${user?.id}`} id={id} />;
}
