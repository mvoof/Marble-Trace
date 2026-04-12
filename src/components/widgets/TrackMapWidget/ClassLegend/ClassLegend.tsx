import styles from './ClassLegend.module.scss';

interface ClassEntry {
  name: string;
  color: string;
}

interface ClassLegendProps {
  classes: ClassEntry[];
  position: 'left' | 'right';
}

export const ClassLegend = ({ classes, position }: ClassLegendProps) => (
  <div
    className={`${styles.legend} ${position === 'right' ? styles.legendRight : styles.legendLeft}`}
  >
    <div className={styles.legendTitle}>Class Legend</div>

    <div className={styles.legendItems}>
      {classes.map(({ name, color }) => (
        <div key={name} className={styles.legendItem}>
          <div
            className={styles.legendDot}
            style={{ backgroundColor: color }}
          />
          <span className={styles.legendLabel}>{name}</span>
        </div>
      ))}
    </div>
  </div>
);
