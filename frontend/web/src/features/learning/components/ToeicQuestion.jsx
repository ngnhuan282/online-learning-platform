import { useState } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import Button from '@mui/material/Button';
import { t } from '../../../shared/i18n/locale';

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
}) {
  const images = question.passageImageUrls ?? [];
  const reveal = review || (showAnswer && Boolean(question.correctOptionId));
  return (
    <article className="toeic-question" id={`question-${question.id}`}>
      {(question.passage || images.length > 0) && (
        <section
          className="toeic-passage"
          aria-label={t('Đoạn đọc cho câu {number}', { number: question.number })}
        >
          <span className="toeic-eyebrow">{t('ĐỌC ĐOẠN VĂN')}</span>
          {question.passage && <p>{question.passage}</p>}
          {images.map((url, index) => (
            <SourceImage
              key={url}
              src={url}
              alt={t('Hình minh họa đoạn đọc {index}', { index: index + 1 })}
            />
          ))}
        </section>
      )}
      <fieldset>
        <legend>
          <span>Part {question.part}</span> {t('Câu {number}', { number: question.number })}
        </legend>
        {question.prompt && <p className="toeic-question-prompt">{question.prompt}</p>}
        {question.imageUrl && question.prompt && (
          <details className="toeic-question-source">
            <summary>{t('Xem hình câu hỏi gốc')}</summary>
            <SourceImage
              className="toeic-question-image"
              src={question.imageUrl}
              alt={t('Nội dung câu {number}', { number: question.number })}
            />
          </details>
        )}
        {question.imageUrl && !question.prompt && (
          <SourceImage
            className="toeic-question-image"
            src={question.imageUrl}
            alt={t('Nội dung câu {number}', { number: question.number })}
          />
        )}
        <div className="toeic-options">
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
                <span>{option.text}</span>
                {correct && <small>{t('Đáp án đúng')}</small>}
                {wrong && <small>{t('Bạn đã chọn')}</small>}
              </label>
            );
          })}
        </div>
      </fieldset>
      {reveal && (
        <section className="toeic-explanation">
          <h3>
            {selected === question.correctOptionId
              ? t('Bạn đã trả lời đúng')
              : selected
                ? t('Cùng xem lại câu này')
                : t('Đáp án & giải thích chi tiết')}
          </h3>
          <p>
            <strong>
              {t('Đáp án đúng')}: {question.correctOptionId}
            </strong>
          </p>
          <p>{question.explanation || t('Chưa có giải thích cho câu này.')}</p>
          {question.source && <small>{question.source}</small>}
        </section>
      )}
    </article>
  );
}
