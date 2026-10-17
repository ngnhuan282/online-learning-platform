import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import LockOutlined from '@mui/icons-material/LockOutlined';
import AuthField from '../components/AuthField';
import { authApi } from '../api/authApi';
import { validatePasswordReset } from '../schemas/authValidation';
import { ROUTES } from '../../../shared/constants/routes';
import { clearTokens } from '../../../shared/utils/tokenUtils';
import '../styles/auth.css';

const INVALID_LINK = 'Liên kết không hợp lệ, đã hết hạn hoặc đã được sử dụng. Vui lòng yêu cầu liên kết mới.';

export default function ResetPasswordPage() {
  const location = useLocation();
  const [token, setToken] = useState(() => {
    const params = new URLSearchParams(location.hash.slice(1));
    const value = params.get('token');
    return params.getAll('token').length === 1 && /^[A-Za-z0-9_-]{43}$/.test(value) ? value : '';
  });
  const [values, setValues] = useState({ newPassword: '', confirmPassword: '' });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const pending = useRef(false);

  useEffect(() => {
    // Retain the proof only in component memory; remove it from history without an API call.
    window.history.replaceState(window.history.state, '', ROUTES.RESET_PASSWORD);
  }, []);

  function update(event) {
    setValues(previous => ({ ...previous, [event.target.name]: event.target.value }));
    setErrors({});
    setError('');
  }

  async function submit(event) {
    event.preventDefault();
    if (pending.current || !token || done) return;
    const invalid = validatePasswordReset(values);
    setErrors(invalid);
    if (Object.keys(invalid).length) {
      event.currentTarget.elements[Object.keys(invalid)[0]]?.focus();
      return;
    }
    pending.current = true;
    setSubmitting(true);
    setError('');
    const body = { token, ...values };
    setValues({ newPassword: '', confirmPassword: '' });
    try {
      await authApi.resetPassword(body);
      clearTokens();
      setToken('');
      setDone(true);
    } catch (failure) {
      if (failure.code === 'PASSWORD_RESET_TOKEN_INVALID') {
        setToken('');
        setError(INVALID_LINK);
      } else if (failure.code === 'VALIDATION_ERROR') {
        setError(
          'Mật khẩu phải có 8–72 ký tự, gồm chữ hoa, chữ thường và số, tối đa 72 byte UTF-8; xác nhận phải trùng khớp.',
        );
      } else setError('Chưa thể đặt lại mật khẩu. Vui lòng thử lại.');
    } finally {
      pending.current = false;
      setSubmitting(false);
    }
  }

  return (
    <section className="auth-section" aria-labelledby="reset-password-title">
      <div className="auth-card">
        <div className="auth-heading">
          <h1 id="reset-password-title">Đặt lại mật khẩu</h1>
          <p>Chọn mật khẩu mới cho tài khoản của bạn.</p>
        </div>
        {done ? (
          <p className="auth-notice" role="status">
            Đặt lại mật khẩu thành công. Vui lòng đăng nhập bằng mật khẩu mới.
          </p>
        ) : !token ? (
          <p className="auth-notice" role="alert">
            {error || INVALID_LINK}
          </p>
        ) : (
          <form className="auth-reset-form" onSubmit={submit} noValidate aria-busy={submitting}>
            <AuthField
              name="newPassword"
              label="Mật khẩu mới"
              type="password"
              autoComplete="new-password"
              icon={<LockOutlined />}
              value={values.newPassword}
              onChange={update}
              error={errors.newPassword}
              hint="Ít nhất 8 ký tự, gồm chữ hoa, chữ thường và số; tối đa 72 byte UTF-8."
              disabled={submitting}
              required
            />
            <AuthField
              name="confirmPassword"
              label="Xác nhận mật khẩu mới"
              type="password"
              autoComplete="new-password"
              icon={<LockOutlined />}
              value={values.confirmPassword}
              onChange={update}
              error={errors.confirmPassword}
              disabled={submitting}
              required
            />
            {error && (
              <p className="auth-notice" role="alert">
                {error}
              </p>
            )}
            <button type="submit" className="button button-primary auth-submit" disabled={submitting}>
              {submitting ? 'Đang đặt lại mật khẩu...' : 'Đặt lại mật khẩu'}
            </button>
          </form>
        )}
        {!done && (
          <p className="auth-switch">
            <Link to={ROUTES.FORGOT_PASSWORD}>Yêu cầu liên kết mới</Link>
          </p>
        )}
        <p className="auth-switch">
          <Link to={ROUTES.LOGIN}>Quay về đăng nhập</Link>
        </p>
      </div>
    </section>
  );
}
