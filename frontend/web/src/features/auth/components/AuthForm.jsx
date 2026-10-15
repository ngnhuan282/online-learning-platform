import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import useAuth from '../hooks/useAuth';
import useToast from '../../../shared/hooks/useToast';
import { getErrorMessage } from '../../../shared/utils/errorUtils';
import { ROUTES } from '../../../shared/constants/routes';
import {
  clearGoogleAttempt,
  googleErrorMessage,
  loginDestination,
  startGoogleLogin,
} from '../utils/googleLogin';
import EmailOutlined from '@mui/icons-material/EmailOutlined';
import LockOutlined from '@mui/icons-material/LockOutlined';
import Lock from '@mui/icons-material/Lock';
import PersonOutlined from '@mui/icons-material/PersonOutlined';
import VerifiedUserOutlined from '@mui/icons-material/VerifiedUserOutlined';
import CheckCircle from '@mui/icons-material/CheckCircle';
import Icon from '../../../shared/components/Icon';
import PolicyDialog from '../../../shared/components/PolicyDialog';
import AuthField from './AuthField';
import SocialAuthButtons from './SocialAuthButtons';
import ForgotPasswordDialog from './ForgotPasswordDialog';
import { getPasswordStrength, validateAuth } from '../schemas/authValidation';
import '../styles/auth.css';

