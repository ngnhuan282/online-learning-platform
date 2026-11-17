export const ADMIN_FEEDBACK_EVENT = 'chitchatgo:admin-feedback';

export function isAdminMutation(config) {
  return Boolean(
    globalThis.window?.location?.pathname?.startsWith('/admin') &&
    ['post', 'put', 'patch', 'delete'].includes(config?.method?.toLowerCase()) &&
    !config?.url?.startsWith('/api/v1/auth/'),
  );
}

export function notifyAdminFailure(error) {
  if (error?.code === 'ERR_CANCELED' || error?.adminToastShown) return;
  if (!globalThis.window?.location?.pathname?.startsWith('/admin')) return;
  const messages = {
    BAD_REQUEST: 'Dữ liệu không hợp lệ. Vui lòng kiểm tra lại các trường.',
    VALIDATION_ERROR: 'Dữ liệu không hợp lệ. Vui lòng kiểm tra lại các trường.',
    EMAIL_ALREADY_EXISTS: 'Email đã tồn tại trong hệ thống.',
    FORBIDDEN: 'Bạn không có quyền thực hiện thao tác này.',
    CONFLICT: 'Dữ liệu đã thay đổi hoặc đang được sử dụng. Hãy tải lại trước khi tiếp tục.',
    NOT_FOUND: 'Không tìm thấy dữ liệu được yêu cầu.',
  };
  if (error && typeof error === 'object') error.adminToastShown = true;
  dispatch({
    severity: 'error',
    message: messages[error?.code] || error?.message || 'Thao tác thất bại. Vui lòng thử lại.',
  });
}

export function notifyAdminSuccess(config) {
  if (!config?.adminFeedback) return;
  const method = config.method?.toLowerCase();
  const message =
    method === 'delete'
      ? 'Đã xóa thành công.'
      : method === 'post'
        ? 'Thao tác đã hoàn tất thành công.'
        : 'Đã cập nhật thành công.';
  dispatch({ severity: 'success', message });
}

function dispatch(detail) {
  const target = globalThis.window;
  if (target?.dispatchEvent && typeof target.CustomEvent === 'function') {
    target.dispatchEvent(new target.CustomEvent(ADMIN_FEEDBACK_EVENT, { detail }));
  }
}
