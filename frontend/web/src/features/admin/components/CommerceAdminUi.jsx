import { useEffect, useState } from 'react';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Tooltip,
  Pagination,
  TextField,
  MenuItem,
} from '@mui/material';
import {
  VisibilityOutlined,
  EditOutlined,
  DeleteOutlineOutlined,
  RestoreOutlined,
  LockOutlined,
  LockOpenOutlined,
} from '@mui/icons-material';
import useWorkspaceMutation from '../../engagement/hooks/useWorkspaceMutation';
import { LoadState } from './AdminUi';
import { t } from '../../../shared/i18n/locale';
import useLocale from '../../../shared/i18n/useLocale';
import { PAGE_SIZE_OPTIONS } from '../../../shared/constants/pagination';
import '../commerce-admin.css';

export function Field({ label, children, ...props }) {
  useLocale();
  if (!children) {
    const { value, onChange, type = 'text', required, disabled, ...native } = props;
    return (
      <TextField
        fullWidth
        size="small"
        label={t(label)}
        value={value}
        onChange={onChange}
        type={type}
        required={required}
        disabled={disabled}
        slotProps={{
          htmlInput: native,
          inputLabel: type === 'datetime-local' ? { shrink: true } : undefined,
        }}
      />
    );
  }
  return (
    <label className="commerce-field">
      <span>{t(label)}</span>
      {children}
    </label>
  );
}

export function AdminDetailsDialog({ title, children, onClose }) {
  return (
    <Dialog open className="admin-dialog" onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{t(title)}</DialogTitle>
      <DialogContent>
        <div className="commerce-form">{children}</div>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t('Đóng')}</Button>
      </DialogActions>
    </Dialog>
  );
}

