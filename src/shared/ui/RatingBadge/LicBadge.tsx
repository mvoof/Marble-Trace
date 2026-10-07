import type { LicBadgeStyle } from '@/types/widget-settings';

import styles from './LicBadge.module.scss';

const LICENSE_CLASS_MAP: Record<string, string> = {
  A: styles.licA,
  B: styles.licB,
  C: styles.licC,
  D: styles.licD,
  R: styles.licR,
};

// The default chip is the base rule set, so it adds no class of its own.
const STYLE_CLASS_MAP: Record<LicBadgeStyle, string> = {
  badge: '',
  plain: styles.licStylePlain,
  dark: styles.licStyleDark,
};

interface LicBadgeProps {
  licString: string;
  /** Drop the class letter and keep the safety rating — the badge's color still carries the class. */
  showLetter?: boolean;
  /** How the value is drawn: two-tone chip, bare number, or number on a dark ground. */
  badgeStyle?: LicBadgeStyle;
  className?: string;
}

export const LicBadge = ({
  licString,
  showLetter = true,
  badgeStyle = 'badge',
  className,
}: LicBadgeProps) => {
  const letter = (licString || 'R').charAt(0).toUpperCase();
  const licClass = LICENSE_CLASS_MAP[letter] ?? styles.licR;
  const styleClass = STYLE_CLASS_MAP[badgeStyle] ?? '';
  const licNumber = licString?.slice(1).trim() || '';

  // Nothing else to show once the letter is dropped, so the badge keeps it
  // rather than rendering as an empty chip.
  const drawsLetter = showLetter || !licNumber;

  return (
    <span
      className={[styles.licBadge, licClass, styleClass, className]
        .filter(Boolean)
        .join(' ')}
    >
      {drawsLetter && <span className={styles.licLetter}>{letter}</span>}
      {licNumber ? <span className={styles.licNumber}>{licNumber}</span> : null}
    </span>
  );
};