export default function AuthForm({ mode }) {
  const registering = mode === 'register';
  const { login, register } = useAuth();
  const showToast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [submitting, setSubmitting] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const pending = useRef(false);
  const [values, setValues] = useState({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
    terms: false,
    remember: false,
  });
  const [errors, setErrors] = useState({});
  const [notice, setNotice] = useState(
    location.state?.logoutFailed
      ? 'Đã xóa phiên trên thiết bị. Chưa thể xác nhận đăng xuất với máy chủ; vui lòng thử lại khi có kết nối.'
      : '',
  );
  const [policy, setPolicy] = useState(null);
  const [forgotOpen, setForgotOpen] = useState(false);
  const noticeRef = useRef(null);
  const strength = getPasswordStrength(values.password);

  useEffect(() => {
    const reset = event => {
      if (!event.persisted) return;
      pending.current = false;
      setSubmitting(false);
      setGoogleLoading(false);
      clearGoogleAttempt();
    };
    window.addEventListener('pageshow', reset);
    return () => window.removeEventListener('pageshow', reset);
  }, []);

  function update(event) {
    const { name, type, checked, value } = event.target;
    const next = { ...values, [name]: type === 'checkbox' ? checked : value };
    setValues(next);
    setNotice('');
    setErrors(previous => {
      const nextErrors = { ...previous };
      if (previous[name]) nextErrors[name] = validateAuth(next, mode)[name];
      if (name === 'password' && previous.confirmPassword)
        nextErrors.confirmPassword = validateAuth(next, mode).confirmPassword;
      return nextErrors;
    });
  }
  function blur(event) {
    const name = event.target.name;
    setErrors(previous => ({ ...previous, [name]: validateAuth(values, mode)[name] }));
  }
  async function submit(event) {
    event.preventDefault();
    if (pending.current) return;
    const nextErrors = validateAuth(values, mode);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      setNotice('');
      event.currentTarget.elements[Object.keys(nextErrors)[0]]?.focus();
      return;
    }
    pending.current = true;
    setSubmitting(true);
    setNotice('');
    try {
      if (registering) {
        await register(values);
        showToast('Tạo tài khoản thành công. Vui lòng đăng nhập.');
        navigate(ROUTES.LOGIN, { replace: true, state: { from: location.state?.from } });
      } else {
        const user = await login(values);
        const destination = loginDestination(user, location.state?.from);
        showToast('Đăng nhập thành công.');
        navigate(destination, { replace: true });
      }
    } catch (error) {
      const fieldErrors = Object.fromEntries(
        Object.entries(error.errors ?? {}).map(([name, messages]) => [
          name,
          Array.isArray(messages) ? messages[0] : messages,
        ]),
      );
      if (error.code === 'EMAIL_ALREADY_EXISTS') fieldErrors.email = 'Email này đã được đăng ký.';
      setErrors(fieldErrors);
      setNotice(
        error.code === 'GOOGLE_LOGIN_REQUIRED'
          ? googleErrorMessage(error.code)
          : error.code === 'INVALID_CREDENTIALS'
            ? 'Email hoặc mật khẩu không chính xác.'
            : getErrorMessage(error),
      );
      requestAnimationFrame(() => noticeRef.current?.focus());
    } finally {
      pending.current = false;
      setSubmitting(false);
    }
  }
  async function social(provider) {
    if (pending.current) return;
    if (provider !== 'Google') {
      setNotice(
        `${registering ? 'Đăng ký' : 'Đăng nhập'} bằng ${provider} hiện chưa khả dụng. Vui lòng thử lại sau.`,
      );
      requestAnimationFrame(() => noticeRef.current?.focus());
      return;
    }
    pending.current = true;
    setSubmitting(true);
    setGoogleLoading(true);
    setNotice('');
    try {
      window.location.assign(await startGoogleLogin(location.state?.from));
    } catch (error) {
      pending.current = false;
      setSubmitting(false);
      setGoogleLoading(false);
      setNotice(
        error.code === 'GOOGLE_LOGIN_UNAVAILABLE' ? googleErrorMessage(error.code) : getErrorMessage(error),
      );
      requestAnimationFrame(() => noticeRef.current?.focus());
    }
  }
  const fieldProps = name => ({
    name,
    value: values[name],
    onChange: update,
    onBlur: blur,
    error: errors[name],
    required: true,
  });

  return (
    <section className={`auth-section auth-section-${mode}`} aria-labelledby="auth-title">
      <div className={`auth-card auth-card-${mode}`}>
        <div className="auth-heading">
          <h1 id="auth-title">{registering ? 'Tạo tài khoản mới' : 'Đăng nhập tài khoản'}</h1>
          <p>
            {registering
              ? 'Bắt đầu hành trình chinh phục tiếng Anh ngay hôm nay.'
              : 'Chào mừng bạn quay trở lại! Vui lòng nhập thông tin để tiếp tục.'}
          </p>
        </div>
        <SocialAuthButtons
          registering={registering}
          onSelect={social}
          disabled={submitting}
          googleLoading={googleLoading}
        />
        <div className="auth-divider">
          <span>Hoặc {registering ? 'đăng ký' : 'đăng nhập'} bằng Email</span>
        </div>
        <form className="auth-form" onSubmit={submit} noValidate aria-busy={submitting}>
          {registering && (
            <AuthField
              {...fieldProps('fullName')}
              label="Họ và tên"
              icon={<PersonOutlined />}
              autoComplete="name"
              placeholder="Ví dụ: Nguyễn Văn A"
              maxLength={100}
            />
          )}
          <AuthField
            {...fieldProps('email')}
            label="Địa chỉ Email"
            type="email"
            icon={<EmailOutlined />}
            autoComplete="email"
            placeholder="name@example.com"
            maxLength={254}
          />
          <div className="auth-password-group">
            <AuthField
              {...fieldProps('password')}
              label="Mật khẩu"
              type="password"
              icon={<LockOutlined />}
              autoComplete={registering ? 'new-password' : 'current-password'}
              placeholder="••••••••"
              hint={registering ? 'Ít nhất 8 ký tự, gồm chữ hoa, chữ thường và số.' : undefined}
            />
            {registering && (
              <div className={`password-strength ${strength.tone}`}>
                <div className="password-strength-label">
                  <span>Độ mạnh mật khẩu</span>
                  <strong aria-live="polite">
                    {strength.score === 3 && <CheckCircle style={{ fontSize: 15 }} />}
                    {strength.label}
                  </strong>
                </div>
                <div
                  className="password-strength-bars"
                  role="meter"
                  aria-label="Độ mạnh mật khẩu"
                  aria-valuemin={0}
                  aria-valuemax={3}
                  aria-valuenow={strength.score}
                  aria-valuetext={strength.label}
                >
                  {[1, 2, 3].map(level => (
                    <span key={level} className={strength.score >= level ? 'filled' : ''} />
                  ))}
                </div>
              </div>
            )}
          </div>
          {registering && (
            <AuthField
              {...fieldProps('confirmPassword')}
              label="Xác nhận mật khẩu"
              type="password"
              icon={<VerifiedUserOutlined />}
              autoComplete="new-password"
              placeholder="••••••••"
            />
          )}
          {registering ? (
            <div className="auth-terms">
              <label className="auth-checkbox">
                <input
                  type="checkbox"
                  name="terms"
                  checked={values.terms}
                  onChange={update}
                  aria-invalid={Boolean(errors.terms)}
                  aria-describedby={errors.terms ? 'terms-error' : undefined}
                />
                <span>
                  {'Tôi đồng ý với '}
                  <button
                    type="button"
                    className="auth-inline-link"
                    onClick={() => setPolicy('Terms of Service')}
                  >
                    Điều khoản dịch vụ
                  </button>
                  {' và '}
                  <button
                    type="button"
                    className="auth-inline-link"
                    onClick={() => setPolicy('Privacy Policy')}
                  >
                    Chính sách bảo mật
                  </button>
                  {' của LearnSphere.'}
                </span>
              </label>
              {errors.terms && (
                <p id="terms-error" className="auth-field-error">
                  {errors.terms}
                </p>
              )}
            </div>
          ) : (
            <div className="auth-options">
              <label className="auth-checkbox">
                <input type="checkbox" name="remember" checked={values.remember} onChange={update} />
                <span>Ghi nhớ đăng nhập</span>
              </label>
              <button type="button" className="auth-inline-link" onClick={() => setForgotOpen(true)}>
                Quên mật khẩu?
              </button>
            </div>
          )}
          <button className="button button-primary auth-submit" type="submit" disabled={submitting}>
            {submitting ? 'Đang xử lý...' : registering ? 'Tạo tài khoản' : 'Đăng nhập'}
            <Icon name="arrow" size={20} />
          </button>
          {notice && (
            <p ref={noticeRef} tabIndex={-1} role="status" className="auth-notice">
              {notice}
            </p>
          )}
        </form>
        <p className="auth-switch">
          {registering ? 'Đã có tài khoản?' : 'Chưa có tài khoản?'}{' '}
          <Link to={registering ? ROUTES.LOGIN : ROUTES.REGISTER} state={{ from: location.state?.from }}>
            {registering ? 'Đăng nhập' : 'Đăng ký ngay'}
          </Link>
        </p>
        {!registering && (
          <div className="auth-security">
            <Lock style={{ fontSize: 17 }} />
            <span>Mật khẩu của bạn không được lưu trong trình duyệt.</span>
          </div>
        )}
      </div>
      <PolicyDialog topic={policy} onClose={() => setPolicy(null)} />
      {forgotOpen && <ForgotPasswordDialog open onClose={() => setForgotOpen(false)} />}
    </section>
  );
}
