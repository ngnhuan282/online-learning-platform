import { number } from '../../utils/adminUtils';

const DEFAULT_COLORS = ['#2563eb', '#16a34a', '#f59e0b', '#8b5cf6', '#06b6d4', '#ef4444'];

function buildConicGradient(items, total) {
  return items
    .reduce(
      (acc, item) => {
        const start = acc.cursor;
        const end = start + (item.value / total) * 100;
        acc.stops.push(`${item.color} ${start.toFixed(2)}% ${end.toFixed(2)}%`);
        acc.cursor = end;
        return acc;
      },
      { cursor: 0, stops: [] },
    )
    .stops.join(', ');
}

export default function BreakdownDonut({
  items = [],
  centerLabel = 'Tổng',
  centerValue,
  valueFormatter = number,
  emptyMessage = 'Chưa có dữ liệu phân bố.',
}) {
  const normalized = items
    .map((item, idx) => ({
      label: item.label,
      value: Number(item.value ?? 0),
      color: item.color || DEFAULT_COLORS[idx % DEFAULT_COLORS.length],
    }))
    .filter(item => Number.isFinite(item.value) && item.value >= 0);

  const total = normalized.reduce((sum, item) => sum + item.value, 0);

  if (!normalized.length || total === 0) {
    return <p className="analytics-chart-empty">{emptyMessage}</p>;
  }

  const gradient = buildConicGradient(normalized, total);

  return (
    <div className="analytics-donut-layout">
      <div className="analytics-donut-ring" style={{ background: `conic-gradient(${gradient})` }}>
        <div className="analytics-donut-hole">
          <strong>{centerValue != null ? centerValue : number(total)}</strong>
          <small>{centerLabel}</small>
        </div>
      </div>
      <ul className="analytics-donut-legend">
        {normalized.map(item => {
          const pct = Math.round((item.value / total) * 1000) / 10;
          return (
            <li key={item.label}>
              <span className="donut-dot" style={{ background: item.color }} />
              <span className="donut-label">{item.label}</span>
              <span className="donut-count">{valueFormatter(item.value)}</span>
              <span className="donut-pct">{pct}%</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
