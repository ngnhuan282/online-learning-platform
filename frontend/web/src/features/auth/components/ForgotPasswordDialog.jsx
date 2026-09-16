import { useState } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@mui/material';
import EmailOutlined from '@mui/icons-material/EmailOutlined';
import AuthField from './AuthField';
import Icon from '../../../shared/components/Icon';
import { validateAuth } from '../schemas/authValidation';

export default function ForgotPasswordDialog({ open, onClose }) {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  function submit(event) {
    event.preventDefault();
    const emailError = validateAuth({ email, password: 'unused' }, 'login').email;
    setError(emailError || '');
    if (emailError) {
      event.currentTarget.elements.resetEmail.focus();
      return;
    }
    setNotice('Tính năng khôi phục mật khẩu chưa khả dụng. Chưa có email nào được gửi.');
  }
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs" aria-labelledby="reset-password-title">
      <DialogTitle id="reset-password-title" className="dialog-heading">
        Quên mật khẩu?
        <button type="button" className="icon-button" aria-label="Đóng" onClick={onClose}>
          <Icon name="close" />
        </button>
      </DialogTitle>
      <DialogContent>
        <form className="auth-reset-form" onSubmit={submit} noValidate>
          <p>Nhập địa chỉ email gắn với tài khoản của bạn để yêu cầu đặt lại mật khẩu.</p>
          <AuthField
            name="resetEmail"
            label="Địa chỉ Email"
            type="email"
            autoComplete="email"
            icon={<EmailOutlined />}
            placeholder="name@example.com"
            value={email}
            onChange={event => {
              setEmail(event.target.value);
              setError('');
              setNotice('');
            }}
            error={error}
            required
          />
          <button className="button button-primary auth-submit" type="submit">
            Yêu cầu đặt lại mật khẩu <Icon name="arrow" size={18} />
          </button>
          {notice && (
            <p className="auth-notice" role="status">
              {notice}
            </p>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
}
