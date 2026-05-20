import type { SessionState } from '../../../types/bindings';

export type FlagState = 'green' | 'final' | 'checkered';

export const FLAG_LABEL: Record<FlagState, string> = {
  green: 'GREEN',
  final: 'FINAL 5 MIN',
  checkered: 'CHECKERED',
};

export const SECONDS_IN_HOUR = 3600;
export const SECONDS_IN_MINUTE = 60;

const FINAL_FLAG_THRESHOLD_SEC = 300;
const SESSION_FLAG_CHECKERED = 0x0001;

const MONTH_ABBR = [
  'JAN',
  'FEB',
  'MAR',
  'APR',
  'MAY',
  'JUN',
  'JUL',
  'AUG',
  'SEP',
  'OCT',
  'NOV',
  'DEC',
];

const MONTH_NAME_TO_IDX: Record<string, number> = {
  january: 0,
  february: 1,
  march: 2,
  april: 3,
  may: 4,
  june: 5,
  july: 6,
  august: 7,
  september: 8,
  october: 9,
  november: 10,
  december: 11,
};

export const formatWallClock = (date: Date): string => {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');

  return `${hours}:${minutes}`;
};

export const formatPcDate = (date: Date): string => {
  const day = String(date.getDate()).padStart(2, '0');
  const month = MONTH_ABBR[date.getMonth()];
  const year = date.getFullYear();

  return `${day} ${month} ${year}`;
};

export const formatSimDate = (raw: string): string => {
  const parsed = new Date(raw);

  if (!isNaN(parsed.getTime())) {
    const day = String(parsed.getDate()).padStart(2, '0');

    return `${day} ${MONTH_ABBR[parsed.getMonth()]} ${parsed.getFullYear()}`;
  }

  const parts = raw.trim().split(/\s+/);

  if (parts.length >= 3) {
    const year = parts[0];
    const monthIdx = MONTH_NAME_TO_IDX[parts[1].toLowerCase()];
    const day = parts[2].padStart(2, '0');

    if (monthIdx !== undefined) {
      return `${day} ${MONTH_ABBR[monthIdx]} ${year}`;
    }
  }

  return raw;
};

export const formatSimTime = (secondsSinceMidnight: number): string => {
  const total = Math.round(secondsSinceMidnight);
  const hours = String(Math.floor(total / SECONDS_IN_HOUR)).padStart(2, '0');
  const minutes = String(
    Math.floor((total % SECONDS_IN_HOUR) / SECONDS_IN_MINUTE)
  ).padStart(2, '0');

  return `${hours}:${minutes}`;
};

export const resolveFlagState = (
  flags: number | null,
  remainSeconds: number | null
): FlagState => {
  if (flags !== null && (flags & SESSION_FLAG_CHECKERED) !== 0) {
    return 'checkered';
  }

  if (
    remainSeconds !== null &&
    remainSeconds >= 0 &&
    remainSeconds < FINAL_FLAG_THRESHOLD_SEC
  ) {
    return 'final';
  }

  return 'green';
};

export const isSessionEnded = (sessionState: SessionState | null): boolean => {
  if (sessionState === null) {
    return false;
  }

  return sessionState === 'Checkered' || sessionState === 'CoolDown';
};

export const splitTime = (seconds: number): { main: string; secs: string } => {
  const total = Math.max(0, Math.floor(seconds));
  const hours = String(Math.floor(total / SECONDS_IN_HOUR)).padStart(2, '0');
  const minutes = String(
    Math.floor((total % SECONDS_IN_HOUR) / SECONDS_IN_MINUTE)
  ).padStart(2, '0');
  const secs = String(total % SECONDS_IN_MINUTE).padStart(2, '0');

  return { main: `${hours}:${minutes}:`, secs };
};

export const formatLapCount = (
  current: number | null,
  total: string | null
): string => {
  const currentLabel = current !== null ? current : '—';
  const totalLabel = total && total.toLowerCase() !== 'unlimited' ? total : '∞';

  return `LAP ${currentLabel}/${totalLabel}`;
};

export const formatPosition = (
  position: number | null,
  total: number | null
): string => {
  if (position === null) {
    return 'POS —';
  }

  const totalLabel = total !== null ? `/${total}` : '';

  return `POS P${position}${totalLabel}`;
};
