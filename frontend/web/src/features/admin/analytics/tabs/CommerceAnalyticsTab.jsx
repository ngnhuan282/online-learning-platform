import { useCallback, useEffect, useState } from 'react';
import {
  CardGiftcardOutlined,
  DiamondOutlined,
  Inventory2Outlined,
  ShoppingBagOutlined,
  ShowChartOutlined,
  StorefrontOutlined,
  TimelineOutlined,
  WorkspacePremiumOutlined,
} from '@mui/icons-material';
import useLearningResource from '../../../learning/hooks/useLearningResource';
import { getIntlLocale } from '../../../../shared/i18n/locale';
import useLocale from '../../../../shared/i18n/useLocale';
import { adminApi } from '../../api/adminApi';
import { LoadState } from '../../components/AdminUi';
import { CommerceTable } from '../../components/CommerceAdminUi';
import BreakdownDonut from '../../components/analytics/BreakdownDonut';
import HorizontalBreakdown from '../../components/analytics/HorizontalBreakdown';
import StatComparisonCard from '../../components/analytics/StatComparisonCard';
import TrendChart from '../../components/analytics/TrendChart';
import useAdminPagination from '../../hooks/useAdminPagination';
import { number } from '../../utils/adminUtils';
import { exportAnalyticsToExcel } from '../analyticsUtils';
import { commerceReports } from '../commerceReports';

const dayMilliseconds = 86400000;
const reportZone = 'Asia/Ho_Chi_Minh';
const rangeLabel = ({ from, to }) => (from === to ? from : `${from} – ${to}`);
const instant = value =>
  value && new Date(value).toLocaleString(getIntlLocale(), { timeZone: reportZone });

function formatDateYmd(dateObj) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: reportZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(dateObj);
  const byType = Object.fromEntries(parts.map(p => [p.type, p.value]));
  return `${byType.year}-${byType.month}-${byType.day}`;
}

function presetRange(days) {
  const today = new Date();
  const start = new Date(today.getTime() - (days - 1) * dayMilliseconds);
  return { from: formatDateYmd(start), to: formatDateYmd(today) };
}

function detailValue(row, [, field, format], exporting = false) {
  const value = row[field];
  if (value == null) return exporting ? null : '—';
  if (format === 'number' && !exporting) return number(value);
  if (format === 'id') return `#${value}`;
  if (format === 'instant') return instant(value);
  return typeof format === 'object' ? (format[value] ?? value) : value;
}

function computeChange(cur, prev) {
  const c = Number(cur ?? 0);
  const p = Number(prev ?? 0);
  if (p === 0) return c === 0 ? 0 : null;
  return Math.round(((c - p) / Math.abs(p)) * 1000) / 10;
}

