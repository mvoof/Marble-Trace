import { observer } from 'mobx-react-lite';

import styles from './ChassisLayout.module.scss';

interface CenterLabelsProps {
  showSuspensionAndBrakes: boolean;
}

export const CenterLabels = observer(
  ({ showSuspensionAndBrakes }: CenterLabelsProps) => {
    if (!showSuspensionAndBrakes) {
      return null;
    }

    return (
      <div className={styles.centerLabels}>
        <span className={styles.centerLabel}>RH</span>
        <span className={styles.centerLabel}>BRK</span>
        <span className={styles.centerLabel}>SHK</span>
      </div>
    );
  }
);
