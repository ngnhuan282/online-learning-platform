import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AccessTimeOutlined,
  ArrowForwardRounded,
  CheckCircleOutlineRounded,
  HeadphonesOutlined,
  PlayCircleOutlineRounded,
  SubjectOutlined,
} from '@mui/icons-material';
import { t } from '../../../shared/i18n/locale';
import { formatTime, isToeicTopic } from '../utils/dictation';

function LessonArtwork({ thumbnailUrl, video, topic }) {
  const [failedThumbnail, setFailedThumbnail] = useState(null);
  return (
    <div className="dictation-lesson-art">
      {thumbnailUrl && thumbnailUrl !== failedThumbnail ? (
        <img
          src={thumbnailUrl}
          width={320}
          height={180}
          alt=""
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setFailedThumbnail(thumbnailUrl)}
        />
      ) : video ? (
        <PlayCircleOutlineRounded className="dictation-cover-icon" />
      ) : isToeicTopic(topic) ? (
        <img
          src={`${import.meta.env.BASE_URL}dictation/toeic-listening.png`}
          width={1024}
          height={1024}
          alt=""
          loading="lazy"
        />
      ) : (
        <HeadphonesOutlined className="dictation-cover-icon" />
      )}
    </div>
  );
}

export default function DictationLessonGrid({ items, heading: Heading = 'h2' }) {
  return (
    <div className="dictation-library-grid">
      {items.map(item => {
        const attempt = item.attemptId ? `?attempt=${encodeURIComponent(item.attemptId)}` : '';
        const action = item.attemptCompleted ? 'Xem kết quả' : attempt ? 'Tiếp tục' : 'Bắt đầu';
        const status = item.attemptCompleted ? 'Đã hoàn thành' : attempt ? 'Đang luyện' : 'Chưa luyện';
        return (
          <article key={item.id} className="dictation-lesson-card">
            <Link
              to={`/dictation/${encodeURIComponent(item.id)}${attempt}`}
              aria-label={`${item.title} · ${t(action)}`}
            >
              <LessonArtwork thumbnailUrl={item.thumbnailUrl} video={item.video} topic={item.topic} />
              <div className="dictation-lesson-body">
                <div className="dictation-lesson-heading">
                  <Heading title={item.title}>{item.title}</Heading>
                  <span className="dictation-lesson-level">{item.level}</span>
                </div>
                <div className="dictation-lesson-meta">
                  <span>
                    <AccessTimeOutlined />
                    {formatTime(item.duration)}
                  </span>
                  <span>
                    <SubjectOutlined />
                    {t('{count} câu', { count: item.sentenceCount })}
                  </span>
                </div>
                <div className="dictation-lesson-footer">
                  <span className={item.attemptCompleted ? 'is-complete' : attempt ? 'is-in-progress' : ''}>
                    {item.attemptCompleted ? <CheckCircleOutlineRounded /> : <PlayCircleOutlineRounded />}
                    {t(status)}
                  </span>
                  <span className="dictation-lesson-action" aria-hidden="true">
                    {t(action)} <ArrowForwardRounded />
                  </span>
                </div>
              </div>
            </Link>
          </article>
        );
      })}
    </div>
  );
}
