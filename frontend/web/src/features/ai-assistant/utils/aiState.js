export function readCapabilities(data) {
  if (
    typeof data?.available !== 'boolean' ||
    typeof data?.historyAvailable !== 'boolean' ||
    !Number.isInteger(data?.maxMessageLength) ||
    data.maxMessageLength < 1 ||
    data.maxMessageLength > 4000
  ) {
    throw new Error('Không thể tải trạng thái trợ lý AI. Vui lòng thử lại.');
  }
  return data;
}

export function getAiErrorMessage(error) {
  if (error?.code === 'AI_NOT_AVAILABLE') {
    return 'Trợ lý AI chưa sẵn sàng. Vui lòng quay lại sau.';
  }
  if (error?.status === 403) {
    return 'Bạn không có quyền truy cập hội thoại này.';
  }
  if (error?.status === 401) {
    return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.';
  }
  if (error?.status >= 500) {
    return 'Trợ lý AI tạm thời không thể kết nối. Vui lòng thử lại sau.';
  }
  return error?.message || 'Không thể kết nối trợ lý AI. Vui lòng thử lại.';
}
