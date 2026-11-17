import { useEffect, useId, useRef, useState } from 'react';
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, Pagination } from '@mui/material';
import FileUploadOutlined from '@mui/icons-material/FileUploadOutlined';
import DownloadOutlined from '@mui/icons-material/DownloadOutlined';
import { t } from '../../../shared/i18n/locale';
import useLocale from '../../../shared/i18n/useLocale';
import { getSessionVersion } from '../../../shared/utils/tokenUtils';
import { createQuestionTemplate, parseQuestionFile, validateImportRows } from '../utils/toeicQuestionImport';

const PAGE_SIZE = 10;

export default function ToeicQuestionImportDialog({ questions, published, onImport, onClose }) {
  useLocale();
  const titleId = useId();
  const descriptionId = useId();
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(null);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const request = useRef(0);
  const session = useRef(getSessionVersion());
  const active = useRef(false);
  const downloadPending = useRef(false);
  const input = useRef(null);
  const validation = validateImportRows(preview?.rows ?? [], questions);
  const errors = [...(preview?.errors ?? []), ...validation.errors];
  const canImport = Boolean(preview) && !loading && !errors.length && validation.canImport;
  const pageCount = Math.max(1, Math.ceil(validation.rows.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const rows = validation.rows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);

  function isCurrent() {
    return active.current && session.current === getSessionVersion();
  }

  function close() {
    request.current++;
    onClose();
  }

  async function readFile(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const currentRequest = ++request.current;
    setLoading(true);
    setPreview(null);
    setError('');
    setPage(1);
    try {
      const result = await parseQuestionFile(file);
      if (isCurrent() && currentRequest === request.current) setPreview(result);
    } catch (failure) {
      if (isCurrent() && currentRequest === request.current)
        setError(failure.message || t('Không thể đọc file. Hãy kiểm tra định dạng và thử lại.'));
    } finally {
      if (isCurrent() && currentRequest === request.current) setLoading(false);
    }
  }

  async function downloadTemplate(format) {
    if (downloadPending.current) return;
    downloadPending.current = true;
    setDownloading(format);
    setError('');
    try {
      const { blob, fileName } = await createQuestionTemplate(format);
      if (!isCurrent()) return;
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      if (isCurrent()) setError(t('Không thể tạo file mẫu. Vui lòng thử lại.'));
    } finally {
      downloadPending.current = false;
      if (isCurrent()) setDownloading(null);
    }
  }

  function confirm() {
    if (!isCurrent()) {
      close();
      return;
    }
    if (!canImport) return;
    // Recheck against the latest form before appending; no network write happens here.
    const current = validateImportRows(preview.rows, questions);
    if (current.canImport && !preview.errors.length) onImport(current.rows.map(row => row.question));
  }

  return (
    <Dialog
      open
      fullWidth
      maxWidth="lg"
      onClose={close}
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      slotProps={{ paper: { className: 'toeic-app toeic-import-dialog' } }}
    >
      <DialogTitle id={titleId}>{t('Import câu hỏi từ file')}</DialogTitle>
      <DialogContent dividers>
        <p id={descriptionId} className="toeic-import-description">
          {t(
            'Tải mẫu, điền câu hỏi rồi chọn file để kiểm tra. Hỗ trợ .xlsx và CSV UTF-8, tối đa 5 MB và 1.000 câu mỗi bộ đề.',
          )}
        </p>
        <div className="toeic-import-templates">
          <Button
            startIcon={<DownloadOutlined />}
            disabled={Boolean(downloading)}
            onClick={() => downloadTemplate('xlsx')}
          >
            {t('Tải mẫu Excel')}
          </Button>
          <Button
            startIcon={<DownloadOutlined />}
            disabled={Boolean(downloading)}
            onClick={() => downloadTemplate('csv')}
          >
            {t('Tải mẫu CSV')}
          </Button>
          {downloading && <span role="status">{t('Đang tạo file mẫu...')}</span>}
        </div>
        <div className="toeic-import-file-picker">
          <Button
            variant="outlined"
            startIcon={<FileUploadOutlined />}
            onClick={() => input.current?.click()}
          >
            {t('Chọn file Excel/CSV')}
          </Button>
          <input
            ref={input}
            type="file"
            hidden
            accept=".xlsx,.csv"
            aria-label={t('File câu hỏi Excel hoặc CSV')}
            onChange={readFile}
          />
          <span>{preview?.fileName ?? t('Chưa chọn file')}</span>
        </div>
        {loading && <p role="status">{t('Đang đọc và kiểm tra câu hỏi...')}</p>}
        {error && <Alert severity="error">{error}</Alert>}
        {errors.map((message, index) => (
          <Alert severity="error" key={`${index}-${message}`}>
            {t(message)}
          </Alert>
        ))}
        {preview && (
          <>
            <div className="toeic-import-summary" role="status">
              <strong>{t('{count} câu hợp lệ', { count: validation.validCount })}</strong>
              <span>{t('{count} dòng có lỗi', { count: validation.invalidCount })}</span>
              {preview.sheetName && <span>{t('Trang tính: {name}', { name: preview.sheetName })}</span>}
            </div>
            {!!validation.invalidCount && (
              <Alert severity="warning">
                {t('Chưa nhập câu nào. Hãy sửa tất cả lỗi trong file rồi chọn lại.')}
              </Alert>
            )}
            {!!rows.length && (
              <div
                className="toeic-import-table-scroll"
                tabIndex={0}
                aria-label={t('Xem trước câu hỏi import')}
              >
                <table className="toeic-import-table">
                  <caption>{t('Xem trước câu hỏi và lỗi theo dòng')}</caption>
                  <thead>
                    <tr>
                      {[
                        'Dòng',
                        'Số câu',
                        'Part',
                        'Câu hỏi và đoạn đọc',
                        'Lựa chọn',
                        'Đáp án và lời giải',
                        'Kiểm tra',
                      ].map(label => (
                        <th key={label} scope="col">
                          {t(label)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(row => (
                      <tr key={row.line} className={row.errors.length ? 'has-errors' : ''}>
                        <td>{row.line}</td>
                        <td>{row.question?.number ?? '—'}</td>
                        <td>{row.question?.part ?? '—'}</td>
                        <td>
                          <div className="toeic-import-cell-text">{row.question?.prompt}</div>
                          {row.question?.passage && (
                            <details>
                              <summary>{t('Xem đoạn đọc')}</summary>
                              <div className="toeic-import-cell-text">{row.question.passage}</div>
                            </details>
                          )}
                        </td>
                        <td>
                          {row.question?.options?.map(option => (
                            <div className="toeic-import-cell-text" key={option.id}>
                              <b>{option.id}.</b> {option.text}
                            </div>
                          ))}
                        </td>
                        <td>
                          <b>{row.question?.correctOptionId}</b>
                          <div className="toeic-import-cell-text">{row.question?.explanation}</div>
                        </td>
                        <td>
                          {row.errors.length ? (
                            <ul>
                              {row.errors.map(message => (
                                <li key={message}>{t(message)}</li>
                              ))}
                            </ul>
                          ) : (
                            <span className="toeic-import-valid">{t('Hợp lệ')}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {pageCount > 1 && (
              <Pagination
                count={pageCount}
                page={currentPage}
                onChange={(_, value) => setPage(value)}
                color="primary"
              />
            )}
          </>
        )}
        <Alert severity="info">
          {t(
            'Import chỉ thêm câu hỏi vào biểu mẫu, giữ nguyên câu hỏi và bài học hiện có. Bấm Lưu bộ đề sau khi kiểm tra để lưu thay đổi.',
          )}
          {published && (
            <p>
              {t(
                'Bộ đề này đang xuất bản: lưu thay đổi sẽ cập nhật nội dung cho học viên. Bạn có thể ẩn bộ đề trước khi chỉnh sửa.',
              )}
            </p>
          )}
        </Alert>
      </DialogContent>
      <DialogActions>
        <Button onClick={close}>{t('Hủy')}</Button>
        <Button variant="contained" disabled={!canImport} onClick={confirm}>
          {validation.validCount
            ? t('Nhập {count} câu hỏi', { count: validation.validCount })
            : t('Nhập câu hỏi')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
