import styles from './LicBadge.module.scss';

const LICENSE_CLASS_MAP: Record<string, string> = {
  A: styles.licA,
  B: styles.licB,
  C: styles.licC,
  D: styles.licD,
  R: styles.licR,
};

interface LicBadgeProps {
  licString: string;
  /** Drop the class letter and keep the safety rating — the badge's color still carries the class. */
  showLetter?: boolean;
  className?: string;
}

export const LicBadge = ({
  licString,
  showLetter = true,
  className,
}: LicBadgeProps) => {
  const letter = (licString || 'R').charAt(0).toUpperCase();
  const licClass = LICENSE_CLASS_MAP[letter] ?? styles.licR;
  const licNumber = licString?.slice(1).trim() || '';

  // Nothing else to show once the letter is dropped, so the badge keeps it
  // rather than rendering as an empty chip.
  const drawsLetter = showLetter || !licNumber;

  return (
    <span
      className={`${styles.licBadge} ${licClass}${className ? ` ${className}` : ''}`}
    >
      {drawsLetter && <span className={styles.licLetter}>{letter}</span>}
      {licNumber ? <span className={styles.licNumber}>{licNumber}</span> : null}
    </span>
  );
};
