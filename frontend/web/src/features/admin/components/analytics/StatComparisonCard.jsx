import { TrendingDown, TrendingFlat, TrendingUp } from '@mui/icons-material';
import { money, number } from '../../utils/adminUtils';

function formatValue(value, format) {
  if (value == null) return '—';
  if (format === 'money') return money(value);
  if (format === 'percent') return `${number(value)}%`;
  return number(value);
}

function computeDelta(current, previous) {
  if (current == null || previous == null) return null;
  const cur = Number(current);
  const prev = Number(previous);
  if (!Number.isFinite(cur) || !Number.isFinite(prev)) return null;
  if (prev === 0) return cur === 0 ? 0 : 100;
  return Math.round(((cur - prev) / Math.abs(prev)) * 1000) / 10;
}

export default function StatComparisonCard({
  title,
  icon,
  value,
  previousValue,
  format = 'number',
  tone = 'blue',
  helper,
}) {
  const delta = computeDelta(value, previousValue);
  const deltaState = delta == null ? null : delta > 0 ? 'is-up' : delta < 0 ? 'is-down' : 'is-neutral';

  return (
    <div className={`stat-compare-card tone-${tone}`}>
      <div className="stat-card-top">
        <h4 className="stat-card-title">{title}</h4>
        {icon && <div className={`stat-card-icon tone-${tone}`}>{icon}</div>}
      </div>
      <div className="stat-card-main">
        <div className="stat-card-value">{formatValue(value, format)}</div>
        {delta != null && (
          <span className={`stat-growth-badge ${deltaState}`}>
            {delta > 0 ? (
              <TrendingUp sx={{ fontSize: 14 }} aria-hidden="true" />
            ) : delta < 0 ? (
              <TrendingDown sx={{ fontSize: 14 }} aria-hidden="true" />
            ) : (
              <TrendingFlat sx={{ fontSize: 14 }} aria-hidden="true" />
            )}
            {delta > 0 ? `+${delta}%` : `${delta}%`}
          </span>
        )}
      </div>
      {helper ? <p className="stat-card-footer">{helper}</p> : null}
    </div>
  );
}
