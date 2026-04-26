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
  const letter = (licString || 'R').charAt(0).toUpperCase();
  const classStyle = LICENSE_CLASS_MAP[letter] ?? styles.licR;

  return (
    <span
      className={`${styles.licenseBadge} ${classStyle}${className ? ` ${className}` : ''}`}
    >
      {licString.slice(1).trim()}
    </span>
  );
};
