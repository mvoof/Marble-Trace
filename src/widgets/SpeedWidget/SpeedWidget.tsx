import { observer } from 'mobx-react-lite';

import { SpeedDisplay } from './SpeedDisplay/SpeedDisplay';
import { InfoColumn } from './InfoColumn/InfoColumn';
import { PitPanel } from './PitPanel/PitPanel';
import { PitOverlay } from './PitOverlay/PitOverlay';

import styles from './SpeedWidget.module.scss';

export const SpeedWidget = observer(() => (
  <div className={styles.root}>
    <div className={styles.mainRow}>
      <PitPanel />

      <div className={styles.centerRight}>
        <SpeedDisplay />
        <InfoColumn />
        <PitOverlay />
      </div>
    </div>
  </div>
));
