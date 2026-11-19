import { useCallback, useEffect, useState } from 'react';
import useLearningResource from '../../../learning/hooks/useLearningResource';
import { getIntlLocale } from '../../../../shared/i18n/locale';
import useLocale from '../../../../shared/i18n/useLocale';
import { adminApi } from '../../api/adminApi';
import StatComparisonCard from '../../components/analytics/StatComparisonCard';
import TrendChart from '../../components/analytics/TrendChart';
import { number } from '../../utils/adminUtils';
import { exportAnalyticsToExcel } from '../analyticsUtils';
import { commerceReports } from '../commerceReports';

const dayMilliseconds = 86400000;
const reportZone = 'Asia/Ho_Chi_Minh';
const rangeLabel = ({ from, to }) => from === to ? from : `${from} – ${to}`;
const instant = value => value && new Date(value).toLocaleString(getIntlLocale(), { timeZone: reportZone });

function detailValue(row, [, field, format], exporting = false) {
  const value = row[field];
  if (value == null) return exporting ? null : '—';
  if (format === 'number' && !exporting) return number(value);
  if (format === 'id') return `#${value}`;
  if (format === 'instant') return instant(value);
  return typeof format === 'object' ? (format[value] ?? value) : value;
}

function ReportTable({ columns, rows, caption }) {
  if (!rows.length) return <p>Chưa có dữ liệu trong kỳ này.</p>;
  return (
    <div className="analytics-table-wrapper">
      <table className="analytics-table" aria-label={caption}>
        <thead><tr>{columns.map(column => <th key={column[0]} scope="col">{column[0]}</th>)}</tr></thead>
        <tbody>
          {rows.map(row => (
            <tr key={row.id ?? row.code ?? row.label}>
              {columns.map(column => <td key={column[0]}>{detailValue(row, column)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function exportRows(config, data, tables) {
  const rows = [
    [config.title, 'Giờ Việt Nam (UTC+7)'],
    ['Kỳ này', rangeLabel(data.range)],
    ['Kỳ trước', rangeLabel(data.previousRange)],
    ['Số liệu hiện tại lúc', instant(data.asOf)],
    [],
    ['Chỉ số hiện tại', 'Giá trị'],
    ...config.snapshot.map(([label, key]) => [label, data.snapshot[key]]),
    [],
    ['Chỉ số trong kỳ', 'Kỳ này', 'Kỳ trước'],
    ...config.metrics.map(([label, key]) => [label, data.current[key], data.previous[key]]),
    [],
    [config.trend, 'Kỳ này', 'Kỳ trước'],
    ...data.trend.map(point => [rangeLabel(point.range), point.current, point.previous]),
  ];
  for (const table of tables) {
    rows.push([], [table.title], ...(table.summary ?? []), table.columns.map(([label]) => label));
    rows.push(...table.rows.map(row => table.columns.map(column => detailValue(row, column, true))));
  }
  rows.push([], ...config.notes.map(note => [note]));
  return rows;
}

export default function CommerceAnalyticsTab({ report, onExportReady }) {
  useLocale();
  const config = commerceReports[report];
  const [range, setRange] = useState(null);
  const [draft, setDraft] = useState(null);
  const [rangeError, setRangeError] = useState('');
  const load = useCallback(options => adminApi.commerceAnalytics(report, range, options), [report, range]);
  const { data, loading, error, reload } = useLearningResource(load, null);
  const selected = draft ?? range ?? data?.range ?? { from: '', to: '' };

  useEffect(() => {
    if (!data || !onExportReady) return;
    onExportReady(() =>
      exportAnalyticsToExcel(
        exportRows(config, data, config.tables(data)),
        `thong-ke-${report}-${data.range.from}-${data.range.to}.xlsx`,
        config.title,
      ),
    );
    return () => onExportReady(null);
  }, [config, data, onExportReady, report]);

  function apply(event) {
    event.preventDefault();
    const days = (Date.parse(selected.to) - Date.parse(selected.from)) / dayMilliseconds + 1;
    if (!Number.isFinite(days) || days < 1 || days > 90) {
      setRangeError('Chọn khoảng ngày hợp lệ, tối đa 90 ngày.');
      return;
    }
    setRangeError('');
    setRange(selected);
    setDraft(null);
  }

  function updateDate(event) {
    setDraft({ ...selected, [event.target.name]: event.target.value });
    setRangeError('');
  }

  return (
    <section className="commerce-analytics-report" aria-label={config.title}>
      <form className="analytics-filter-card" onSubmit={apply} aria-label="Khoảng thời gian báo cáo">
        <div className="analytics-filter-controls">
          <label className="analytics-date-inputs">
            Từ ngày
            <input className="analytics-date-field" type="date" name="from" value={selected.from} onChange={updateDate} required />
          </label>
          <label className="analytics-date-inputs">
            Đến ngày
            <input className="analytics-date-field" type="date" name="to" value={selected.to} onChange={updateDate} required />
          </label>
          <button className="button button-primary" type="submit" disabled={loading}>Áp dụng</button>
          {(range || draft) && (
            <button className="button button-soft" type="button" onClick={() => { setRange(null); setDraft(null); setRangeError(''); }}>
              30 ngày gần nhất
            </button>
          )}
        </div>
        <span>Giờ Việt Nam (UTC+7)</span>
        {rangeError && <p role="alert">{rangeError}</p>}
      </form>
      {loading && <p role="status">Đang tải báo cáo…</p>}
      {error && (
        <div role="alert" className="analytics-section-card">
          <p>Không thể tải báo cáo. Kiểm tra khoảng ngày hoặc thử lại.</p>
          <button className="button button-soft" type="button" onClick={reload}>Thử lại</button>
        </div>
      )}
      {data && <ReportContent config={config} data={data} />}
    </section>
  );
}

function ReportContent({ config, data }) {
  const tables = config.tables(data);
  const series = data.trend.map(point => ({
    label: rangeLabel(point.range),
    current: point.current,
    previous: point.previous,
  }));
  return (
    <>
      <section className="analytics-section-card">
        <h2>Số liệu hiện tại</h2>
        <p>Cập nhật lúc {instant(data.asOf)} (giờ Việt Nam)</p>
        <div className="analytics-stats-grid">
          {config.snapshot.map(([label, key, format]) => (
            <StatComparisonCard key={key} title={label} value={data.snapshot[key]} format={format} />
          ))}
        </div>
      </section>
      <section className="analytics-section-card">
        <h2>So sánh theo kỳ</h2>
        <p>Kỳ này {rangeLabel(data.range)} · Kỳ trước {rangeLabel(data.previousRange)}</p>
        <ReportTable
          caption="Chỉ số theo kỳ"
          columns={[['Chỉ số', 'label'], ['Kỳ này', 'current', 'number'], ['Kỳ trước', 'previous', 'number']]}
          rows={config.metrics.map(([label, key]) => ({ label, current: data.current[key], previous: data.previous[key] }))}
        />
        {config.notes.map(note => <p key={note}>{note}</p>)}
      </section>
      <section className="analytics-section-card">
        <h2>{config.trend}</h2>
        <TrendChart series={series} emptyMessage="Chưa có lượt nào trong hai kỳ." />
      </section>
      {tables.map(table => (
        <section className="analytics-section-card" key={table.title}>
          <h2>{table.title}</h2>
          {table.summary?.map(([label, value]) => <p key={label}>{label}: {number(value)}</p>)}
          <ReportTable caption={table.title} columns={table.columns} rows={table.rows} />
        </section>
      ))}
    </>
  );
}
