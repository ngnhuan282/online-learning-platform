import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { engagementApi } from '../api/engagementApi';
import useLearningResource from '../../learning/hooks/useLearningResource';
import { ActionError, WorkspaceState } from '../components/WorkspaceUi';
import { t, getIntlLocale } from '../../../shared/i18n/locale';
import useLocale from '../../../shared/i18n/useLocale';
import useWorkspaceMutation from '../hooks/useWorkspaceMutation';
import LearnerAvatar from '../../../shared/components/LearnerAvatar';

const rewards = {
  FIRST_LESSON: ['🌱', 'Bài học đầu tiên'],
  STREAK_3: ['🔥', 'Chuỗi 3 ngày'],
  STREAK_7: ['⭐', 'Chuỗi 7 ngày'],
  STREAK_30: ['🏆', 'Chuỗi 30 ngày'],
  LEVEL_5: ['🚀', 'Đạt cấp độ 5'],
};

export default function AchievementsPage() {
  useLocale();
  const load = useCallback(options => engagementApi.summary(options), []);
  const resource = useLearningResource(load, null);
  const mutation = useWorkspaceMutation();
  const [notice, setNotice] = useState('');
  const data = resource.data;
  function claim(code) {
    setNotice('');
    mutation.run(
      () => engagementApi.claim(code),
      () => {
        setNotice('Đã nhận phần thưởng!');
        resource.reload();
      },
    );
  }
  const dayCounts = new Map((data?.days || []).map(day => [day.date, day.count]));
  const calendar = data
    ? Array.from({ length: 90 }, (_, i) => {
        const date = new Date(`${data.today}T12:00:00Z`);
        date.setUTCDate(date.getUTCDate() - 89 + i);
        return date.toISOString().slice(0, 10);
      })
    : [];
  return (
    <section className="community-workspace container">
      <header className="workspace-heading">
        <div>
          <span className="eyebrow">ChitChatGo · GROW</span>
          <h1>{t('Thành tích học tập')}</h1>
          <p>{t('Học đều mỗi ngày, tiến bộ từng bước.')}</p>
        </div>
        <Link className="button button-outline" to="/leaderboard">
          {t('Bảng xếp hạng')}
        </Link>
      </header>
      <WorkspaceState loading={resource.loading} error={resource.error} retry={resource.reload} />
      {data && !resource.error && (
        <>
          <div className="engagement-stats">
            {[
              [
                '🔥',
                'Chuỗi ngày học',
                data.currentStreak === 1 ? t('1 ngày') : t('{days} ngày', { days: data.currentStreak }),
              ],
              ['🏅', 'Chuỗi dài nhất', data.longestStreak],
              ['⚡', 'Tổng XP', data.totalXp.toLocaleString(getIntlLocale())],
              ['💎', 'Kim cương', data.gems],
            ].map(([icon, label, value]) => (
              <article className="workspace-card" key={label}>
                <span aria-hidden="true">{icon}</span>
                <p>{t(label)}</p>
                <strong>{value}</strong>
              </article>
            ))}
          </div>
          <article className="workspace-card level-card">
            <h2>
              <LearnerAvatar
                name={data.displayName}
                frame={data.activeFrame}
                assetKey={data.activeFrameAssetKey}
              />{' '}
              {t('Cấp độ {level}', { level: data.level })}
            </h2>
            <progress max={data.xpPerLevel} value={data.xpInLevel} aria-label={t('Cấp độ')} />
            <span>
              {data.xpInLevel} / {data.xpPerLevel} XP
            </span>
            <p>
              {t(
                data.activeToday
                  ? 'Bạn đã học hôm nay!'
                  : 'Hoàn thành một bài học hoặc nộp quiz để giữ chuỗi.',
              )}
            </p>
          </article>
          <article className="workspace-card">
            <h2>{t('Hoạt động 90 ngày gần đây')}</h2>
            <div className="activity-calendar">
              {calendar.map(date => (
                <span
                  key={date}
                  className={
                    dayCounts.has(date)
                      ? 'activity-day active'
                      : data.frozenDays?.includes(date)
                        ? 'activity-day frozen'
                        : 'activity-day'
                  }
                  role="img"
                  aria-label={
                    data.frozenDays?.includes(date)
                      ? t('{date}: được bảo vệ bằng freeze', { date })
                      : t('{date}: {count} hoạt động', { date, count: dayCounts.get(date) || 0 })
                  }
                  title={
                    data.frozenDays?.includes(date)
                      ? t('{date}: được bảo vệ bằng freeze', { date })
                      : t('{date}: {count} hoạt động', { date, count: dayCounts.get(date) || 0 })
                  }
                />
              ))}
            </div>
            <p className="workspace-muted">
              {t('Chưa học')} ▫ · ▪ {t('Đã học')}
              {' · ❄ '}
              {t('Được bảo vệ bằng freeze')}
            </p>
          </article>
          <h2>{t('Huy hiệu & phần thưởng')}</h2>
          <p>
            <Link to="/shop">{t('Cửa hàng & kho đồ')}</Link> · ❄ {data.streakFreezes ?? 0} / 7
          </p>
          <ActionError error={mutation.error} />
          {notice && <p role="status">{t(notice)}</p>}
          <div className="reward-grid">
            {data.rewards.map(reward => (
              <article
                className={`workspace-card reward-card ${reward.claimed ? 'claimed' : ''}`}
                key={reward.code}
              >
                <span className="reward-icon" aria-hidden="true">
                  {rewards[reward.code]?.[0] || '🏅'}
                </span>
                <h3>{t(reward.label || rewards[reward.code]?.[1] || reward.code)}</h3>
                <p>💎 +{reward.gems}</p>
                <button
                  className="button button-primary"
                  disabled={!reward.eligible || reward.claimed || mutation.busy}
                  onClick={() => claim(reward.code)}
                >
                  {t(reward.claimed ? 'Đã nhận' : reward.eligible ? 'Nhận thưởng' : 'Chưa mở khóa')}
                </button>
                {reward.claimed && (
                  <button
                    className="text-button"
                    disabled={mutation.busy}
                    onClick={() =>
                      mutation.run(
                        () => engagementApi.equipFrame(data.activeFrame === reward.code ? null : reward.code),
                        resource.reload,
                      )
                    }
                  >
                    {t(data.activeFrame === reward.code ? 'Bỏ khung đại diện' : 'Dùng khung đại diện')}
                  </button>
                )}
              </article>
            ))}
          </div>
          <article className="workspace-card">
            <h2>{t('Quy tắc tính điểm')}</h2>
            <p>
              {t(
                'Hoàn thành bài học lần đầu: +{lessonXp} XP. Nộp quiz có trả lời lần đầu: +{quizXp} XP. Mỗi {xpPerLevel} XP lên một cấp.',
                {
                  lessonXp: data.lessonXp ?? 20,
                  quizXp: data.quizXp ?? 10,
                  xpPerLevel: data.xpPerLevel ?? 100,
                },
              )}
            </p>
            <p>
              {t('Mỗi ngày có hoạt động học hợp lệ nhận {gems} kim cương, tối đa một lần mỗi ngày.', {
                gems: data.dailyGems ?? 25,
              })}
            </p>
            <p>
              {t(
                'Ngày học tính theo giờ Việt Nam. Làm lại quiz có trả lời vẫn duy trì streak, nhưng không cộng lại XP. Kim cương là phần thưởng trong ứng dụng.',
              )}
            </p>
          </article>
        </>
      )}
    </section>
  );
}
