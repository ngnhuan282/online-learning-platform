import { DEFAULT_LOCALE } from '../constants/appConstants';
export function formatDate(value, options = {}, locale = DEFAULT_LOCALE) {
  if (value == null || value === '') return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? '—'
    : new Intl.DateTimeFormat(locale, { timeZone: 'Asia/Ho_Chi_Minh', ...options }).format(date);
}
