import styles from './NoDataPlaceholder.module.scss';

export const NoDataPlaceholder = () => (
  <div className={styles.placeholder}>
    <span className={styles.text}>NO DATA</span>
  </div>
);
