import styles from './RatingBadge.module.scss';

const LICENSE_CLASS_MAP: Record<string, string> = {
  A: styles.licA,
  B: styles.licB,
  C: styles.licC,
  D: styles.licD,
  R: styles.licR,
};

const formatIr = (ir: number): string => {
  if (ir >= 1000) return `${(ir / 1000).toFixed(1)}k`;
  return String(ir);
};

interface RatingBadgeProps {
  licString: string;
  iRating: number;
  className?: string;
}

export const RatingBadge = ({
  licString,
  iRating,
  className,
}: RatingBadgeProps) => {
  const letter = (licString || 'R').charAt(0).toUpperCase();
  const licClass = LICENSE_CLASS_MAP[letter] ?? styles.licR;
  const licNumber = licString?.slice(1).trim() || '';

  return (
    <span className={`${styles.badge}${className ? ` ${className}` : ''}`}>
      <span className={styles.licBadge}>
        <span className={`${styles.licLetter} ${licClass}`}>{letter}</span>
        {licNumber ? (
          <span className={styles.licNumber}>{licNumber}</span>
        ) : null}
      </span>

      <span className={styles.irPart}>{formatIr(iRating)}</span>
    </span>
  );
};
