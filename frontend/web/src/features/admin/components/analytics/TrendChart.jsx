import { useMemo, useState } from 'react';
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
  showSummary = true,
}) {
  const [hoveredIdx, setHoveredIdx] = useState(null);

  const stats = useMemo(() => {
    let max = 0;
    let total = 0;
    let peak = null;
    series.forEach(item => {
      const cur = Number(item.current ?? item.amount ?? item.count ?? 0);
      const prev = Number(item.previous ?? 0);
      total += cur;
      if (cur > max) {
        max = cur;
        peak = { label: item.label, value: cur };
      } else if (!peak) {
        peak = { label: item.label, value: cur };
      }
      if (compare && prev > max) max = prev;
    });
    const avg = series.length > 0 ? Math.round((total / series.length) * 10) / 10 : 0;
    return {
      maxVal: max > 0 ? max : 1,
      hasData: max > 0,
      total,
      avg,
      peak,
    };
  }, [series, compare]);

  if (
    !series.some(
      point =>
        Number(point.current ?? point.amount ?? point.count ?? 0) > 0 ||
        (compare && Number(point.previous) > 0),
    )
  ) {
    return <p className="analytics-chart-empty">{emptyMessage}</p>;
  }

  const BAR_MAX_HEIGHT = 152;
  const activeItem = hoveredIdx != null ? series[hoveredIdx] : null;
  const activeCur = activeItem ? Number(activeItem.current ?? activeItem.amount ?? activeItem.count ?? 0) : 0;
  const activePrev = activeItem ? Number(activeItem.previous ?? 0) : 0;

  return (
    <div className="analytics-trend-chart">
      <div className="analytics-chart-topbar">
        <div className="analytics-chart-spotlight" aria-live="polite">
          {activeItem ? (
            <>
              <span className="spotlight-label">{activeItem.label}:</span>
              <strong>{valueFormatter(activeCur)}</strong>
              {compare && (
                <span className="spotlight-prev">
                  ({previousLabel}: {valueFormatter(activePrev)})
                </span>
              )}
            </>
          ) : (
            <span className="spotlight-hint">Di chuột vào cột để xem chi tiết từng mốc</span>
          )}
        </div>
        {compare && (
          <div className="analytics-chart-legend">
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
      </div>

      <div className="analytics-chart-plot">
        <div className="analytics-y-axis" aria-hidden="true">
          <span>{valueFormatter(stats.maxVal)}</span>
          <span>{valueFormatter(Math.round((stats.maxVal / 2) * 10) / 10)}</span>
          <span>{valueFormatter(0)}</span>
        </div>

        <div className="analytics-bars-stage">
          <div className="analytics-gridlines" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <div className="analytics-bars-wrapper" onMouseLeave={() => setHoveredIdx(null)}>
            {series.map((item, idx) => {
              const curVal = Number(item.current ?? item.amount ?? item.count ?? 0);
              const prevVal = Number(item.previous ?? 0);
              const height = value =>
                value > 0 ? Math.max(5, Math.round((value / stats.maxVal) * BAR_MAX_HEIGHT)) : 0;
              const curHeight = height(curVal);
              const prevHeight = compare ? height(prevVal) : 0;
              const isActive = hoveredIdx === idx;

              return (
                <div
                  key={item.label || idx}
                  className={`analytics-bar-col${isActive ? ' is-hovered' : ''}`}
                  title={`${item.label}: ${valueFormatter(curVal)}`}
                  onMouseEnter={() => setHoveredIdx(idx)}
                >
                  <div className="analytics-bar-track" style={{ height: BAR_MAX_HEIGHT }}>
                    {compare && (
                      <div
                        className="analytics-bar is-secondary"
                        style={{
                          width: '42%',
                          maxWidth: 22,
                          height: `${prevHeight}px`,
                          background: previousColor,
                          opacity: isActive ? 0.92 : 0.65,
                        }}
                        title={`${previousLabel}: ${valueFormatter(prevVal)}`}
                      />
                    )}
                    <div
                      className="analytics-bar is-primary"
                      style={{
                        width: compare ? '42%' : '62%',
                        maxWidth: 28,
                        height: `${curHeight}px`,
                        background: currentColor,
                      }}
                      title={`${currentLabel}: ${valueFormatter(curVal)}`}
                    />
                  </div>
                  <span className="analytics-bar-label" title={item.label}>
                    {item.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {showSummary && (
        <div className="analytics-chart-summary">
          <div>
            <span>Tổng {currentLabel.toLowerCase()}</span>
            <strong>{valueFormatter(stats.total)}</strong>
          </div>
          <div>
            <span>Trung bình / mốc</span>
            <strong>{valueFormatter(stats.avg)}</strong>
          </div>
          {stats.peak && (
            <div>
              <span>Cao nhất ({stats.peak.label})</span>
              <strong>{valueFormatter(stats.peak.value)}</strong>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
