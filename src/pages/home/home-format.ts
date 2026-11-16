import { useTranslation } from 'react-i18next';

const PLUS = '+';
const MINUS = '−';
const CLOCK_MINUTE_DIGITS = 2;

/** "+212", "−3": the change with its sign, `format` writing its size. */
export const signedChange = (
  change: number,
  format: (size: number) => string = String
): string => `${change < 0 ? MINUS : PLUS}${format(Math.abs(change))}`;

const SECONDS_PER_MINUTE = 60;
const MINUTES_PER_HOUR = 60;
const SECONDS_PER_HOUR = SECONDS_PER_MINUTE * MINUTES_PER_HOUR;
/** From this many hours on, the minutes no longer matter. */
const WHOLE_HOURS_FROM = 10;

export type DurationParts =
  | { kind: 'minutes'; minutes: number }
  | { kind: 'hoursMinutes'; hours: number; minutes: number }
  | { kind: 'hours'; hours: number };

/** Time in the car as it reads best: "42 min", "1 h 25 min", "31 h". */
export const durationParts = (seconds: number): DurationParts => {
  const totalMinutes = Math.max(1, Math.round(seconds / SECONDS_PER_MINUTE));
  const hours = Math.floor(totalMinutes / MINUTES_PER_HOUR);

  if (hours === 0) {
    return { kind: 'minutes', minutes: totalMinutes };
  }

  if (hours < WHOLE_HOURS_FROM) {
    return {
      kind: 'hoursMinutes',
      hours,
      minutes: totalMinutes % MINUTES_PER_HOUR,
    };
  }

  return { kind: 'hours', hours: Math.round(seconds / SECONDS_PER_HOUR) };
};

/** Hours and minutes as a clock reads them: "6:42", "0:05". */
export const formatClock = (seconds: number): string => {
  const totalMinutes = Math.round(seconds / SECONDS_PER_MINUTE);
  const hours = Math.floor(totalMinutes / MINUTES_PER_HOUR);
  const minutes = String(totalMinutes % MINUTES_PER_HOUR).padStart(
    CLOCK_MINUTE_DIGITS,
    '0'
  );

  return `${hours}:${minutes}`;
};

/** `durationParts` in the app's language. */
export const useFormatDuration = () => {
  const { t } = useTranslation('main-app');

  return (seconds: number) => {
    const parts = durationParts(seconds);

    return t(`homePage.duration.${parts.kind}`, parts);
  };
};
