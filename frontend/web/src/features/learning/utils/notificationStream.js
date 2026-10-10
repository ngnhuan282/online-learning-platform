// Parse SSE frames incrementally: UTF-8 characters and CRLF can cross fetch chunks.
export async function consumeNotificationStream(stream, onEvent, signal) {
  if (!stream?.getReader) throw new Error('Máy chủ không trả về luồng thông báo.');
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let event = '';
  let data = [];
  let frameSize = 0;
  const cancel = () => reader.cancel().catch(() => {});
  signal?.addEventListener('abort', cancel, { once: true });
  function line(value) {
    if (value === '') {
      if (data.length && !signal?.aborted) {
        onEvent({ event: event || 'message', data: data.join('\n') });
      }
      event = '';
      data = [];
      frameSize = 0;
      return;
    }
    frameSize += value.length;
    if (frameSize > 65536) throw new Error('Thông báo vượt quá kích thước cho phép.');
    if (value.startsWith(':')) return;
    const colon = value.indexOf(':');
    const field = colon < 0 ? value : value.slice(0, colon);
    let content = colon < 0 ? '' : value.slice(colon + 1);
    if (content.startsWith(' ')) content = content.slice(1);
    if (field === 'event') event = content;
    if (field === 'data') data.push(content);
  }
  function parse(final = false) {
    let start = 0;
    for (let i = 0; i < buffer.length; i++) {
      if (buffer[i] !== '\r' && buffer[i] !== '\n') continue;
      if (buffer[i] === '\r' && i === buffer.length - 1 && !final) break;
      line(buffer.slice(start, i));
      if (buffer[i] === '\r' && buffer[i + 1] === '\n') i++;
      start = i + 1;
    }
    buffer = buffer.slice(start);
    if (buffer.length > 65536) throw new Error('Thông báo vượt quá kích thước cho phép.');
  }
  try {
    while (!signal?.aborted) {
      const { value, done } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      parse(done);
      if (done) break;
    }
  } finally {
    signal?.removeEventListener('abort', cancel);
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

export function notificationCategory(notification) {
  if (notification.category) return notification.category;
  if (['ENROLLMENT', 'COURSE_ENROLLED'].includes(notification.type)) return 'COURSE';
  if (notification.type?.startsWith('PAYMENT_')) return 'PAYMENT';
  if (['PROGRESS', 'QUIZ', 'LESSON_COMPLETED', 'QUIZ_RESULT_AVAILABLE'].includes(notification.type)) {
    return 'LEARNING';
  }
  return 'SYSTEM';
}

export const NOTIFICATION_CATEGORIES = Object.freeze({
  COURSE: 'Khóa học',
  PAYMENT: 'Thanh toán',
  LEARNING: 'Học tập',
  SYSTEM: 'Hệ thống',
});

export function notificationActionUrl(value) {
  // Legacy rows may contain arbitrary URLs. Navigation stays within this application.
  if (
    typeof value !== 'string' ||
    !value.startsWith('/') ||
    value.startsWith('//') ||
    value.includes('\\') ||
    Array.from(value).some(character => character.charCodeAt(0) <= 32)
  )
    return null;
  try {
    const url = new URL(value, 'https://notifications.local');
    return url.origin === 'https://notifications.local' ? value : null;
  } catch {
    return null;
  }
}
