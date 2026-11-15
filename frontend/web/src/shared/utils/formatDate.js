import { getIntlLocale } from '../i18n/locale.js';
export function formatDate(value, options = {}, locale = getIntlLocale()) {
  if (value == null || value === '') return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? '—'
    : new Intl.DateTimeFormat(locale, { timeZone: 'Asia/Ho_Chi_Minh', ...options }).format(date);
}
