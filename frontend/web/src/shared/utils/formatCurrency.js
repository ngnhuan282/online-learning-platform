import { DEFAULT_CURRENCY, DEFAULT_LOCALE } from '../constants/appConstants';
export function formatCurrency(value, currency = DEFAULT_CURRENCY, locale = DEFAULT_LOCALE) {
  if (value == null || value === '' || !Number.isFinite(Number(value))) return '—';
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(Number(value));
}
