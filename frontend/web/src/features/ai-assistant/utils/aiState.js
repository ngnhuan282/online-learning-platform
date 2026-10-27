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
  const messages = {
    AI_TIMEOUT: 'Trợ lý AI phản hồi quá lâu. Bạn có thể thử gửi lại câu hỏi.',
    AI_QUOTA_EXCEEDED: 'Đã đạt giới hạn sử dụng AI. Vui lòng đợi một lúc rồi thử lại.',
    AI_CONFIGURATION_ERROR: 'Kết nối AI chưa được cấu hình đúng. Vui lòng liên hệ quản trị viên.',
    AI_CONTENT_BLOCKED: 'AI chưa thể trả lời câu hỏi này. Bạn hãy thử diễn đạt lại.',
    AI_REQUEST_IN_PROGRESS: 'Một câu hỏi đang được xử lý. Vui lòng đợi rồi thử lại.',
    AI_CONTEXT_UNAVAILABLE: 'Chưa thể tải ngữ cảnh bài học. Vui lòng thử lại sau.',
  };
  if (messages[error?.code]) return messages[error.code];
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
  if (error?.status === 404) return 'Không tìm thấy hội thoại hoặc bài học được yêu cầu.';
  return error?.message || 'Không thể kết nối trợ lý AI. Vui lòng thử lại.';
}

export function mergeMessages(current, incoming) {
  return [...new Map([...current, ...incoming].map(message => [message.id, message])).values()].sort(
    (a, b) => a.id - b.id,
  );
}

export function groupConversations(conversations, now = new Date()) {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const week = new Date(today);
  week.setDate(week.getDate() - 7);
  const groups = [
    { label: 'Hôm nay', items: [] },
    { label: 'Hôm qua', items: [] },
    { label: '7 ngày qua', items: [] },
    { label: 'Trước đó', items: [] },
  ];
  for (const conversation of conversations) {
    const date = new Date(conversation.updatedAt);
    const index = date >= today ? 0 : date >= yesterday ? 1 : date >= week ? 2 : 3;
    groups[index].items.push(conversation);
  }
  return groups.filter(group => group.items.length > 0);
}

export function readContext(params) {
  const positiveId = value =>
    /^\d+$/.test(value ?? '') && Number.isSafeInteger(Number(value)) && Number(value) > 0;
  const courseId = params.get('courseId');
  const lessonId = params.get('lessonId');
  if ((courseId && !positiveId(courseId)) || (lessonId && (!positiveId(lessonId) || !courseId))) {
    throw new Error('Liên kết bài học không hợp lệ.');
  }
  return {
    courseId: courseId ? Number(courseId) : undefined,
    lessonId: lessonId ? Number(lessonId) : undefined,
  };
}
