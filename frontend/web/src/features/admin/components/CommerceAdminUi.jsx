import { Button, Dialog, DialogActions, DialogContent, DialogTitle } from '@mui/material';
import useWorkspaceMutation from '../../engagement/hooks/useWorkspaceMutation';
import { LoadState } from './AdminUi';
import { t } from '../../../shared/i18n/locale';
import useLocale from '../../../shared/i18n/useLocale';
import '../commerce-admin.css';

export function Field({ label, children, ...props }) {
  useLocale();
  return (
    <label className="commerce-field">
      <span>{t(label)}</span>
      {children || <input {...props} />}
    </label>
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
    <Dialog open onClose={mutation.busy ? undefined : onClose} fullWidth maxWidth="sm">
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
export function CommerceTable({ columns, rows, rowKey = 'id' }) {
  useLocale();
  return (
    <div className="admin-card admin-table-scroll">
      <table className="admin-table">
        <thead>
          <tr>
            {columns.map(([label]) => (
              <th key={label}>{t(label)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr key={row[rowKey]}>
              {columns.map(([label, render]) => (
                <td key={label}>{typeof render === 'function' ? render(row) : (row[render] ?? '—')}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {!rows.length && <p className="admin-empty">{t('Không có dữ liệu.')}</p>}
    </div>
  );
}
export function CommercePager({ data, page, onChange }) {
  useLocale();
  return (
    <div className="commerce-pager">
      <Button disabled={!page} onClick={() => onChange(page - 1)}>
        {t('Trang trước')}
      </Button>
      <span>
        {page + 1} / {Math.max(1, data?.totalPages || 0)} · {data?.totalElements || 0} {t('kết quả')}
      </span>
      <Button disabled={!data || page + 1 >= data.totalPages} onClick={() => onChange(page + 1)}>
        {t('Trang sau')}
      </Button>
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
