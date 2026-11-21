import { useEffect, useId, useRef, useState } from 'react';
import HeadphonesOutlined from '@mui/icons-material/HeadphonesOutlined';
import { t } from '../../../shared/i18n/locale';

export default function ToeicListeningPlayer({ clip, first, last, showTranscript }) {
  const [expanded, setExpanded] = useState(false);
  const [failed, setFailed] = useState(false);
  const transcriptId = useId();
  const audio = useRef(null);
  const label =
    first === last
      ? t('Đoạn nghe câu {number}', { number: first })
      : t('Đoạn nghe câu {first}–{last}', { first, last });

  useEffect(() => {
    const player = audio.current;
    return () => {
      if (player && !player.paused) player.pause();
    };
  }, []);

  function retry() {
    setFailed(false);
    audio.current?.load();
  }

  return (
    <section className="toeic-listening-player" aria-label={label}>
      <div className="toeic-listening-heading">
        <HeadphonesOutlined fontSize="small" aria-hidden="true" />
        <strong>{label}</strong>
      </div>
      <audio
        ref={audio}
        src={clip.audioUrl}
        controls
        preload="metadata"
        aria-label={label}
        onError={() => setFailed(true)}
      />
      {failed && (
        <div className="toeic-listening-error" role="alert">
          <span>{t('Không tải được đoạn nghe.')}</span>
          <button type="button" className="toeic-text-link" onClick={retry}>
            {t('Thử lại')}
          </button>
        </div>
      )}
      {showTranscript && clip.transcript && (
        <div className="toeic-transcript">
          <button
            type="button"
            className="toeic-text-link"
            aria-expanded={expanded}
            aria-controls={transcriptId}
            onClick={() => setExpanded(value => !value)}
          >
            {t(expanded ? 'Ẩn transcript' : 'Hiện transcript')}
          </button>
          <div id={transcriptId} hidden={!expanded}>
            {expanded && <p lang="en">{clip.transcript}</p>}
          </div>
        </div>
      )}
    </section>
  );
}
