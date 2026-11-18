import { useCallback, useSyncExternalStore } from 'react';
import useAuth from '../../auth/hooks/useAuth';

const EVENT = 'toeic-bookmarks-changed';
const EMPTY = '[]';
const memory = new Map();
const subscribe = listener => {
  const onStorage = event => {
    if (event.key) memory.delete(event.key);
    else memory.clear();
    listener();
  };
  window.addEventListener(EVENT, listener);
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener(EVENT, listener);
    window.removeEventListener('storage', onStorage);
  };
};

export default function useToeicBookmarks() {
  const { user } = useAuth();
  const key = `chitchatgo.toeic.saved:${user?.id ?? 'guest'}`;
  const read = useCallback(() => {
    try {
      return memory.get(key) ?? window.localStorage.getItem(key) ?? EMPTY;
    } catch {
      return memory.get(key) ?? EMPTY;
    }
  }, [key]);
  const raw = useSyncExternalStore(subscribe, read, () => EMPTY);
  let bookmarks;
  try {
    const saved = JSON.parse(raw);
    bookmarks = Array.isArray(saved)
      ? [...new Set(saved.filter(id => typeof id === 'string' && /^\d+$/.test(id)))]
      : [];
  } catch {
    bookmarks = [];
  }
  const toggle = id => {
    const next = bookmarks.includes(id) ? bookmarks.filter(value => value !== id) : [...bookmarks, id];
    const value = JSON.stringify(next);
    try {
      window.localStorage.setItem(key, value);
      memory.delete(key);
    } catch {
      memory.set(key, value);
    }
    window.dispatchEvent(new Event(EVENT));
  };
  return { bookmarks, toggle };
}
