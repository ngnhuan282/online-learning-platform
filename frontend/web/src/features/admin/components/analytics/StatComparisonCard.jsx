import { money, number } from '../../utils/adminUtils';

function formatValue(value, format) {
  if (value == null) return '—';
  if (format === 'money') return money(value);
  if (format === 'percent') return `${number(value)}%`;
  return number(value);
}

export default function StatComparisonCard({ title, icon, value, format = 'number' }) {
  return (
    <div className="stat-compare-card">
      <div className="stat-card-top">
        <h4 className="stat-card-title">{title}</h4>
        {icon && <div className="stat-card-icon">{icon}</div>}
      </div>
      <div className="stat-card-main">
        <div className="stat-card-value">{formatValue(value, format)}</div>
      </div>
    </div>
  );
}
