import styles from './ClassLegend.module.scss';

interface ClassEntry {
  name: string;
  color: string;
}

interface ClassLegendProps {
  classes: ClassEntry[];
}

export const ClassLegend = ({ classes }: ClassLegendProps) => (
  <div className={styles.legend}>
    {classes.map(({ name, color }) => (
      <div key={name} className={styles.legendItem}>
        <div className={styles.legendDot} style={{ backgroundColor: color }} />
        <span className={styles.legendLabel}>{name}</span>
      </div>
    ))}
  </div>
);
