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
