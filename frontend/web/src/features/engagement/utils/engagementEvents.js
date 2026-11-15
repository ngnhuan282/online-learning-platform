export const ENGAGEMENT_CHANGED = 'sgedu:engagement-changed';
export function notifyEngagementChanged() {
  globalThis.window?.dispatchEvent(new Event(ENGAGEMENT_CHANGED));
}
