import styles from './ClassBadge.module.scss';

interface ClassBadgeProps {
  color: string;
  label: string;
  className?: string;
}

export const ClassBadge = ({ color, label, className }: ClassBadgeProps) => (
  <span
    className={`${styles.classBadge}${className ? ` ${className}` : ''}`}
    style={{ backgroundColor: color }}
  >
    {label}
  </span>
);
