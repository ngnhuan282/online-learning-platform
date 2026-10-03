import { API_PREFIX } from '../constants/appConstants.js';

export function resolveMediaUrl(url, baseUrl = import.meta.env?.VITE_API_URL || '') {
  if (typeof url !== 'string' || !url) return url;
  if (!url.startsWith(`${API_PREFIX}/media/`)) return url;

  const normalizedBase = baseUrl.trim().replace(/\/+$/, '');
  return normalizedBase ? `${normalizedBase}${url}` : url;
}