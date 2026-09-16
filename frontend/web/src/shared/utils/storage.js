// Storage can be unavailable in private/restricted browsing. Auth still works in memory.
export function readStorage(key) {
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}
export function writeStorage(key, value) {
  try {
    window.sessionStorage.setItem(key, value);
  } catch {
    /* Memory fallback lives in tokenUtils. */
  }
}
export function removeStorage(key) {
  try {
    window.sessionStorage.removeItem(key);
  } catch {
    /* Storage may be blocked. */
  }
}
