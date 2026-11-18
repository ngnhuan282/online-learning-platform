import { CircularProgress, Tooltip } from '@mui/material';
import { t } from '../../../shared/i18n/locale';
import { scoreDescription, scoreFeedback } from '../utils/dictation';

export default function DictationScore({ attempt, compact = false }) {
  const score = Number(attempt.accuracy);
  const displayScore = Math.round(score);
  const feedback = scoreFeedback(score);
  const size = compact ? 60 : 88;
  return (
    <Tooltip title={t(scoreDescription(attempt))}>
      <div
        className={`dictation-score dictation-score-tone is-${feedback.tone} ${compact ? 'is-compact' : ''}`}
        role="img"
        tabIndex={0}
        aria-label={`${t('Điểm')}: ${displayScore}/100. ${t(feedback.label)}. ${t(scoreDescription(attempt))}`}
      >
        <CircularProgress
          className="dictation-score-track"
          variant="determinate"
          value={100}
          size={size}
          thickness={3.5}
          aria-hidden="true"
        />
        <CircularProgress
          className="dictation-score-fill"
          variant="determinate"
          value={score}
          size={size}
          thickness={3.5}
          aria-hidden="true"
        />
        <span className="dictation-score-value">
          <strong>{displayScore}</strong>
          <small>/100</small>
        </span>
      </div>
    </Tooltip>
  );
}
