import { useState } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import Button from '@mui/material/Button';
import { t } from '../../../shared/i18n/locale';
import { isListeningPart } from '../utils/toeicSections';
import ToeicListeningPlayer from './ToeicListeningPlayer';

function SourceImage({ src, alt, className }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className="toeic-image-trigger"
        aria-label={t('Phóng to {name}', { name: alt })}
        onClick={() => setOpen(true)}
      >
        <img src={src} alt={alt} className={className} loading="lazy" />
      </button>
      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="xl" fullWidth>
        <DialogTitle className="toeic-image-title">
          {alt}
          <Button onClick={() => setOpen(false)}>{t('Đóng')}</Button>
        </DialogTitle>
        <DialogContent dividers className="toeic-image-dialog">
          <img src={src} alt={alt} />
        </DialogContent>
      </Dialog>
    </>
  );
}

export default function ToeicQuestion({
  question,
  selected,
  onSelect,
  disabled = false,
  review = false,
  showAnswer = false,
  answerToggle = null,
  showTranscript = false,
  groupQuestions = [],
}) {
  const images = question.passageImageUrls ?? [];
  const listening = isListeningPart(question.part);
  const spokenOptions = listening && question.part <= 2;
  const showOptionLabels = !spokenOptions && !answerToggle;
  const clip = question.listening;
  const numbers = groupQuestions
    .filter(item => clip?.audioUrl && item.listening?.audioUrl === clip.audioUrl)
    .map(item => item.number);
  const first = numbers.length ? Math.min(...numbers) : question.number;
  const last = numbers.length ? Math.max(...numbers) : question.number;
  const reveal = review || (showAnswer && Boolean(question.correctOptionId));
  return (
    <article className={`toeic-question ${listening ? 'is-listening' : ''}`} id={`question-${question.id}`}>
      {(question.passage || images.length > 0) && (
        <section
          className="toeic-passage"
          aria-label={t(listening ? 'Hình minh họa' : 'Đoạn đọc cho câu {number}', {
            number: question.number,
          })}
        >
          <span className="toeic-eyebrow">{t(listening ? 'HÌNH MINH HỌA' : 'ĐỌC ĐOẠN VĂN')}</span>
          {question.passage && <p>{question.passage}</p>}
          {images.map((url, index) => (
            <SourceImage
              key={url}
              src={url}
              alt={t(listening ? 'Hình minh họa nhóm câu {index}' : 'Hình minh họa đoạn đọc {index}', {
                index: index + 1,
              })}
            />
          ))}
        </section>
      )}
      {clip?.audioUrl && (
        <ToeicListeningPlayer
          key={clip.audioUrl}
          clip={clip}
          first={first}
          last={last}
          showTranscript={review || showTranscript}
        />
      )}
      <fieldset>
        <legend>
          <span>Part {question.part}</span> {t('Câu {number}', { number: question.number })}
        </legend>
        {spokenOptions ? (
          <p className="toeic-question-prompt">
            {t(
              question.part === 1
                ? 'Nghe và chọn câu mô tả đúng hình ảnh.'
                : 'Nghe và chọn câu đáp phù hợp nhất.',
            )}
          </p>
        ) : (
          question.prompt && <p className="toeic-question-prompt">{question.prompt}</p>
        )}
        {question.imageUrl && question.prompt && !listening && (
          <details className="toeic-question-source">
            <summary>{t('Xem hình câu hỏi gốc')}</summary>
            <SourceImage
              className="toeic-question-image"
              src={question.imageUrl}
              alt={t('Nội dung câu {number}', { number: question.number })}
            />
          </details>
        )}
        {question.imageUrl && (listening || !question.prompt) && (
          <SourceImage
            className="toeic-question-image"
            src={question.imageUrl}
            alt={t('Nội dung câu {number}', { number: question.number })}
          />
        )}
        <div className={`toeic-options ${spokenOptions ? 'is-spoken' : ''}`}>
          {(question.options ?? []).map(option => {
            const correct = reveal && option.id === question.correctOptionId;
            const wrong = reveal && selected === option.id && !correct;
            return (
              <label
                key={option.id}
                className={`toeic-option ${selected === option.id ? 'is-selected' : ''} ${correct ? 'is-correct' : ''} ${wrong ? 'is-wrong' : ''}`}
              >
                <input
                  type="radio"
                  name={`toeic-question-${question.id}`}
                  value={option.id}
                  checked={selected === option.id}
                  disabled={disabled || review}
                  onChange={() => onSelect?.(option.id)}
                />
                <strong>{option.id}</strong>
                {!spokenOptions && <span>{option.text}</span>}
                {showOptionLabels && correct && <small>{t('Đáp án đúng')}</small>}
                {showOptionLabels && wrong && <small>{t('Bạn đã chọn')}</small>}
              </label>
            );
          })}
        </div>
      </fieldset>
      {answerToggle && <div className="toeic-answer-toggle">{answerToggle}</div>}
      {reveal && (
        <section className={`toeic-explanation ${answerToggle ? 'is-inline' : ''}`}>
          {!listening && (
            <h3>
              {selected === question.correctOptionId
                ? t('Bạn đã trả lời đúng')
                : selected
                  ? t('Cùng xem lại câu này')
                  : t('Đáp án & giải thích chi tiết')}
            </h3>
          )}
          <p>
            <strong>
              {t('Đáp án đúng')}: {question.correctOptionId}
            </strong>
          </p>
          {!listening && <p>{question.explanation || t('Chưa có giải thích cho câu này.')}</p>}
          {!listening && question.source && <small>{question.source}</small>}
        </section>
      )}
    </article>
  );
}
