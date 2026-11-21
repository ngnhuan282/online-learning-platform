import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { engagementApi } from '../api/engagementApi';
import useAuth from '../../auth/hooks/useAuth';
import useLearningResource from '../../learning/hooks/useLearningResource';
import { Pagination, WorkspaceState } from '../components/WorkspaceUi';
import { ROUTES } from '../../../shared/constants/routes';
import { t, getIntlLocale } from '../../../shared/i18n/locale';
import useLocale from '../../../shared/i18n/useLocale';
import LearnerAvatar from '../../../shared/components/LearnerAvatar';

export default function LeaderboardPage() {
  useLocale();
  const { user, isLoading: isAuthLoading } = useAuth();
  const [filter, setFilter] = useState({
    period: 'month',
    month: new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Ho_Chi_Minh',
      year: 'numeric',
      month: '2-digit',
    }).format(new Date()),
    page: 0,
  });
  const load = useCallback(options => engagementApi.leaderboard({ ...filter, size: 20 }, options), [filter]);
  const resource = useLearningResource(load, null, user?.id ?? 'guest', !isAuthLoading);
  const data = resource.data;
  const change = values => setFilter(current => ({ ...current, ...values, page: 0 }));

  const podiumEntries =
    filter.page === 0 && data?.content?.length >= 3
      ? [data.content[1], data.content[0], data.content[2]]
      : [];

  return (
    <section className="community-workspace container">
      <header className="workspace-heading">
        <div>
          <span className="eyebrow">ChitChatGo · TOGETHER</span>
          <h1>{t('Bảng xếp hạng')}</h1>
          <p>{t('Cùng nhau duy trì động lực học tiếng Anh.')}</p>
        </div>
        <Link className="button button-outline" to="/achievements">
          {t('Thành tích học tập')}
        </Link>
      </header>
      <div className="workspace-toolbar">
        <select
          aria-label={t('Bảng xếp hạng')}
          value={filter.period}
          onChange={e => change({ period: e.target.value })}
        >
          <option value="month">{t('Theo tháng')}</option>
          <option value="all">{t('Toàn thời gian')}</option>
        </select>
        {filter.period === 'month' && (
          <input
            type="month"
            aria-label={t('Tháng')}
            min="1970-01"
            max="2100-12"
            value={filter.month}
            onChange={e => {
              if (/^\d{4}-\d{2}$/.test(e.target.value)) change({ month: e.target.value });
            }}
          />
        )}
      </div>
      <WorkspaceState loading={resource.loading} error={resource.error} retry={resource.reload} />
      {data && !resource.error && (
        <>
          <p className="ranking-self">
            {user ? (
              <span>
                {data.me
                  ? t('Hạng của bạn: {rank}', { rank: data.me.rank })
                  : t('Chưa có điểm trong kỳ này. Hoàn thành bài học để tham gia!')}
              </span>
            ) : (
              <>
                <span>{t('Đăng nhập để theo dõi thứ hạng của bạn trên bảng xếp hạng.')}</span>
                <Link className="button button-soft" to={ROUTES.LOGIN} state={{ from: ROUTES.LEADERBOARD }}>
                  {t('Đăng nhập')}
                </Link>
              </>
            )}
          </p>

          {podiumEntries.length === 3 && (
            <div className="leaderboard-podium" aria-hidden="true">
              {podiumEntries.map(entry => (
                <div key={entry.userId} className={`podium-card rank-${entry.rank}`}>
                  <span className="podium-medal">{['🥇', '🥈', '🥉'][entry.rank - 1]}</span>
                  <LearnerAvatar
                    name={entry.displayName}
                    frame={entry.activeFrame}
                    assetKey={entry.activeFrameAssetKey}
                  />
                  <span className="podium-name">{entry.displayName}</span>
                  <span className="podium-xp">{entry.xp.toLocaleString(getIntlLocale())} XP</span>
                </div>
              ))}
            </div>
          )}

          <div className="workspace-table-wrap">
            <table className="ranking-table">
              <thead>
                <tr>
                  <th>{t('Hạng')}</th>
                  <th>{t('Học viên')}</th>
                  <th>{t('Cấp độ')}</th>
                  <th>XP</th>
                </tr>
              </thead>
              <tbody>
                {data.content.map(entry => (
                  <tr key={entry.userId} className={entry.userId === data.me?.userId ? 'is-me' : ''}>
                    <td>{entry.rank <= 3 ? ['🥇', '🥈', '🥉'][entry.rank - 1] : `#${entry.rank}`}</td>
                    <td>
                      <div className="ranking-learner-cell">
                        <LearnerAvatar
                          name={entry.displayName}
                          frame={entry.activeFrame}
                          assetKey={entry.activeFrameAssetKey}
                          size="small"
                        />
                        <span>
                          {entry.displayName}{' '}
                          {entry.userId === data.me?.userId && <small>({t('Bạn')})</small>}
                        </span>
                      </div>
                    </td>
                    <td>
                      <span className="ranking-level-pill">Lv.{entry.level}</span>
                    </td>
                    <td>{entry.xp.toLocaleString(getIntlLocale())} XP</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {data.content.length === 0 && (
            <p className="workspace-card">{t('Chưa có người học trong kỳ này.')}</p>
          )}
          <Pagination
            page={filter.page}
            totalPages={data.totalPages}
            disabled={resource.loading}
            onChange={page => setFilter(current => ({ ...current, page }))}
          />
        </>
      )}
    </section>
  );
}
