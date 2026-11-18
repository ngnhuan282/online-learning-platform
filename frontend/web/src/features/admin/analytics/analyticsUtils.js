import { download, csvCell } from '../utils/adminUtils';

/**
 * Định dạng ngày YYYY-MM-DD
 */
export function formatDate(date) {
  const d = new Date(date);
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
}

/**
 * Các khoảng thời gian mẫu (Presets)
 */
export function getPresetRange(presetKey) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  switch (presetKey) {
    case '7d': {
      const from = new Date(today);
      from.setDate(from.getDate() - 6);
      return { from: formatDate(from), to: formatDate(today), label: '7 ngày qua' };
    }
    case '30d': {
      const from = new Date(today);
      from.setDate(from.getDate() - 29);
      return { from: formatDate(from), to: formatDate(today), label: '30 ngày qua' };
    }
    case 'this_month': {
      const from = new Date(today.getFullYear(), today.getMonth(), 1);
      return { from: formatDate(from), to: formatDate(today), label: 'Tháng này' };
    }
    case 'last_month': {
      const from = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const to = new Date(today.getFullYear(), today.getMonth(), 0);
      return { from: formatDate(from), to: formatDate(to), label: 'Tháng trước' };
    }
    case 'this_quarter': {
      const currentQuarter = Math.floor(today.getMonth() / 3);
      const from = new Date(today.getFullYear(), currentQuarter * 3, 1);
      return { from: formatDate(from), to: formatDate(today), label: 'Quý này' };
    }
    case 'this_year': {
      const from = new Date(today.getFullYear(), 0, 1);
      return { from: formatDate(from), to: formatDate(today), label: 'Năm nay' };
    }
    default: {
      const from = new Date(today);
      from.setDate(from.getDate() - 29);
      return { from: formatDate(from), to: formatDate(today), label: '30 ngày qua' };
    }
  }
}

/**
 * Tính toán khoảng ngày của kỳ trước liền kề
 */
export function getPreviousPeriodRange(fromStr, toStr) {
  const from = new Date(fromStr);
  const to = new Date(toStr);
  const diffTime = Math.abs(to - from);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

  const prevTo = new Date(from);
  prevTo.setDate(prevTo.getDate() - 1);

  const prevFrom = new Date(prevTo);
  prevFrom.setDate(prevFrom.getDate() - diffDays + 1);

  return {
    from: formatDate(prevFrom),
    to: formatDate(prevTo),
    days: diffDays,
  };
}

/**
 * Tính % tăng / giảm so với kỳ trước
 */
export function calculateGrowth(currentVal, previousVal) {
  const cur = Number(currentVal ?? 0);
  const prev = Number(previousVal ?? 0);

  if (prev === 0) {
    if (cur === 0) return { percent: 0, formatted: '0%', type: 'neutral', text: 'Không đổi' };
    return { percent: 100, formatted: '+100%', type: 'up', text: 'Tăng mới' };
  }

  const diff = cur - prev;
  const rate = Math.round((diff / prev) * 1000) / 10; // làm tròn 1 chữ số thập phân

  if (rate > 0) {
    return { percent: rate, formatted: `+${rate}%`, type: 'up', text: `Tăng ${rate}%` };
  } else if (rate < 0) {
    return { percent: rate, formatted: `${rate}%`, type: 'down', text: `Giảm ${Math.abs(rate)}%` };
  }
  return { percent: 0, formatted: '0%', type: 'neutral', text: 'Không đổi' };
}

/**
 * Xuất dữ liệu bảng ra file CSV/Excel UTF-8 có BOM
 */
export function exportAnalyticsToCsv(filename, columns, rows) {
  const headerLine = columns.map(col => csvCell(col.header)).join(',');
  const rowLines = rows.map(row =>
    columns
      .map(col => {
        const val = typeof col.accessor === 'function' ? col.accessor(row) : row[col.accessor];
        return csvCell(val);
      })
      .join(','),
  );

  const content = [headerLine, ...rowLines].join('\r\n');
  const safeFilename = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  download(safeFilename, content, 'text/csv;charset=utf-8');
}
