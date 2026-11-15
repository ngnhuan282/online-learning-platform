import { Chip } from '@mui/material';
import { t } from '../i18n/locale';
import useLocale from '../i18n/useLocale';
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
  useLocale();
  return (
    <Chip size="small" color={colors[status] || 'default'} label={t(label || status || '—')} {...props} />
  );
}
