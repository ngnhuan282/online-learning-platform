import { number } from '../../utils/adminUtils';

const DEFAULT_COLORS = ['#2563eb', '#0ea5e9', '#16a34a', '#f59e0b', '#8b5cf6', '#ec4899'];

export default function HorizontalBreakdown({
  items = [],
  valueFormatter = number,
  emptyMessage = 'Chưa có dữ liệu.',
}) {
  const normalized = items.map((item, idx) => ({
    label: item.label,
    value: Number(item.value ?? 0),
    color: item.color || DEFAULT_COLORS[idx % DEFAULT_COLORS.length],
  }));

  const total = normalized.reduce((sum, item) => sum + Math.max(0, item.value), 0);

  if (!normalized.length || total === 0) {
    return <p className="analytics-chart-empty">{emptyMessage}</p>;
  }

  return (
    <div className="analytics-spend-breakdown">
      {normalized.map(item => {
        const pct = total > 0 ? Math.round((Math.max(0, item.value) / total) * 1000) / 10 : 0;
        return (
          <div key={item.label} className="analytics-spend-row">
            <span className="analytics-spend-label" title={item.label}>
              {item.label}
            </span>
            <div className="analytics-spend-bar-wrap">
              <div
                className="analytics-spend-bar"
                style={{ width: `${Math.max(pct > 0 ? 3 : 0, pct)}%`, background: item.color }}
              />
            </div>
            <span className="analytics-spend-value">{valueFormatter(item.value)}</span>
            <span className="analytics-spend-pct">{pct}%</span>
          </div>
        );
      })}
    </div>
  );
}
