import { FileDownloadOutlined, CalendarTodayOutlined } from '@mui/icons-material';
import { getPresetRange } from '../../analytics/analyticsUtils';

const PRESETS = [
  { id: '7d', label: '7 ngày qua' },
  { id: '30d', label: '30 ngày qua' },
  { id: 'this_month', label: 'Tháng này' },
  { id: 'last_month', label: 'Tháng trước' },
  { id: 'this_quarter', label: 'Quý này' },
  { id: 'this_year', label: 'Năm nay' },
];

export default function AnalyticsFilterBar({
  range,
  onRangeChange,
  compare,
  onCompareChange,
  onExport,
  exportLabel = 'Xuất Excel / CSV',
}) {
  const currentPreset = PRESETS.find(
    p => getPresetRange(p.id).from === range.from && getPresetRange(p.id).to === range.to,
  )?.id;

  const handlePresetClick = presetId => {
    const next = getPresetRange(presetId);
    onRangeChange({ from: next.from, to: next.to });
  };

  return (
    <div className="analytics-filter-card">
      <div className="analytics-presets-group">
        <CalendarTodayOutlined fontSize="small" style={{ color: '#64748b', marginRight: 4 }} />
        {PRESETS.map(preset => (
          <button
            key={preset.id}
            type="button"
            className={`analytics-preset-pill ${currentPreset === preset.id ? 'is-selected' : ''}`}
            onClick={() => handlePresetClick(preset.id)}
          >
            {preset.label}
          </button>
        ))}
      </div>

      <div className="analytics-filter-controls">
        <div className="analytics-date-inputs">
          <input
            type="date"
            className="analytics-date-field"
            value={range.from}
            onChange={e => onRangeChange({ ...range, from: e.target.value })}
            aria-label="Từ ngày"
          />
          <span>đến</span>
          <input
            type="date"
            className="analytics-date-field"
            value={range.to}
            onChange={e => onRangeChange({ ...range, to: e.target.value })}
            aria-label="Đến ngày"
          />
        </div>

        <label className="analytics-compare-toggle">
          <input
            type="checkbox"
            checked={compare}
            onChange={e => onCompareChange(e.target.checked)}
          />
          <span>So sánh kỳ trước</span>
        </label>

        {onExport && (
          <button
            type="button"
            className="button button-soft"
            style={{ fontSize: 13, padding: '6px 14px', display: 'flex', alignItems: 'center', gap: 6 }}
            onClick={onExport}
          >
            <FileDownloadOutlined fontSize="small" />
            <span>{exportLabel}</span>
          </button>
        )}
      </div>
    </div>
  );
}
