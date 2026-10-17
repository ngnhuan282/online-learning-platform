import axiosClient from '../../../shared/apis/axiosClient';
import { authApi } from '../api/authApi';
import { can } from '../../admin/utils/adminUtils';

const ATTEMPT_KEY = 'google_login_attempt';
const LINK_ATTEMPT_KEY = 'google_link_attempt';
const base64url = bytes =>
  btoa(String.fromCharCode(...bytes))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/, '');

export function loginDestination(user, from) {
  const safe =
    typeof from === 'string' &&
    from.startsWith('/') &&
    !from.startsWith('//') &&
    !/[\\\s]/.test(from) &&
    ![...from].some(char => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127) &&
    !/%(2f|5c|0[0-9a-f]|1[0-9a-f]|7f)/i.test(from) &&
    !/^\/(login|register|auth)([/?#]|$)/i.test(from) &&
    (!/^\/admin([/?#]|$)/i.test(from) || can(user, 'ADMIN_ACCESS'));
  return safe ? from : can(user, 'ADMIN_ACCESS') ? '/admin' : '/account';
}

export function clearGoogleAttempt(flow = 'login') {
  try {
    window.sessionStorage.removeItem(flow === 'link' ? LINK_ATTEMPT_KEY : ATTEMPT_KEY);
  } catch {
    // Storage may become unavailable after leaving Google; still show the callback result.
  }
}

export function readGoogleAttempt(flow = 'login') {
  try {
    const attempt = JSON.parse(
      window.sessionStorage.getItem(flow === 'link' ? LINK_ATTEMPT_KEY : ATTEMPT_KEY),
    );
    if (
      !/^[A-Za-z0-9_-]{43}$/.test(attempt?.verifier) ||
      !Number.isFinite(attempt?.createdAt) ||
      Date.now() - attempt.createdAt > 600000 ||
      attempt.createdAt > Date.now()
    )
      return null;
    return attempt;
  } catch {
    return null;
  }
}

export async function startGoogleLogin(from) {
  return startGoogle('login', { from });
}

export async function startGoogleLink(currentPassword, userId, from) {
  return startGoogle('link', { currentPassword, userId, from });
}

async function startGoogle(flow, { currentPassword, userId, from }) {
  const verifier = base64url(crypto.getRandomValues(new Uint8Array(32)));
  const challenge = base64url(
    new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))),
  );
  window.sessionStorage.setItem(
    flow === 'link' ? LINK_ATTEMPT_KEY : ATTEMPT_KEY,
    JSON.stringify({ verifier, from, userId, createdAt: Date.now() }),
  );
  try {
    const { data } =
      flow === 'link'
        ? await authApi.startGoogleLink({ currentPassword, challenge })
        : await authApi.startGoogle(challenge);
    if (data?.authorizationPath !== `/api/v1/auth/google/authorize/google?challenge=${challenge}`) {
      throw new Error('Địa chỉ đăng nhập Google không hợp lệ.');
    }
    return new URL(data.authorizationPath, axiosClient.defaults.baseURL).href;
  } catch (error) {
    clearGoogleAttempt(flow);
    throw error;
  }
}

export function googleErrorMessage(code, flow = 'login') {
  if (flow === 'link' && code === 'GOOGLE_LOGIN_CANCELLED') {
    return 'Bạn đã hủy liên kết Google. Tài khoản hiện tại được giữ nguyên.';
  }
  const messages = {
    GOOGLE_LOGIN_CANCELLED: 'Bạn đã hủy đăng nhập Google. Vui lòng thử lại khi sẵn sàng.',
    GOOGLE_LOGIN_UNAVAILABLE:
      'Đăng nhập Google chưa được cấu hình. Vui lòng đăng nhập bằng email và mật khẩu.',
    GOOGLE_EMAIL_CONFLICT:
      'Email này đã có tài khoản. Vui lòng đăng nhập bằng mật khẩu, rồi vào Hồ sơ → Phương thức đăng nhập để liên kết Google.',
    GOOGLE_LINK_PASSWORD_INVALID: 'Mật khẩu hiện tại không chính xác. Vui lòng thử lại.',
    GOOGLE_LINK_LOCAL_REQUIRED: 'Tài khoản này không có mật khẩu local để xác nhận liên kết.',
    GOOGLE_LINK_SESSION_INVALID:
      'Phiên khởi tạo đã thay đổi hoặc kết thúc. Hãy đăng nhập và liên kết lại từ Hồ sơ.',
    GOOGLE_LINK_EXPIRED: 'Xác nhận mật khẩu đã hết hạn. Vui lòng bắt đầu liên kết lại.',
    GOOGLE_LINK_INVALID: 'Mã liên kết không hợp lệ, đã hết hạn hoặc đã được dùng. Vui lòng bắt đầu lại.',
    GOOGLE_LINK_EMAIL_MISMATCH: 'Email Google đã xác minh phải trùng email của tài khoản hiện tại.',
    GOOGLE_IDENTITY_IN_USE:
      'Tài khoản Google này đã thuộc về người dùng khác và không thể chuyển sang tài khoản của bạn.',
    GOOGLE_ACCOUNT_ALREADY_LINKED: 'Tài khoản hiện tại đã liên kết với một Google khác.',
    GOOGLE_LOGIN_REQUIRED: 'Tài khoản này dùng Google. Vui lòng chọn Đăng nhập bằng Google.',
    GOOGLE_IDENTITY_INVALID: 'Google cần cung cấp email đã xác minh. Vui lòng kiểm tra tài khoản Google.',
    ACCOUNT_LOCKED: 'Tài khoản đã bị khóa. Vui lòng liên hệ quản trị viên.',
    ACCOUNT_DISABLED: 'Tài khoản đã bị vô hiệu hóa. Vui lòng liên hệ quản trị viên.',
    GOOGLE_EXCHANGE_INVALID: 'Phiên đăng nhập Google đã hết hạn hoặc không hợp lệ. Vui lòng bắt đầu lại.',
  };
  return Object.hasOwn(messages, code)
    ? messages[code]
    : flow === 'link'
      ? 'Không thể liên kết Google. Vui lòng thử lại từ Hồ sơ.'
      : 'Không thể đăng nhập Google. Vui lòng thử lại từ trang đăng nhập.';
}
