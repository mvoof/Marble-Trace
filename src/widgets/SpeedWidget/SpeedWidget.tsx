import { observer } from 'mobx-react-lite';
import { SpeedDisplay } from './SpeedDisplay/SpeedDisplay';
import { EnginePanel } from './EnginePanel/EnginePanel';
import { RpmPanel } from './RpmPanel/RpmPanel';
import { RpmBar } from './RpmBar/RpmBar';
import { PitPanel } from './PitPanel/PitPanel';

import styles from './SpeedWidget.module.scss';

export const SpeedWidget = observer(() => (
  <div className={styles.root}>
    <PitPanel />

    <div className={styles.rightPanel}>
      <div className={styles.speedRow}>
        <SpeedDisplay />

        <RpmPanel />
      </div>

      <RpmBar />
    </div>

    <div className={styles.tempsOverlay}>
      <EnginePanel />
    </div>
  </div>
));
