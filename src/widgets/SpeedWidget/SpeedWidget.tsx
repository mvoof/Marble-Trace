import { observer } from 'mobx-react-lite';

import { SpeedDisplay } from './SpeedDisplay/SpeedDisplay';
import { InfoColumn } from './InfoColumn/InfoColumn';
import { PitPanel } from './PitPanel/PitPanel';
import { PitOverlay } from './PitOverlay/PitOverlay';
import { RpmBar } from './RpmBar/RpmBar';
import { EnginePanel } from './EnginePanel/EnginePanel';

import styles from './SpeedWidget.module.scss';

export const SpeedWidget = observer(() => (
  <div className={styles.root}>
    <RpmBar />

    <div className={styles.mainRow}>
      <PitPanel />

      <div className={styles.centerRight}>
        <SpeedDisplay />
        <InfoColumn />
        <PitOverlay />
      </div>
    </div>

    <div className={styles.tempsOverlay}>
      <EnginePanel />
    </div>
  </div>
));