function PagedReportTable({ columns, rows, caption }) {
  const pagination = useAdminPagination(10);
  const tableColumns = columns.map(([label, field, format]) => [
    label,
    row => {
      const value = detailValue(row, [label, field, format]);
      if (field === 'delta' && row.delta != null) {
        const tone = row.delta > 0 ? 'green' : row.delta < 0 ? 'red' : '';
        const prefix = row.delta > 0 ? '+' : '';
        return <span className={`admin-pill ${tone}`}>{`${prefix}${number(row.delta)}`}</span>;
      }
      if (field === 'status' && typeof format === 'object') {
        const tone =
          row.status === 'REDEEMED'
            ? 'green'
            : row.status === 'REVOKED' || row.status === 'EXPIRED'
              ? 'red'
              : 'amber';
        return <span className={`admin-pill ${tone}`}>{value}</span>;
      }
      return value;
    },
  ]);

  return (
    <CommerceTable
      embedded
      paginate
      pagination={pagination}
      rowKey={(row, index) => row.id ?? row.code ?? row.label ?? index}
      rows={rows}
      columns={tableColumns}
      emptyMessage="Chưa có dữ liệu trong kỳ này."
      ariaLabel={caption}
    />
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

const snapshotIcons = {
  pro: WorkspacePremiumOutlined,
  gems: DiamondOutlined,
  shop: StorefrontOutlined,
};

const snapshotTones = ['blue', 'green', 'amber', 'purple'];

export default function CommerceAnalyticsTab({ report, onExportReady }) {
  useLocale();
  const config = commerceReports[report];
  const [range, setRange] = useState(null);
  const [draft, setDraft] = useState(null);
  const [rangeError, setRangeError] = useState('');
  const [activePreset, setActivePreset] = useState(30);
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
    setActivePreset(null);
    setRange(selected);
    setDraft(null);
  }

  function applyPreset(days) {
    setRangeError('');
    setActivePreset(days);
    setDraft(null);
    if (days === 30) {
      setRange(null);
    } else {
      setRange(presetRange(days));
    }
  }

  function updateDate(event) {
    setDraft({ ...selected, [event.target.name]: event.target.value });
    setRangeError('');
  }

  return (
    <section className="commerce-analytics-report" aria-label={config.title}>
      <form className="analytics-filter-card" onSubmit={apply} aria-label="Khoảng thời gian báo cáo">
        <div className="analytics-presets-group">
          {[7, 30, 90].map(days => (
            <button
              key={days}
              type="button"
              className={`analytics-preset-pill${activePreset === days ? ' is-selected' : ''}`}
              onClick={() => applyPreset(days)}
              disabled={loading}
            >
              {days} ngày
            </button>
          ))}
        </div>
        <div className="analytics-filter-controls">
          <label className="analytics-date-inputs">
            Từ ngày
            <input
              className="analytics-date-field"
              type="date"
              name="from"
              value={selected.from}
              onChange={updateDate}
              required
            />
          </label>
          <label className="analytics-date-inputs">
            Đến ngày
            <input
              className="analytics-date-field"
              type="date"
              name="to"
              value={selected.to}
              onChange={updateDate}
              required
            />
          </label>
          <button className="button button-primary" type="submit" disabled={loading}>
            Áp dụng
          </button>
          {(range || draft) && (
            <button
              className="button button-soft"
              type="button"
              onClick={() => {
                setRange(null);
                setDraft(null);
                setActivePreset(30);
                setRangeError('');
              }}
            >
              30 ngày gần nhất
            </button>
          )}
        </div>
        <span>Giờ Việt Nam (UTC+7)</span>
        {rangeError && <p role="alert">{rangeError}</p>}
      </form>

      {loading && <LoadState loading />}
      {error && (
        <div role="alert" className="analytics-section-card">
          <p>Không thể tải báo cáo. Kiểm tra khoảng ngày hoặc thử lại.</p>
          <button className="button button-soft" type="button" onClick={reload}>
            Thử lại
          </button>
        </div>
      )}
      {data && <ReportContent report={report} config={config} data={data} />}
    </section>
  );
}

function DomainBreakdown({ report, data }) {
  const cur = data.current ?? {};
  const snap = data.snapshot ?? {};

  if (report === 'pro') {
    const sources = [
      { label: 'Qua thanh toán', value: Number(cur.paid ?? 0), color: '#2563eb' },
      { label: 'Qua mã kích hoạt', value: Number(cur.code ?? 0), color: '#16a34a' },
      { label: 'Quản trị viên cấp', value: Number(cur.admin ?? 0), color: '#8b5cf6' },
    ];
    const memberStatus = [
      { label: 'Đang hoạt động', value: Number(snap.active ?? 0), color: '#16a34a' },
      { label: 'Đã hết hạn', value: Number(snap.expired ?? 0), color: '#94a3b8' },
      { label: 'Đang bị khóa', value: Number(snap.suspended ?? 0), color: '#ef4444' },
    ];
    return (
      <section className="analytics-section-card">
        <div className="analytics-card-header">
          <div>
            <h3 className="analytics-card-title">
              <CardGiftcardOutlined fontSize="small" /> Cơ cấu nguồn cấp & Trạng thái Pro
            </h3>
            <p className="analytics-card-subtitle">Phân tích theo nguồn kích hoạt trong kỳ</p>
          </div>
        </div>
        <HorizontalBreakdown items={sources} emptyMessage="Chưa có lượt cấp Pro trong kỳ." />
        <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px dashed #e2e8f0' }}>
          <BreakdownDonut
            items={memberStatus}
            centerLabel="THÀNH VIÊN"
            emptyMessage="Chưa có dữ liệu thành viên Pro."
          />
        </div>
      </section>
    );
  }

  if (report === 'gems') {
    const inflows = [
      { label: 'Thưởng hoạt động ngày', value: Number(cur.daily ?? 0), color: '#16a34a' },
      { label: 'Thưởng thành tích', value: Number(cur.rewards ?? 0), color: '#2563eb' },
      { label: 'Nạp Gem', value: Number(cur.topups ?? 0), color: '#8b5cf6' },
      { label: 'Admin cộng', value: Number(cur.adminCredits ?? 0), color: '#0ea5e9' },
    ];
    const outflows = [
      { label: 'Mua vật phẩm', value: Number(cur.itemSpend ?? 0), color: '#f59e0b' },
      { label: 'Mua Streak Freeze', value: Number(cur.freezeSpend ?? 0), color: '#06b6d4' },
      { label: 'Admin trừ', value: Number(cur.adminDebits ?? 0), color: '#ef4444' },
    ];
    return (
      <section className="analytics-section-card">
        <div className="analytics-card-header">
          <div>
            <h3 className="analytics-card-title">
              <DiamondOutlined fontSize="small" /> Dòng tiền Gem (Cộng vào & Chi ra)
            </h3>
            <p className="analytics-card-subtitle">Cân đối nguồn phát hành và tiêu thụ Gem trong kỳ</p>
          </div>
        </div>
        <h4 className="analytics-sublabel">Nguồn Gem cộng vào ví</h4>
        <HorizontalBreakdown items={inflows} emptyMessage="Chưa có Gem cộng vào ví trong kỳ." />
        <h4 className="analytics-sublabel" style={{ marginTop: 18 }}>
          Kênh tiêu thụ / trừ Gem
        </h4>
        <HorizontalBreakdown items={outflows} emptyMessage="Chưa có Gem trừ khỏi ví trong kỳ." />
      </section>
    );
  }

  const owned = Number(snap.ownedItems ?? 0);
  const equipped = Number(snap.equippedItems ?? 0);
  const unequipped = Math.max(0, owned - equipped);

  return (
    <section className="analytics-section-card">
      <div className="analytics-card-header">
        <div>
          <h3 className="analytics-card-title">
            <Inventory2Outlined fontSize="small" /> Tỷ lệ trang bị vật phẩm trong kho
          </h3>
          <p className="analytics-card-subtitle">So sánh vật phẩm đang được học viên sử dụng</p>
        </div>
      </div>
      <BreakdownDonut
        items={[
          { label: 'Đang trang bị', value: equipped, color: '#2563eb' },
          { label: 'Chưa trang bị', value: unequipped, color: '#cbd5e1' },
        ]}
        centerLabel="TRANG BỊ"
        centerValue={snap.equipRate != null ? `${number(snap.equipRate)}%` : '0%'}
        emptyMessage="Chưa có vật phẩm trong kho đồ."
      />
      <div style={{ marginTop: 16 }}>
        <HorizontalBreakdown
          items={[
            { label: 'Lượt mua / nhận vật phẩm', value: Number(cur.purchases ?? 0), color: '#2563eb' },
            { label: 'Streak Freeze mua / nhận', value: Number(cur.freezePurchases ?? 0), color: '#0ea5e9' },
            { label: 'Lượt dùng Streak Freeze', value: Number(cur.freezeUses ?? 0), color: '#16a34a' },
          ]}
          emptyMessage="Chưa có giao dịch cửa hàng trong kỳ."
        />
      </div>
    </section>
  );
}

function ReportContent({ report, config, data }) {
  const tables = config.tables(data);
  const series = data.trend.map(point => ({
    label: rangeLabel(point.range),
    current: point.current,
    previous: point.previous,
  }));
  const SnapshotIcon = snapshotIcons[report] || ShoppingBagOutlined;

  const periodRows = config.metrics.map(([label, key]) => {
    const curVal = data.current[key];
    const prevVal = data.previous[key];
    return {
      label,
      current: curVal,
      previous: prevVal,
      change: computeChange(curVal, prevVal),
    };
  });

  return (
    <>
      <section className="analytics-section-card">
        <div className="analytics-card-header">
          <div>
            <h2>Số liệu hiện tại</h2>
            <p className="analytics-card-subtitle">Cập nhật lúc {instant(data.asOf)} (giờ Việt Nam)</p>
          </div>
        </div>
        <div className="analytics-stats-grid">
          {config.snapshot.map(([label, key, format], idx) => (
            <StatComparisonCard
              key={key}
              title={label}
              icon={<SnapshotIcon />}
              value={data.snapshot[key]}
              format={format}
              tone={snapshotTones[idx % snapshotTones.length]}
            />
          ))}
        </div>
      </section>

      <div className="analytics-two-col">
        <section className="analytics-section-card">
          <div className="analytics-card-header">
            <div>
              <h2>
                <TimelineOutlined fontSize="small" /> So sánh theo kỳ
              </h2>
              <p className="analytics-card-subtitle">
                Kỳ này {rangeLabel(data.range)} · Kỳ trước {rangeLabel(data.previousRange)}
              </p>
            </div>
          </div>
          <div className="analytics-table-wrapper">
            <table className="analytics-table" aria-label="Chỉ số theo kỳ">
              <thead>
                <tr>
                  <th scope="col">Chỉ số</th>
                  <th scope="col">Kỳ này</th>
                  <th scope="col">Kỳ trước</th>
                  <th scope="col">Biến động</th>
                </tr>
              </thead>
              <tbody>
                {periodRows.map(row => (
                  <tr key={row.label}>
                    <td>{row.label}</td>
                    <td>
                      <strong>{row.current != null ? number(row.current) : '—'}</strong>
                    </td>
                    <td>{row.previous != null ? number(row.previous) : '—'}</td>
                    <td>
                      {row.change == null ? (
                        <span className="admin-pill">Mới</span>
                      ) : (
                        <span
                          className={`admin-pill ${row.change > 0 ? 'green' : row.change < 0 ? 'red' : ''}`}
                        >
                          {row.change > 0 ? `+${row.change}%` : `${row.change}%`}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {config.notes.map(note => (
            <p key={note} className="analytics-note-text">
              {note}
            </p>
          ))}
        </section>

        <DomainBreakdown report={report} data={data} />
      </div>

      <section className="analytics-section-card">
        <div className="analytics-card-header">
          <div>
            <h2>
              <ShowChartOutlined fontSize="small" /> {config.trend}
            </h2>
            <p className="analytics-card-subtitle">
              Đối chiếu từng chặng giữa kỳ này ({rangeLabel(data.range)}) và kỳ trước ({rangeLabel(data.previousRange)})
            </p>
          </div>
        </div>
        <TrendChart series={series} emptyMessage="Chưa có lượt nào trong hai kỳ." />
      </section>

      {tables.map(table => (
        <section className="analytics-section-card" key={table.title}>
          <div className="analytics-card-header">
            <div>
              <h2>{table.title}</h2>
              {table.summary && (
                <div className="analytics-table-summary-pills">
                  {table.summary.map(([label, value]) => (
                    <span className="admin-pill" key={label}>
                      {label}: <b>{number(value)}</b>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
          <PagedReportTable caption={table.title} columns={table.columns} rows={table.rows} />
        </section>
      ))}
    </>
  );
}
