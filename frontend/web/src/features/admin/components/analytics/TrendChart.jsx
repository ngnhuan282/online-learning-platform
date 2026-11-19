import { useMemo } from 'react';
import { number } from '../../utils/adminUtils';

export default function TrendChart({
  series = [],
  compare = true,
  currentLabel = 'Kỳ này',
  previousLabel = 'Kỳ trước',
  currentColor = '#2563eb',
  previousColor = '#94a3b8',
  valueFormatter = number,
  emptyMessage = 'Chưa có dữ liệu biểu đồ cho kỳ này',
}) {
  const maxVal = useMemo(() => {
    let max = 0;
    series.forEach(item => {
      const cur = Number(item.current ?? item.amount ?? item.count ?? 0);
      const prev = Number(item.previous ?? 0);
      if (cur > max) max = cur;
      if (compare && prev > max) max = prev;
    });
    return max > 0 ? max : 1;
  }, [series, compare]);

  if (!series || series.length === 0) {
    return <p style={{ textAlign: 'center', color: '#64748b', padding: '40px 0' }}>{emptyMessage}</p>;
  }

  const BAR_MAX_HEIGHT = 120;

  return (
    <div className="analytics-trend-chart">
      {compare && (
        <div className="analytics-chart-legend" style={{ justifyContent: 'flex-end', marginBottom: 12 }}>
          <div className="legend-item">
            <span className="legend-color" style={{ background: currentColor }} />
            <span>{currentLabel}</span>
          </div>
          <div className="legend-item">
            <span className="legend-color" style={{ background: previousColor }} />
            <span>{previousLabel}</span>
          </div>
        </div>
      )}

      <div className="analytics-bars-wrapper">
        {series.map((item, idx) => {
          const curVal = Number(item.current ?? item.amount ?? item.count ?? 0);
          const prevVal = Number(item.previous ?? 0);

          const curHeight = Math.max(4, Math.round((curVal / maxVal) * BAR_MAX_HEIGHT));
          const prevHeight = compare ? Math.max(4, Math.round((prevVal / maxVal) * BAR_MAX_HEIGHT)) : 0;

          return (
            <div key={item.label || idx} className="analytics-bar-col" title={`${item.label}: ${valueFormatter(curVal)}`}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-end',
                  justifyContent: 'center',
                  gap: 4,
                  height: BAR_MAX_HEIGHT,
                  width: '100%',
                  flexShrink: 0,
                }}
              >
                {compare && (
                  <div
                    style={{
                      width: '45%',
                      maxWidth: 24,
                      height: `${prevHeight}px`,
                      background: previousColor,
                      borderRadius: '4px 4px 0 0',
                      transition: 'height 0.2s ease',
                      opacity: 0.7,
                    }}
                    title={`${previousLabel}: ${valueFormatter(prevVal)}`}
                  />
                )}
                <div
                  style={{
                    width: compare ? '45%' : '70%',
                    maxWidth: 28,
                    height: `${curHeight}px`,
                    background: currentColor,
                    borderRadius: '4px 4px 0 0',
                    transition: 'height 0.2s ease',
                  }}
                  title={`${currentLabel}: ${valueFormatter(curVal)}`}
                />
              </div>
              <span
                className="analytics-bar-label"
                style={{
                  display: 'block',
                  textAlign: 'center',
                  fontSize: 11,
                  fontWeight: 600,
                  color: '#64748b',
                  lineHeight: '16px',
                  height: 16,
                  flexShrink: 0,
                  whiteSpace: 'nowrap',
                  textOverflow: 'ellipsis',
                  overflow: 'hidden',
                  width: '100%',
                }}
              >
                {item.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
