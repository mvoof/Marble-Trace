import styles from './ClassBadge.module.scss';

interface ClassBadgeProps {
  color: string;
  label: string;
}

export const ClassBadge = ({ color, label }: ClassBadgeProps) => (
  <span className={styles.classBadge} style={{ backgroundColor: color }}>
    {label}
  </span>
);
