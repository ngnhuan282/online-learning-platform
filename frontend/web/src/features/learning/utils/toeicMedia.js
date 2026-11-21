import { API_PREFIX } from '../../../shared/constants/appConstants';

const prefix = `${API_PREFIX}/learning/toeic/media/`;
const mediaId = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/;

export const isToeicMediaPath = path =>
  typeof path === 'string' && path.startsWith(prefix) && mediaId.test(path.slice(prefix.length));

export function resolveToeicMediaUrl(path) {
  if (!isToeicMediaPath(path)) return path;
  const gateway = (import.meta.env?.VITE_API_URL || '').trim().replace(/\/+$/, '');
  return `${gateway}${path}`;
}
