import {
  Car,
  CircleDashed,
  CircleDot,
  Gauge,
  Mountain,
  type LucideIcon,
} from 'lucide-react';

import { useTranslation } from 'react-i18next';

import { directionOf } from '@features/statistics/home-stats';

export type LicenceClass = 'R' | 'D' | 'C' | 'B' | 'A' | 'Pro';

const LICENCE_CLASSES: Record<string, LicenceClass> = {
  R: 'R',
  D: 'D',
  C: 'C',
  B: 'B',
  A: 'A',
  P: 'Pro',
  W: 'Pro',
};

/** "B 3.74" → its class; an unknown letter reads as rookie. */
export const licenceClass = (licence: string): LicenceClass =>
  LICENCE_CLASSES[licence.trim().charAt(0).toUpperCase()] ?? 'R';

interface CategoryLook {
  /** Under `homePage.categories`. */
  nameKey: string;
  icon: LucideIcon;
}

/** The sim's categories; another one shows under its own name. */
const CATEGORY_LOOKS: Record<string, CategoryLook> = {
  'Sports Car': { nameKey: 'sportsCar', icon: Car },
  'Formula Car': { nameKey: 'formulaCar', icon: Gauge },
  Road: { nameKey: 'road', icon: Car },
  Oval: { nameKey: 'oval', icon: CircleDashed },
  'Dirt Road': { nameKey: 'dirtRoad', icon: Mountain },
  'Dirt Oval': { nameKey: 'dirtOval', icon: CircleDot },
};

export const categoryLook = (category: string): CategoryLook | null =>
  Object.hasOwn(CATEGORY_LOOKS, category) ? CATEGORY_LOOKS[category] : null;

const ARROW_UP = '▲';
const ARROW_DOWN = '▼';
const DASH = '—';

/** "▲ 120", "▼ 32", or a dash for no change. */
export const changeLabel = (change: number, digits = 0): string => {
  const direction = directionOf(change);

  if (direction === 'flat') {
    return DASH;
  }

  const arrow = direction === 'up' ? ARROW_UP : ARROW_DOWN;

  return `${arrow} ${Math.abs(change).toFixed(digits)}`;
};

/** The category in the app's language; one the app does not know, as the sim writes it. */
export const useCategoryName = (category: string): string => {
  const { t } = useTranslation('main-app');
  const look = categoryLook(category);

  return look ? t(`homePage.categories.${look.nameKey}`) : category;
};

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

/** `durationParts` in the app's language. */
export const useFormatDuration = () => {
  const { t } = useTranslation('main-app');

  return (seconds: number) => {
    const parts = durationParts(seconds);

    return t(`homePage.duration.${parts.kind}`, parts);
  };
};
