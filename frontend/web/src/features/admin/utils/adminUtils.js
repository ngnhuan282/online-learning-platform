export const can = (user, permission) =>
  Boolean(
    permission &&
      user?.status !== 'LOCKED' &&
      user?.status !== 'DISABLED' &&
      user?.roles?.some(role => role !== 'USER') &&
      user?.permissions?.includes(permission),
  );
export const number = value => (value == null ? '—' : new Intl.NumberFormat('vi-VN').format(value));
export const money = value =>
  value == null
    ? '—'
    : new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(
        value,
      );
export const date = value => (value ? new Date(value).toLocaleString('vi-VN') : 'Chưa đăng nhập');
export const initials = name =>
  name
    ?.trim()
    .split(/\s+/)
    .slice(-2)
    .map(word => word[0])
    .join('')
    .toUpperCase() || '?';

export function download(filename, content, type = 'text/csv;charset=utf-8') {
  const url = URL.createObjectURL(new Blob(['\ufeff', content], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function csvCell(value) {
  const text = String(value ?? '');
  const safe = /^[=+@\-\t\r\n]/.test(text) ? `'${text}` : text;
  return `"${safe.replaceAll('"', '""')}"`;
}

export function togglePermission(current, code, checked, catalog) {
  const next = new Set(current);
  if (checked) {
    next.add(code);
    catalog.find(p => p.code === code)?.dependencies.forEach(p => next.add(p));
  } else {
    next.delete(code);
    let changed = true;
    while (changed) {
      changed = false;
      catalog.forEach(p => {
        if (next.has(p.code) && p.dependencies.some(dependency => !next.has(dependency))) {
          next.delete(p.code);
          changed = true;
        }
      });
    }
  }
  return [...next];
}
