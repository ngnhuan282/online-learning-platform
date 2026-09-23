import { Alert, Button, CircularProgress } from '@mui/material';
import { Refresh } from '@mui/icons-material';

export function PageHeading({ title, description, children }) {
  return <div className="admin-page-heading"><div><h1>{title}</h1><p>{description}</p></div><div className="admin-actions">{children}</div></div>;
}

export function StatCard({ title, value, detail, icon, tone = 'blue' }) {
  return <section className="admin-stat"><div className="admin-stat-label">{title}<span className={`admin-stat-icon ${tone}`}>{icon}</span></div><strong>{value}</strong><p>{detail}</p></section>;
}

export function LoadState({ loading, error, retry }) {
  if (loading) return <div className="admin-loading" role="status"><CircularProgress size={24} /> Đang tải dữ liệu...</div>;
  if (error) return <Alert severity="error" action={retry && <Button color="inherit" onClick={retry} startIcon={<Refresh />}>Thử lại</Button>}>{error.status === 403 ? 'Bạn không có quyền thực hiện thao tác này.' : error.status === 409 ? 'Dữ liệu đã thay đổi hoặc đang được sử dụng. Hãy tải lại trước khi tiếp tục.' : error.message || 'Không thể tải dữ liệu. Vui lòng thử lại.'}</Alert>;
  return null;
}