export function AdminDeleteDialog({
  item,
  restore = false,
  title,
  actionLabel,
  description,
  onClose,
  onSubmit,
  onSaved,
}) {
  const [reason, setReason] = useState('');
  return (
    <AdminActionDialog
      title={title || (restore ? 'Khôi phục dữ liệu' : 'Xóa dữ liệu')}
      actionLabel={actionLabel || (restore ? 'Khôi phục' : 'Xóa')}
      onClose={onClose}
      onSubmit={() => onSubmit({ version: item.version || 0, reason })}
      onSaved={onSaved}
    >
      <strong>{item.nameKey || item.name || item.label || item.title || item.code}</strong>
      <p className="commerce-info">
        {t(
          description ||
            (restore
              ? 'Dữ liệu được khôi phục ở trạng thái tắt. Bạn có thể chỉnh sửa để bật lại.'
              : 'Dữ liệu được đưa vào thùng rác. Lịch sử giao dịch và quyền lợi đã cấp được giữ nguyên.'),
        )}
      </p>
      <ReasonField value={reason} onChange={event => setReason(event.target.value)} />
    </AdminActionDialog>
  );
}
export function ReasonField({ value, onChange }) {
  return (
    <Field label="Lý do thay đổi">
      <textarea required maxLength={400} rows={3} value={value} onChange={onChange} />
    </Field>
  );
}
export function AdminActionDialog({
  title,
  children,
  onClose,
  onSubmit,
  onSaved,
  actionLabel = 'Lưu thay đổi',
}) {
  useLocale();
  const mutation = useWorkspaceMutation();
  return (
    <Dialog
      open
      className="admin-dialog"
      onClose={mutation.busy ? undefined : onClose}
      fullWidth
      maxWidth="sm"
    >
      <form
        onSubmit={event => {
          event.preventDefault();
          mutation.run(onSubmit, onSaved);
        }}
      >
        <DialogTitle>{t(title)}</DialogTitle>
        <DialogContent>
          <fieldset className="commerce-form" disabled={mutation.busy}>
            {children}
          </fieldset>
          <LoadState error={mutation.error} />
        </DialogContent>
        <DialogActions>
          <Button disabled={mutation.busy} onClick={onClose}>
            {t('Hủy')}
          </Button>
          <Button type="submit" variant="contained" disabled={mutation.busy}>
            {t(mutation.busy ? 'Đang xử lý…' : actionLabel)}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
export function AdminRowActions({ actions }) {
  const icons = {
    view: VisibilityOutlined,
    edit: EditOutlined,
    delete: DeleteOutlineOutlined,
    restore: RestoreOutlined,
    lock: LockOutlined,
    unlock: LockOpenOutlined,
  };
  return (
    <div className="admin-row-actions">
      {actions.filter(Boolean).map(({ kind, label, onClick, disabled }) => {
        const Icon = icons[kind] || EditOutlined;
        return (
          <Tooltip key={label} title={t(label)}>
            <span>
              <IconButton
                aria-label={t(label)}
                color={kind === 'delete' ? 'error' : 'default'}
                disabled={disabled}
                onClick={onClick}
              >
                <Icon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
        );
      })}
    </div>
  );
}

export function CommerceTable({ columns, rows, rowKey = 'id', paginate = false, pagination }) {
  useLocale();
  const tableRows = Array.isArray(rows) ? rows : [];
  const [localPage, setLocalPage] = useState(0);
  const [localSize, setLocalSize] = useState(10);
  const page = pagination?.page ?? localPage;
  const size = pagination?.size ?? localSize;
  const setPage = pagination?.onChange || setLocalPage;
  const setSize = pagination?.onSizeChange || setLocalSize;
  const currentPage = Math.min(page, Math.max(0, Math.ceil(tableRows.length / size) - 1));
  useEffect(() => {
    if (page !== currentPage) setPage(currentPage);
  }, [page, currentPage, setPage]);
  const visible = paginate ? tableRows.slice(currentPage * size, (currentPage + 1) * size) : tableRows;
  return (
    <section className="admin-card admin-table-card">
      <div className="admin-table-scroll">
        <table className="admin-table">
          <thead>
            <tr>
              {columns.map(([label]) => (
                <th key={label}>{t(label)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map(row => (
              <tr key={row[rowKey]}>
                {columns.map(([label, render]) => (
                  <td key={label}>{typeof render === 'function' ? render(row) : (row[render] ?? '—')}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {!tableRows.length && <p className="admin-empty">{t('Không có dữ liệu.')}</p>}
      </div>
      {paginate && (
        <CommercePager
          data={{
            totalElements: tableRows.length,
            totalPages: Math.ceil(tableRows.length / size),
            content: visible,
          }}
          page={currentPage}
          size={size}
          onChange={setPage}
          onSizeChange={value => {
            setSize(value);
            setPage(0);
          }}
        />
      )}
    </section>
  );
}
export function CommercePager({ data, page, onChange, size = 20, onSizeChange }) {
  useLocale();
  useEffect(() => {
    if (data && page >= Math.max(1, data.totalPages || 1)) onChange(Math.max(0, (data.totalPages || 1) - 1));
  }, [data, page, onChange]);
  return (
    <div className="admin-pagination">
      <span>
        {t('Hiển thị')} {data?.content?.length ? page * size + 1 : 0}–
        {page * size + (data?.content?.length || 0)} / {data?.totalElements || 0} {t('kết quả')}
      </span>
      {onSizeChange && (
        <TextField
          select
          size="small"
          label={t('Số dòng')}
          value={size}
          onChange={e => onSizeChange(Number(e.target.value))}
        >
          {PAGE_SIZE_OPTIONS.map(value => (
            <MenuItem key={value} value={value}>
              {value} {t('dòng / trang')}
            </MenuItem>
          ))}
        </TextField>
      )}
      <Pagination
        page={page + 1}
        count={Math.max(1, data?.totalPages || 1)}
        onChange={(_, value) => onChange(value - 1)}
        color="primary"
        shape="rounded"
      />
    </div>
  );
}
export function CommerceSearch({ value, onChange, onSubmit }) {
  useLocale();
  return (
    <form
      className="commerce-search"
      onSubmit={event => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <Field label="Tìm theo tên hoặc ID học viên" value={value} maxLength={120} onChange={onChange} />
      <Button type="submit" variant="outlined">
        {t('Tìm kiếm')}
      </Button>
    </form>
  );
}
