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
}) {
  const id = useId();
  return (
    <Dialog
      open={open}
      onClose={pending ? undefined : onClose}
      aria-labelledby={`${id}-title`}
      aria-describedby={description ? `${id}-description` : undefined}
    >
      <DialogTitle id={`${id}-title`}>{title}</DialogTitle>
      {description && (
        <DialogContent>
          <DialogContentText id={`${id}-description`}>{description}</DialogContentText>
        </DialogContent>
      )}
      <DialogActions>
        <Button onClick={onClose} disabled={pending} autoFocus>
          Hủy
        </Button>
        <Button
          onClick={onConfirm}
          disabled={pending}
          color={destructive ? 'error' : 'primary'}
          variant="contained"
        >
          {pending ? 'Đang xử lý…' : confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
