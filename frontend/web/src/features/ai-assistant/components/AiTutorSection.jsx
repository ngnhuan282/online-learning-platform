import { Link } from 'react-router-dom';
import Icon from '../../../shared/components/Icon';
import { ROUTES } from '../../../shared/constants/routes';
import { t } from '../../../shared/i18n/locale';
import useLocale from '../../../shared/i18n/useLocale';

const studyTopics = [
  'Giải thích cấu trúc ngữ pháp qua ví dụ dễ hiểu.',
  'Gợi ý từ vựng theo ngữ cảnh và cách diễn đạt tự nhiên hơn.',
  'Luyện viết email công việc và chuẩn bị câu trả lời cho phỏng vấn.',
  'Sửa lỗi ngữ pháp và gợi ý cách kết hợp từ trong bài viết.',
];

export default function AiTutorSection() {
  useLocale();

  return (
    <section className="home-assistant container" id="ai-tutor" aria-labelledby="home-assistant-title">
      <div className="home-assistant-panel">
        <div className="home-assistant-copy">
          <h2 id="home-assistant-title">
            {t('Học ngữ pháp và viết tự nhiên hơn cùng')} <span>{t('Trợ lý AI')}</span>
          </h2>
          <p>
            {t(
              'Trợ lý AI giúp bạn hiểu cách dùng tiếng Anh và chọn lối diễn đạt phù hợp khi học tập, làm việc và giao tiếp hằng ngày.',
            )}
          </p>
          <ul className="home-assistant-topics">
            {studyTopics.map(topic => (
              <li key={topic}>
                <span>
                  <Icon name="check" size={15} />
                </span>
                {t(topic)}
              </li>
            ))}
          </ul>
          <Link to={ROUTES.AI_ASSISTANT} className="button button-primary">
            {t('Mở trợ lý AI')} <Icon name="arrow" size={18} />
          </Link>
        </div>

        <figure className="home-assistant-sample">
          <figcaption>
            <span className="home-assistant-icon">
              <Icon name="community" size={18} />
            </span>
            {t('Ví dụ hỏi đáp')}
          </figcaption>
          <p className="home-assistant-prompt">
            <strong>{t('Bạn')}</strong>
            <span lang="en">
              How can I write a polite email in English asking my project manager for feedback?
            </span>
          </p>
          <div className="home-assistant-reply">
            <span className="home-assistant-reply-icon">
              <Icon name="language" size={17} />
            </span>
            <div>
              <p className="home-assistant-speaker">{t('Trợ lý AI')}</p>
              <p>{t('Chọn cách viết theo thời điểm bạn cần nhận phản hồi.')}</p>
              <ul className="home-assistant-examples">
                <li>
                  <strong>{t('Khi thời gian linh hoạt')}</strong>
                  <p lang="en">
                    “I’d really appreciate your thoughts on the updated sprint plan when you have a moment.”
                  </p>
                </li>
                <li>
                  <strong>{t('Khi có hạn chót')}</strong>
                  <p lang="en">
                    “Could you please share your feedback on the latest draft by Thursday afternoon?”
                  </p>
                </li>
              </ul>
            </div>
          </div>
        </figure>
      </div>
    </section>
  );
}
