import type { Translations } from '@/lib/i18n';

/**
 * Parse an EXIF-format date string into a Date object.
 * EXIF format: "2026:03:11 19:30:00" → "2026-03-11T19:30:00"
 */
export function parseExifDate(value: string): Date {
  const fixed = value.replace(/^(\d{4}):(\d{2}):(\d{2})/, '$1-$2-$3').replace(' ', 'T');
  return new Date(fixed);
}

/**
 * Return a human-readable relative time string.
 * Accepts a numeric timestamp or an EXIF date string.
 * When called with Translations, uses i18n keys; otherwise uses English fallback.
 */
export function relativeTime(timestamp: string | number, t?: Translations): string | null {
  const time = typeof timestamp === 'string' ? parseExifDate(timestamp).getTime() : timestamp;
  if (isNaN(time)) return null;
  const now = Date.now();
  const diff = now - time;
  const minutes = Math.floor(diff / 60000);

  if (t) {
    if (minutes < 1) return t.time_justNow;
    if (minutes < 60) return t.time_minutesAgo(minutes);
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return t.time_hoursAgo(hours);
    const days = Math.floor(hours / 24);
    if (days === 1) return t.time_yesterday;
    if (days < 7) return t.time_daysAgo(days);
    return new Date(time).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  // English fallback (used in BillCard on home screen)
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  return new Date(time).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
