export function validateAuth(values, mode) {
  const errors = {};
  if (mode === 'register' && !values.fullName.trim()) errors.fullName = 'Vui lòng nhập họ và tên.';
  else if (mode === 'register' && values.fullName.trim().length > 100)
    errors.fullName = 'Họ và tên tối đa 100 ký tự.';
  if (!values.email.trim()) errors.email = 'Vui lòng nhập địa chỉ email.';
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim()))
    errors.email = 'Địa chỉ email chưa đúng định dạng.';
  else if (values.email.trim().length > 254) errors.email = 'Địa chỉ email tối đa 254 ký tự.';
  if (!values.password) errors.password = 'Vui lòng nhập mật khẩu.';
  else if (mode === 'register' && !/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(values.password)) {
    errors.password = 'Dùng ít nhất 8 ký tự, gồm chữ hoa, chữ thường và số.';
  }
  if (new TextEncoder().encode(values.password).length > 72)
    errors.password = 'Mật khẩu tối đa 72 byte UTF-8.';
  if (mode === 'register') {
    if (!values.confirmPassword) errors.confirmPassword = 'Vui lòng xác nhận mật khẩu.';
    else if (values.confirmPassword !== values.password)
      errors.confirmPassword = 'Mật khẩu xác nhận chưa khớp.';
    if (!values.terms) errors.terms = 'Bạn cần đồng ý với điều khoản và chính sách bảo mật.';
  }
  return errors;
}

export function getPasswordStrength(password) {
  if (!password) return { score: 0, label: 'Chưa nhập', tone: 'neutral' };
  if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(password))
    return { score: 1, label: 'Yếu', tone: 'weak' };
  if (password.length < 12 || !/[^A-Za-z0-9]/.test(password)) return { score: 2, label: 'Khá', tone: 'fair' };
  return { score: 3, label: 'Mạnh', tone: 'strong' };
}
