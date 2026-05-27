import styles from './ClassBadge.module.scss';

interface ClassBadgeProps {
  color: string;
  label: string;
  className?: string;
}

export const ClassBadge = ({ color, label, className }: ClassBadgeProps) => {
  if (!label) return null;

  return (
    <span
      className={`${styles.classBadge}${className ? ` ${className}` : ''}`}
      style={{ backgroundColor: color, ['--badge-bg' as string]: color }}
    >
      {label}
    </span>
  );
};
