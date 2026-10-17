import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import EmailOutlined from '@mui/icons-material/EmailOutlined';
import AuthField from '../components/AuthField';
import { authApi } from '../api/authApi';
import { validateAuth } from '../schemas/authValidation';
import { ROUTES } from '../../../shared/constants/routes';
import '../styles/auth.css';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const pending = useRef(false);

  async function submit(event) {
    event.preventDefault();
    if (pending.current) return;
    const invalid = validateAuth({ email, password: 'unused' }, 'login').email;
    setError(invalid || '');
    setNotice('');
    if (invalid) {
      event.currentTarget.elements.resetEmail.focus();
      return;
    }
    pending.current = true;
    setSubmitting(true);
    try {
      await authApi.forgotPassword({ email: email.trim() });
      setNotice(
        'Nếu tài khoản hỗ trợ mật khẩu và có thể khôi phục, bạn sẽ nhận được email hướng dẫn. Vui lòng kiểm tra hộp thư.',
      );
    } catch (failure) {
      setError(
        failure.code === 'PASSWORD_RESET_UNAVAILABLE'
          ? 'Dịch vụ email khôi phục chưa sẵn sàng. Chưa có email nào được gửi. Vui lòng thử lại sau.'
          : failure.code === 'PASSWORD_RESET_RATE_LIMITED'
            ? 'Bạn đã yêu cầu quá thường xuyên. Vui lòng chờ trước khi thử lại (tối đa 3 lần trong 15 phút).'
            : 'Không thể tiếp nhận yêu cầu. Vui lòng thử lại sau.',
      );
    } finally {
      pending.current = false;
      setSubmitting(false);
    }
  }

  return (
    <section className="auth-section" aria-labelledby="forgot-password-title">
      <div className="auth-card">
        <div className="auth-heading">
          <h1 id="forgot-password-title">Quên mật khẩu?</h1>
          <p>Nhập email của tài khoản để yêu cầu đặt lại mật khẩu.</p>
        </div>
        <form className="auth-reset-form" onSubmit={submit} noValidate aria-busy={submitting}>
          <AuthField
            name="resetEmail"
            label="Địa chỉ Email"
            type="email"
            autoComplete="email"
            icon={<EmailOutlined />}
            value={email}
            maxLength={254}
            disabled={submitting}
            onChange={event => {
              setEmail(event.target.value);
              setError('');
              setNotice('');
            }}
            required
          />
          {error && (
            <p className="auth-notice" role="alert">
              {error}
            </p>
          )}
          {notice && (
            <p className="auth-notice" role="status">
              {notice}
            </p>
          )}
          <button className="button button-primary auth-submit" type="submit" disabled={submitting}>
            {submitting ? 'Đang tiếp nhận yêu cầu...' : 'Gửi hướng dẫn đặt lại mật khẩu'}
          </button>
        </form>
        <p className="auth-switch">
          <Link to={ROUTES.LOGIN}>Quay về đăng nhập</Link>
        </p>
      </div>
    </section>
  );
}
