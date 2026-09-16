export function normalizeApiError(error) {
  if (error?.normalized) return error;
  const body = error?.response?.data;
  let message;

  if (typeof body?.message === 'string') {
    message = body.message;
  } else if (error?.code === 'ERR_CANCELED') {
    message = 'Yêu cầu đã được hủy.';
  } else if (error?.code === 'ECONNABORTED') {
    message = 'Yêu cầu quá thời gian chờ. Vui lòng thử lại.';
  } else if (error?.response) {
    message = 'Không thể xử lý yêu cầu.';
  } else {
    message = 'Không thể kết nối máy chủ. Vui lòng thử lại sau.';
  }

  return Object.assign(new Error(message), {
    normalized: true,
    code: body?.code || error?.code || 'NETWORK_ERROR',
    status: error?.response?.status ?? null,
    errors: body?.errors ?? null,
    path: body?.path ?? null,
  });
}

export function getErrorMessage(error, fallback = 'Đã xảy ra lỗi. Vui lòng thử lại.') {
  return error?.message || fallback;
}
