import { type ReactNode } from 'react';
import { observer } from 'mobx-react-lite';
import type { LucideIcon } from 'lucide-react';

import styles from './StatPill.module.scss';

/** Icon tint driven by a token; `iconColor` overrides it with a data-driven value. */
export type StatPillTone = 'muted' | 'accent' | 'warning' | 'danger';

const ICON_TONE_CLASS: Record<StatPillTone, string> = {
  muted: styles.iconMuted,
  accent: styles.iconAccent,
  warning: styles.iconWarning,
  danger: styles.iconDanger,
};

const ICON_SIZE_PX = 11;

interface StatPillProps {
  /** Value shown at the pill's end — the only required part. */
  children: ReactNode;
  icon?: LucideIcon;
  iconTone?: StatPillTone;
  /** Data-driven icon color (temperature, class or wetness), wins over `iconTone`. */
  iconColor?: string;
  label?: string;
  /** Paints the value red — used when a limit is about to be hit. */
  valueDanger?: boolean;
  pulse?: boolean;
  className?: string;
}

export const StatPill = observer(
  ({
    children,
    icon: Icon,
    iconTone = 'muted',
    iconColor,
    label,
    valueDanger = false,
    pulse = false,
    className,
  }: StatPillProps) => (
    <span
      className={[
        styles.pill,
        pulse ? styles.pillPulse : '',
        className ?? '',
      ].join(' ')}
    >
      {Icon && (
        <Icon
          size={ICON_SIZE_PX}
          color={iconColor ?? 'currentColor'}
          className={`${styles.icon} ${iconColor === undefined ? ICON_TONE_CLASS[iconTone] : ''}`}
        />
      )}

      {label && <span className={styles.label}>{label}</span>}

      <span
        className={`${styles.value} ${valueDanger ? styles.valueDanger : ''}`}
      >
        {children}
      </span>
    </span>
  )
);
