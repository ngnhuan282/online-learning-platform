import { useSyncExternalStore } from 'react';
import { getLocale, subscribeLocale } from './locale.js';

export default function useLocale() {
  return useSyncExternalStore(subscribeLocale, getLocale, () => 'vi');
}
