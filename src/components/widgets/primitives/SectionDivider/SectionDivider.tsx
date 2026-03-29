import styles from './SectionDivider.module.scss';

interface SectionDividerProps {
  spacing?: 'sm' | 'md' | 'lg';
}

export const SectionDivider = ({ spacing = 'sm' }: SectionDividerProps) => (
  <span className={`${styles.divider} ${styles[`spacing-${spacing}`]}`} />
);
