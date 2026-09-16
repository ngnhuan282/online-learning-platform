import { Alert, AlertTitle, Button } from '@mui/material';
import { getErrorMessage } from '../utils/errorUtils';
export default function ErrorState({ error, title = 'Không thể tải dữ liệu', onRetry }) {
  return (
    <Alert
      severity="error"
      action={
        onRetry && (
          <Button color="inherit" onClick={onRetry}>
            Thử lại
          </Button>
        )
      }
    >
      <AlertTitle>{title}</AlertTitle>
      {getErrorMessage(error)}
    </Alert>
  );
}
