import { STORAGE_KEYS } from '../constants/storageKeys';
import { AUTH_CHANGED_EVENT } from '../constants/appConstants';
import { readStorage, removeStorage, writeStorage } from './storage';

let memoryToken = readStorage(STORAGE_KEYS.ACCESS_TOKEN);
let sessionVersion = 0;
let sessionWasCleared = false;

// Decoding is only for UI state; the backend verifies the signature and permissions.
export function decodeToken(token) {
  try {
    if (typeof token !== 'string' || token.split('.').length !== 3) return null;
    const segment = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const bytes = Uint8Array.from(atob(segment.padEnd(Math.ceil(segment.length / 4) * 4, '=')), c =>
      c.charCodeAt(0),
    );
    const claims = JSON.parse(new TextDecoder().decode(bytes));
    return claims && typeof claims === 'object' ? claims : null;
  } catch {
    return null;
  }
}
export function isTokenExpired(token, now = Date.now()) {
  const claims = decodeToken(token);
  return !Number.isFinite(claims?.exp) || claims.exp * 1000 <= now;
}
export function getAccessToken() {
  return memoryToken;
}
export function getSessionVersion() {
  return sessionVersion;
}
export function wasSessionCleared() {
  return sessionWasCleared;
}
export function allowSessionRestore() {
  sessionWasCleared = false;
  window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
}
export function invalidateSessionRequests() {
  sessionVersion++;
}
export function setAccessToken(token, { preserveSession = false } = {}) {
  if (isTokenExpired(token)) throw new Error('Access token is invalid or expired.');
  if (!preserveSession) sessionVersion++;
  sessionWasCleared = false;
  memoryToken = token;
  writeStorage(STORAGE_KEYS.ACCESS_TOKEN, token);
  window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
}
export function clearTokens() {
  sessionVersion++;
  sessionWasCleared = true;
  memoryToken = null;
  removeStorage(STORAGE_KEYS.ACCESS_TOKEN);
  window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
}
