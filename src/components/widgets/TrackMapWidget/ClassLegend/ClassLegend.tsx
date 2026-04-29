import styles from './ClassLegend.module.scss';

interface ClassEntry {
  name: string;
  color: string;
}

interface ClassLegendProps {
  classes: ClassEntry[];
  className?: string;
}

export const ClassLegend = ({ classes, className }: ClassLegendProps) => (
  <div className={[styles.legend, className].filter(Boolean).join(' ')}>
    {classes.map(({ name, color }) => (
      <div key={name} className={styles.legendItem}>
        <div className={styles.legendDot} style={{ backgroundColor: color }} />
        <span className={styles.legendLabel}>{name}</span>
      </div>
    ))}
  </div>
);
