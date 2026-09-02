import type { SessionState, SessionType } from '@/types/bindings';

const SECONDS_IN_HOUR = 3600;
const SECONDS_IN_MINUTE = 60;

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

export const isSessionEnded = (sessionState: SessionState | null): boolean => {
  if (sessionState === null) {
    return false;
  }

  return sessionState === 'CoolDown';
};

const STATES_AFTER_GREEN_FLAG: SessionState[] = [
  'Racing',
  'Checkered',
  'CoolDown',
];

/**
 * Whether the green flag has dropped. Before it, the field is still filling the
 * grid and positions mean nothing yet — anything derived from how far a car has
 * moved since the start is undefined rather than zero.
 */
export const hasRaceStarted = (sessionState: SessionState | null): boolean => {
  if (sessionState === null) {
    return false;
  }

  return STATES_AFTER_GREEN_FLAG.includes(sessionState);
};

export type SessionColorKey = 'practice' | 'qualify' | 'race' | 'other';

export const resolveSessionColorKey = (
  sessionType: SessionType
): SessionColorKey => {
  if (sessionType === 'Practice') {
    return 'practice';
  }

  if (sessionType === 'Qualify') {
    return 'qualify';
  }

  if (sessionType === 'Race') {
    return 'race';
  }

  return 'other';
};

const UNLIMITED_LAPS = 'unlimited';

/** Whether the session ends on a lap count rather than on the clock. */
export const isLapLimitedSession = (
  sessionLaps: string | null | undefined
): boolean =>
  Boolean(sessionLaps) && sessionLaps!.toLowerCase() !== UNLIMITED_LAPS;

/**
 * A lap-limited session has no time limit, but iRacing still fills
 * `SessionTimeRemain` — with a week. Anything at that scale is the sentinel,
 * not a countdown, so the clock counts up from `session_time` instead of
 * printing 168:00:00.
 */
const UNLIMITED_TIME_SENTINEL_SECONDS = 24 * SECONDS_IN_HOUR;

export const isUnlimitedSessionTime = (remainSeconds: number | null): boolean =>
  remainSeconds !== null && remainSeconds >= UNLIMITED_TIME_SENTINEL_SECONDS;

/**
 * What the session clock should show: the remaining time while there is a real
 * one, otherwise the elapsed time counting up.
 *
 * `isLapLimited` comes from the session's own lap count and outranks the
 * number: a lap race has no time limit at all, so whatever iRacing left in
 * `SessionTimeRemain` — a week, a day, or a day minus the tick it has already
 * counted down — is never a countdown.
 */
export const resolveSessionClock = (
  remainSeconds: number | null,
  elapsedSeconds: number | null,
  isLapLimited = false
): { seconds: number; isCountdown: boolean } => {
  const isCountdown =
    !isLapLimited &&
    remainSeconds !== null &&
    remainSeconds >= 0 &&
    !isUnlimitedSessionTime(remainSeconds);

  return {
    seconds: (isCountdown ? remainSeconds : elapsedSeconds) ?? 0,
    isCountdown,
  };
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

/** How close a countdown is to running out — drives the clock's tone. */
export type ClockUrgency = 'normal' | 'warning' | 'critical';

const CLOCK_WARNING_SECONDS = 300;
const CLOCK_CRITICAL_SECONDS = 60;

export const resolveClockUrgency = (
  remainSeconds: number | null
): ClockUrgency => {
  if (remainSeconds === null || remainSeconds < 0) {
    return 'normal';
  }

  if (remainSeconds <= CLOCK_CRITICAL_SECONDS) {
    return 'critical';
  }

  if (remainSeconds <= CLOCK_WARNING_SECONDS) {
    return 'warning';
  }

  return 'normal';
};
