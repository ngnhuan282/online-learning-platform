import english from './en.json' with { type: 'json' };

const KEY = 'sgedu.locale';
const listeners = new Set();
let locale = 'vi';
try {
  if (
    globalThis.localStorage?.getItem(KEY) === 'en' ||
    globalThis.window?.localStorage?.getItem(KEY) === 'en'
  )
    locale = 'en';
} catch {
  /* Storage may be unavailable in private mode. */
}

export const getLocale = () => locale;
export const getIntlLocale = () => (locale === 'en' ? 'en-US' : 'vi-VN');
export const subscribeLocale = listener => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
function updateDocument() {
  if (!globalThis.document) return;
  document.documentElement.lang = locale;
  document.title =
    locale === 'en'
      ? 'SGEdu English — Learn and grow together'
      : 'SGEdu English — Chinh phục tiếng Anh, mở lối tương lai';
}
export function setLocale(value) {
  if (!['vi', 'en'].includes(value) || value === locale) return;
  locale = value;
  try {
    (globalThis.localStorage ?? globalThis.window?.localStorage)?.setItem(KEY, value);
  } catch {
    /* Still switch in memory. */
  }
  updateDocument();
  listeners.forEach(listener => listener());
}
export function t(value, parameters = {}) {
  if (typeof value !== 'string') return value;
  const translated = locale === 'en' ? (english[value] ?? value) : value;
  return translated.replace(/\{(\w+)\}/g, (match, key) => parameters[key] ?? match);
}
if (globalThis.window) {
  window.addEventListener('storage', event => {
    if (event.key === KEY) setLocale(event.newValue === 'en' ? 'en' : 'vi');
  });
  updateDocument();
}
