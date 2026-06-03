import styles from './LicBadge.module.scss';

const LICENSE_CLASS_MAP: Record<string, string> = {
  A: styles.licA,
  B: styles.licB,
  C: styles.licC,
  D: styles.licD,
  R: styles.licR,
};

export const formatIr = (ir: number): string => {
  if (ir >= 1000) return `${(ir / 1000).toFixed(1)}k`;
  return String(ir);
};

interface LicBadgeProps {
  licString: string;
  className?: string;
}

export const LicBadge = ({ licString, className }: LicBadgeProps) => {
  const letter = (licString || 'R').charAt(0).toUpperCase();
  const licClass = LICENSE_CLASS_MAP[letter] ?? styles.licR;
  const licNumber = licString?.slice(1).trim() || '';

  return (
    <span className={`${styles.licBadge}${className ? ` ${className}` : ''}`}>
      <span className={`${styles.licLetter} ${licClass}`}>{letter}</span>
      {licNumber ? <span className={styles.licNumber}>{licNumber}</span> : null}
    </span>
  );
};
