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
 * Xuất dữ liệu bảng ra file CSV/Excel UTF-8 có BOM (legacy fallback)
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

/**
 * Xuất dữ liệu ra file Excel thực sự (.xlsx) bằng ExcelJS
 * @param {Array[]} rows - mảng 2D: [[header1, header2, ...], [val1, val2, ...], ...]
 *   Dòng trống (array rỗng []) = separator row
 * @param {string} filename
 * @param {string} sheetName
 */
export async function exportAnalyticsToExcel(rows, filename = 'bao-cao.xlsx', sheetName = 'Thống kê') {
  const ExcelJS = (await import('exceljs')).default;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'SGEdu Admin';
  workbook.created = new Date();
  const sheet = workbook.addWorksheet(sheetName);

  rows.forEach((row, rowIdx) => {
    if (!row || row.length === 0) {
      sheet.addRow([]);
      return;
    }
    const excelRow = sheet.addRow(row.map(c => c ?? ''));
    // Header row (row 1)
    if (rowIdx === 0) {
      excelRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      excelRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1565C0' } };
      excelRow.alignment = { horizontal: 'center' };
    }
    // Sub-header rows (all strings, after an empty separator row)
    else if (
      row.every(c => typeof c === 'string') &&
      row.length > 1 &&
      rowIdx > 0 &&
      (!rows[rowIdx - 1] || rows[rowIdx - 1].length === 0)
    ) {
      excelRow.font = { bold: true };
      excelRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE3F2FD' } };
    }
  });

  // Auto-fit columns (approximate)
  sheet.columns.forEach(col => {
    let maxLen = 10;
    col.eachCell({ includeEmpty: false }, cell => {
      const len = String(cell.value ?? '').length;
      if (len > maxLen) maxLen = len;
    });
    col.width = Math.min(maxLen + 2, 50);
  });

  // Trigger download
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}
