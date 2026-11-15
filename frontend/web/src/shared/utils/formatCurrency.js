import { DEFAULT_CURRENCY } from '../constants/appConstants';
import { getIntlLocale } from '../i18n/locale.js';
export function formatCurrency(value, currency = DEFAULT_CURRENCY, locale = getIntlLocale()) {
  if (value == null || value === '' || !Number.isFinite(Number(value))) return '—';
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(Number(value));
}
