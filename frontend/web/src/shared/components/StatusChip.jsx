import { Chip } from '@mui/material';
const colors = {
  ACTIVE: 'success',
  COMPLETED: 'success',
  PUBLISHED: 'success',
  SUCCESS: 'success',
  PENDING: 'warning',
  IN_PROGRESS: 'warning',
  FAILED: 'error',
  CANCELLED: 'default',
  DRAFT: 'default',
  ARCHIVED: 'default',
};
export default function StatusChip({ status, label, ...props }) {
  return <Chip size="small" color={colors[status] || 'default'} label={label || status || '—'} {...props} />;
}
