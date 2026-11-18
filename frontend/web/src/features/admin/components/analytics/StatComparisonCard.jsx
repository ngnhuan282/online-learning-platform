import { TrendingUp, TrendingDown, Remove } from '@mui/icons-material';
import { calculateGrowth } from '../../analytics/analyticsUtils';
import { money, number } from '../../utils/adminUtils';

function formatVal(value, format) {
  if (value == null) return '0';
  if (format === 'money') return money(value);
  if (format === 'number') return number(value);
  if (format === 'percent') return `${value}%`;
  return String(value);
}

export default function StatComparisonCard({
  title,
  icon,
  value,
  previousValue,
  format = 'number',
  compare = true,
  overrideGrowth,
  subtitle,
}) {
  const growth = overrideGrowth || (compare && previousValue != null ? calculateGrowth(value, previousValue) : null);

  return (
    <div className="stat-compare-card">
      <div className="stat-card-top">
        <h4 className="stat-card-title">{title}</h4>
        {icon && <div className="stat-card-icon">{icon}</div>}
      </div>

      <div className="stat-card-main">
        <div className="stat-card-value">{formatVal(value, format)}</div>
        {compare && growth && (
          <span className={`stat-growth-badge is-${growth.type}`} title={growth.text}>
            {growth.type === 'up' && <TrendingUp fontSize="inherit" />}
            {growth.type === 'down' && <TrendingDown fontSize="inherit" />}
            {growth.type === 'neutral' && <Remove fontSize="inherit" />}
            <span>{growth.formatted}</span>
          </span>
        )}
      </div>

      {compare && previousValue != null && (
        <p className="stat-card-footer">
          {subtitle || `Kỳ trước: ${formatVal(previousValue, format)}`}
        </p>
      )}
    </div>
  );
}
