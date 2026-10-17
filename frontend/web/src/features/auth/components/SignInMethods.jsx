import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Dialog, DialogContent, DialogTitle } from '@mui/material';
import LockOutlined from '@mui/icons-material/LockOutlined';
import useAuth from '../hooks/useAuth';
import { userApi } from '../api/userApi';
import AuthField from './AuthField';
import { googleErrorMessage, startGoogleLink } from '../utils/googleLogin';
import '../styles/auth.css';

export default function SignInMethods({ onStatus }) {
  const { user } = useAuth();
  const location = useLocation();
  const [state, setState] = useState({ loading: true });
  const [retry, setRetry] = useState(0);
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const pending = useRef(false);

  useEffect(() => {
    const controller = new AbortController();
    userApi
      .linkedAccounts({ signal: controller.signal })
      .then(response => {
        if (controller.signal.aborted) return;
        if (typeof response.data?.passwordEnabled !== 'boolean') {
          throw new Error('Không thể tải phương thức đăng nhập. Vui lòng thử lại.');
        }
        setState({ data: response.data, loading: false });
        onStatus?.(response.data);
      })
      .catch(failure => {
        if (!controller.signal.aborted) setState({ loading: false, error: failure.message });
      });
    return () => controller.abort();
  }, [user?.id, retry, onStatus]);

  useEffect(() => {
    const reset = event => {
      if (!event.persisted) return;
      pending.current = false;
      setSubmitting(false);
      setPassword('');
    };
    window.addEventListener('pageshow', reset);
    return () => window.removeEventListener('pageshow', reset);
  }, []);

  function close() {
    if (pending.current) return;
    setOpen(false);
    setPassword('');
    setError('');
  }

  async function submit(event) {
    event.preventDefault();
    if (pending.current || !password) return;
    pending.current = true;
    setSubmitting(true);
    setError('');
    const confirmation = password;
    setPassword('');
    try {
      const target = await startGoogleLink(confirmation, user.id, location.pathname);
      window.location.assign(target);
    } catch (failure) {
      pending.current = false;
      setSubmitting(false);
      setError(
        failure.code?.startsWith('GOOGLE_') ? googleErrorMessage(failure.code, 'link') : failure.message,
      );
    }
  }

  return (
    <section id="sign-in-methods" className="sign-in-methods" aria-labelledby="sign-in-methods-title">
      <h2 id="sign-in-methods-title">Phương thức đăng nhập</h2>
      {location.state?.googleLinkUpdated && (
        <p role="status" className="sign-in-success">
          {location.state.alreadyLinked
            ? 'Google này đã được liên kết với tài khoản của bạn.'
            : 'Liên kết Google thành công. Bạn có thể dùng cả mật khẩu và Google để đăng nhập.'}
        </p>
      )}
      {state.loading ? (
        <p role="status">Đang tải phương thức đăng nhập...</p>
      ) : state.error ? (
        <div role="status">
          <p>{state.error}</p>
          <button className="button button-outline" onClick={() => setRetry(value => value + 1)}>
            Thử lại
          </button>
        </div>
      ) : (
        <>
          <p>
            Email và mật khẩu:{' '}
            <strong>
              {state.data.passwordEnabled ? 'Đã thiết lập' : 'Chưa thiết lập; tài khoản sử dụng Google'}
            </strong>
          </p>
          <p>
            Google:{' '}
            <strong>
              {state.data.google ? `Đã liên kết — ${state.data.google.email}` : 'Chưa liên kết'}
            </strong>
          </p>
          {state.data.passwordEnabled && !state.data.google && (
            <>
              <p>
                Liên kết Google có email đã xác minh trùng với {user.email}. Hồ sơ và dữ liệu học tập được giữ
                nguyên.
              </p>
              <button
                type="button"
                className="button button-outline"
                onClick={() => {
                  setError('');
                  setOpen(true);
                }}
              >
                Liên kết Google
              </button>
            </>
          )}
        </>
      )}
      <Dialog open={open} onClose={close} fullWidth maxWidth="xs" aria-labelledby="google-link-title">
        <DialogTitle id="google-link-title">Xác nhận liên kết Google</DialogTitle>
        <DialogContent>
          <form className="auth-reset-form" onSubmit={submit} aria-busy={submitting}>
            <p>Nhập mật khẩu hiện tại, sau đó chọn tài khoản Google có cùng email đã xác minh.</p>
            <AuthField
              name="googleLinkPassword"
              label="Mật khẩu hiện tại"
              type="password"
              autoComplete="current-password"
              icon={<LockOutlined />}
              value={password}
              onChange={event => {
                setPassword(event.target.value);
                setError('');
              }}
              required
            />
            {error && (
              <p className="auth-notice" role="status">
                {error}
              </p>
            )}
            <button type="submit" className="button button-primary" disabled={submitting || !password}>
              {submitting ? 'Đang chuyển đến Google...' : 'Xác nhận và tiếp tục'}
            </button>
            <button type="button" className="button button-outline" disabled={submitting} onClick={close}>
              Hủy
            </button>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}
