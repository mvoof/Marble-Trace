import styles from './RatingBadge.module.scss';

const LICENSE_CLASS_MAP: Record<string, string> = {
  A: styles.licA,
  B: styles.licB,
  C: styles.licC,
  D: styles.licD,
  R: styles.licR,
};

const IRATING_TIER_MAP: [number, string][] = [
  [7000, styles.irElite],
  [5000, styles.irPro],
  [3500, styles.irFast],
  [2000, styles.irAboveAvg],
  [1000, styles.irAvg],
  [0, styles.irRookie],
];

const getIratingClass = (ir: number): string => {
  for (const [threshold, cls] of IRATING_TIER_MAP) {
    if (ir >= threshold) return cls;
  }
  return styles.irRookie;
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
  const irClass = getIratingClass(iRating);

  return (
    <span className={`${styles.badge}${className ? ` ${className}` : ''}`}>
      <span className={`${styles.licPart} ${licClass}`}>
        {licString.slice(1).trim()}
      </span>
      <span className={styles.divider} />
      <span className={`${styles.irPart} ${irClass}`}>{formatIr(iRating)}</span>
    </span>
  );
};
