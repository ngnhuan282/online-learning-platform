import { useCallback, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { communityApi } from '../api/communityApi';
import useLearningResource from '../../learning/hooks/useLearningResource';
import useWorkspaceMutation from '../../engagement/hooks/useWorkspaceMutation';
import { Pagination, WorkspaceState } from '../../engagement/components/WorkspaceUi';
import PostEditor from '../components/PostEditor';
import { topicLabels } from '../utils/communityUi';
import { t, getIntlLocale } from '../../../shared/i18n/locale';
import useLocale from '../../../shared/i18n/useLocale';

const emptyTopics = [];
export default function CommunityPage() {
  useLocale();
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState(params.get('q') || '');
  const [editing, setEditing] = useState(false);
  const navigate = useNavigate();
  const mutation = useWorkspaceMutation();
  const page = Math.max(0, Number(params.get('page')) || 0);
  const topicId = params.get('topic') || '';
  const mode = params.get('mode') || '';
  const keyword = params.get('q') || '';
  const topics = useLearningResource(communityApi.topics, emptyTopics);
  const load = useCallback(
    options =>
      communityApi.posts(
        {
          page,
          size: 20,
          keyword,
          topicId: topicId || undefined,
          kind: ['DISCUSSION', 'QUESTION'].includes(mode) ? mode : undefined,
          unanswered: mode === 'unanswered',
        },
        options,
      ),
    [page, keyword, topicId, mode],
  );
  const posts = useLearningResource(load, null);
  function change(values) {
    const next = new URLSearchParams(params);
    next.delete('page');
    Object.entries(values).forEach(([key, value]) => (value ? next.set(key, value) : next.delete(key)));
    setParams(next);
  }
  return (
    <section className="community-workspace container">
      <header className="workspace-heading">
        <div>
          <span className="eyebrow">SGEdu · COMMUNITY</span>
          <h1>{t('Diễn đàn')}</h1>
          <p>{t('Hỏi đáp, chia sẻ kinh nghiệm và học cùng cộng đồng.')}</p>
        </div>
        <button
          className="button button-primary"
          disabled={topics.loading || !topics.data.length}
          onClick={() => setEditing(true)}
        >
          {t('Viết bài mới')}
        </button>
      </header>
      <form
        className="workspace-toolbar"
        role="search"
        onSubmit={event => {
          event.preventDefault();
          change({ q: search.trim() });
        }}
      >
        <input
          aria-label={t('Tìm kiếm')}
          placeholder={t('Tìm bài viết...')}
          maxLength={160}
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select aria-label={t('Chủ đề')} value={topicId} onChange={e => change({ topic: e.target.value })}>
          <option value="">{t('Tất cả chủ đề')}</option>
          {topics.data.map(topic => (
            <option key={topic.id} value={topic.id}>
              {t(topicLabels[topic.code] || topic.code)}
            </option>
          ))}
        </select>
        <select aria-label={t('Loại bài')} value={mode} onChange={e => change({ mode: e.target.value })}>
          <option value="">{t('Tất cả bài viết')}</option>
          <option value="DISCUSSION">{t('Thảo luận')}</option>
          <option value="QUESTION">{t('Hỏi đáp')}</option>
          <option value="unanswered">{t('Chưa giải đáp')}</option>
        </select>
        <button className="button button-outline">{t('Tìm kiếm')}</button>
      </form>
      <WorkspaceState
        loading={topics.loading || posts.loading}
        error={topics.error || posts.error}
        retry={() => {
          topics.reload();
          posts.reload();
        }}
      />
      {!posts.loading && !posts.error && posts.data?.content.length === 0 && (
        <p className="workspace-card">{t('Chưa có bài viết. Hãy bắt đầu cuộc trò chuyện!')}</p>
      )}
      <div className="post-list">
        {!posts.error &&
          posts.data?.content.map(post => (
            <article className="workspace-card post-preview" key={post.id}>
              <div className="post-tags">
                <span>{t(topicLabels[post.topicCode] || post.topicCode)}</span>
                <span>{t(post.kind === 'QUESTION' ? 'Hỏi đáp' : 'Thảo luận')}</span>
                {post.acceptedCommentId && <span className="answered">✓ {t('Đã giải đáp')}</span>}
                {post.locked && <span>🔒 {t('Đã khóa')}</span>}
              </div>
              <h2>
                <Link to={`/community/${post.id}`}>{post.title}</Link>
              </h2>
              <p className="post-excerpt">{post.body}</p>
              <div className="post-meta">
                <span>{post.authorName}</span>
                <time dateTime={post.createdAt}>
                  {new Date(post.createdAt).toLocaleDateString(getIntlLocale())}
                </time>
                <span>{t('{count} bình luận', { count: post.commentCount })}</span>
              </div>
            </article>
          ))}
      </div>
      {posts.data && (
        <Pagination
          page={page}
          totalPages={posts.data.totalPages}
          disabled={posts.loading}
          onChange={next => change({ page: String(next) })}
        />
      )}
      {editing && (
        <PostEditor
          topics={topics.data}
          busy={mutation.busy}
          error={mutation.error}
          onClose={() => setEditing(false)}
          onSave={payload =>
            mutation.run(
              () => communityApi.create(payload),
              response => navigate(`/community/${response.data.id}`),
            )
          }
        />
      )}
    </section>
  );
}
