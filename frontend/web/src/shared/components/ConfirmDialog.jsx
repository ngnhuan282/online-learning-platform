import { t } from '../i18n/locale';
import useLocale from '../i18n/useLocale';
import { useId } from 'react';
import { Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle } from '@mui/material';
export default function ConfirmDialog({
  open,
  title = 'Xác nhận',
  description,
  onConfirm,
  onClose,
  pending = false,
  confirmLabel = 'Xác nhận',
  destructive = false,
  children,
}) {
  useLocale();
  const id = useId();
  return (
    <Dialog
      open={open}
      onClose={pending ? undefined : onClose}
      aria-labelledby={`${id}-title`}
      aria-describedby={description ? `${id}-description` : undefined}
    >
      <DialogTitle id={`${id}-title`}>{t(title)}</DialogTitle>
      {description && (
        <DialogContent>
          <DialogContentText id={`${id}-description`}>{t(description)}</DialogContentText>
        </DialogContent>
      )}
      {children && <DialogContent>{children}</DialogContent>}
      <DialogActions>
        <Button onClick={onClose} disabled={pending} autoFocus>
          {t('Hủy')}
        </Button>
        <Button
          onClick={onConfirm}
          disabled={pending}
          color={destructive ? 'error' : 'primary'}
          variant="contained"
        >
          {pending ? t('Đang xử lý…') : confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
