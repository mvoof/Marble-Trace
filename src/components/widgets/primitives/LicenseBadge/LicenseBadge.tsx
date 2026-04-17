import styles from './LicenseBadge.module.scss';

const LICENSE_CLASS_MAP: Record<string, string> = {
  A: styles.licA,
  B: styles.licB,
  C: styles.licC,
  D: styles.licD,
  R: styles.licR,
};

interface LicenseBadgeProps {
  licString: string;
  className?: string;
}

export const LicenseBadge = ({ licString, className }: LicenseBadgeProps) => {
  const parts = licString.split(' ');
  const licClass = parts[0] ?? '';
  const rating = parts[1] ?? '';
  const classStyle = LICENSE_CLASS_MAP[licClass] ?? styles.licR;

  return (
    <span
      className={`${styles.licenseBadge}${className ? ` ${className}` : ''}`}
    >
      <span className={`${styles.licenseClass} ${classStyle}`}>{licClass}</span>
      <span className={styles.licenseRating}>{rating}</span>
    </span>
  );
};
