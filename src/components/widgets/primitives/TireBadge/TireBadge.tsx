import styles from './TireBadge.module.scss';

const TIRE_CLASS_MAP: Record<string, string> = {
  S: styles.tireSoft,
  M: styles.tireMed,
  H: styles.tireHard,
  W: styles.tireWet,
};

export const TireBadge = ({ tire }: { tire: string }) => {
  if (!tire) return <div className={styles.tireEmpty}>-</div>;

  const code = tire.charAt(0).toUpperCase();
  const cls = TIRE_CLASS_MAP[code] ?? styles.tireMed;

  return <div className={`${styles.tireBadge} ${cls}`}>{code}</div>;
};
