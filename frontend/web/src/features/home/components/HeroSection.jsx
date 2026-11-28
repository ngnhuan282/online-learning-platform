import { useContext } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../../../shared/components/Icon';
import { ROUTES } from '../../../shared/constants/routes';
import { t } from '../../../shared/i18n/locale';
import useLocale from '../../../shared/i18n/useLocale';
import { AuthContext } from '../../auth/context/AuthContext';
import { dictationApi } from '../../dictation/api/dictationApi';
import { useDictationQuery } from '../../dictation/hooks/useDictationQuery';
import { formatTime, formatTopicName } from '../../dictation/utils/dictation';

const heroStats = [
  ['50,000+', 'Học viên toàn quốc'],
  ['8.5 IELTS', 'Điểm đầu ra kỷ lục'],
  ['24/7', 'Học mọi lúc, mọi nơi'],
];

function dictationLessonEntry({ id, attemptId, attemptCompleted }) {
  const attempt = attemptId ? `?attempt=${encodeURIComponent(attemptId)}` : '';
  return {
    to: `${ROUTES.DICTATION}/${encodeURIComponent(id)}${attempt}`,
    action: attemptCompleted ? 'Xem kết quả' : attempt ? 'Tiếp tục' : 'Bắt đầu',
    status: attemptCompleted ? 'Đã hoàn thành' : attempt ? 'Đang luyện' : 'Chưa luyện',
  };
}

function DictationPreview({ lesson }) {
  const title = lesson?.title ?? t('Thư viện bài nghe');
  const { to, action, status } = lesson
    ? dictationLessonEntry(lesson)
    : { to: ROUTES.DICTATION, action: 'Xem thư viện' };

  return (
    <div className="home-studio-wrap">
      <div className="home-studio">
        <div className="home-studio-toolbar">
          <span className="home-studio-dots" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          <span className="home-studio-name">ChitChatGo · {t('Luyện nghe chép chính tả')}</span>
          {lesson && <span className="home-studio-badge">{t('Bài nghe gợi ý')}</span>}
        </div>
        <Link className="home-studio-lesson" to={to} aria-label={`${title} · ${t(action)}`}>
          <div className="home-studio-cover">
            <img src={lesson ? '/images/home-frozen.jpg' : '/images/english-speaking.jpg'} alt="" />
            {lesson && (
              <div className="home-studio-cover-top">
                <span>{formatTopicName(lesson.topic)}</span>
                <b>{lesson.level}</b>
              </div>
            )}
            <div className="home-studio-cover-bottom">
              <span className="home-studio-play">
                <Icon name={lesson?.video ? 'play' : 'headset'} size={24} />
              </span>
              {lesson && (
                <>
                  <span>{lesson.video ? 'Video' : 'Audio'}</span>
                  <span className="home-studio-duration">
                    <Icon name="clock" size={16} /> {formatTime(lesson.duration)}
                  </span>
                </>
              )}
            </div>
          </div>
          <div className="home-studio-summary">
            <h2>{title}</h2>
            {lesson && (
              <span className={`home-studio-status${lesson.attemptCompleted ? ' is-complete' : ''}`}>
                {t(status)}
              </span>
            )}
          </div>
          {lesson && (
            <progress
              className="home-studio-progress"
              aria-label={t('Tiến độ bài nghe')}
              max={lesson.progressTotal ?? lesson.sentenceCount}
              value={lesson.completed ?? 0}
            />
          )}
          <div className="home-studio-footer">
            {lesson && <span>{t('{count} câu', { count: lesson.sentenceCount })}</span>}
            <span className="home-studio-action">
              {t(action)} <Icon name="arrow" size={16} />
            </span>
          </div>
        </Link>
      </div>
      {lesson && (
        <Link className="home-library-link" to={ROUTES.DICTATION}>
          <span className="home-library-icon">
            <Icon name="headset" size={22} />
          </span>
          {t('Thư viện bài nghe')} <Icon name="arrow" size={16} />
        </Link>
      )}
    </div>
  );
}

export default function HeroSection() {
  useLocale();
  const auth = useContext(AuthContext);
  const { data } = useDictationQuery(
    dictationApi.catalogPath,
    { keyword: 'In Summer (Olaf)', page: 0, size: 1 },
    { enabled: !auth?.isLoading && !auth?.isLoggingOut, scope: auth?.user?.id ?? 'guest' },
  );

  return (
    <section className="home-hero" aria-labelledby="home-title">
      <div className="container home-hero-layout">
        <div className="home-hero-copy">
          <span className="eyebrow-pill">{t('Nền tảng học Tiếng Anh thông minh thế hệ mới')}</span>
          <h1 id="home-title" lang="en">
            Master English without limits. <span>Build your global future.</span>
          </h1>
          <p>
            {t(
              'Khám phá các khóa học tiếng Anh chất lượng cao, từ tiếng Anh công sở và du lịch đến luyện thi IELTS và TOEIC. Rèn kỹ năng nghe qua bài chép chính tả và củng cố kiến thức cùng trợ lý AI.',
            )}
          </p>
          <div className="home-hero-actions">
            <a href="#courses" className="button button-primary">
              {t('Khám phá khóa học')} <Icon name="arrow" size={19} />
            </a>
            <Link to={ROUTES.AI_ASSISTANT} className="button button-outline">
              <Icon name="community" size={19} /> {t('Trợ lý AI')}
            </Link>
          </div>
          <ul className="home-hero-stats">
            {heroStats.map(([value, label]) => (
              <li key={label}>
                <strong>{value}</strong>
                <span>{t(label)}</span>
              </li>
            ))}
          </ul>
        </div>

        <DictationPreview lesson={data?.items?.[0]} />
      </div>
    </section>
  );
}
