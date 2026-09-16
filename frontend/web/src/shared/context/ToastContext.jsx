import { createContext, useCallback, useState } from 'react';
import Alert from '@mui/material/Alert';
import Snackbar from '@mui/material/Snackbar';

// Context is exported for useToast, alongside its provider.
// eslint-disable-next-line react-refresh/only-export-components
export const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toast, setToast] = useState({ id: 0, message: '', open: false });
  const showToast = useCallback(message => {
    setToast(previous => ({ id: previous.id + 1, message, open: true }));
  }, []);
  const closeToast = useCallback((event, reason) => {
    if (reason === 'clickaway') return;
    setToast(previous => ({ ...previous, open: false }));
  }, []);

  return (
    <ToastContext.Provider value={showToast}>
      {children}
      <Snackbar
        key={toast.id}
        open={toast.open}
        autoHideDuration={5000}
        disableWindowBlurListener
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
        onClose={closeToast}
      >
        <Alert severity="success" variant="filled" role="status" onClose={closeToast} closeText="Đóng">
          {toast.message}
        </Alert>
      </Snackbar>
    </ToastContext.Provider>
  );
}
