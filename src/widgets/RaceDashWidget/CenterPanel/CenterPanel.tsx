import { observer } from 'mobx-react-lite';

import { CoachLine } from '../CoachLine/CoachLine';
import { GearDigit } from '../GearDigit/GearDigit';
import { RpmFill } from '../RpmFill/RpmFill';
import { SpeedReadout } from '../SpeedReadout/SpeedReadout';

import styles from './CenterPanel.module.scss';

interface CenterPanelProps {
  isPitMode: boolean;
}

export const CenterPanel = observer(({ isPitMode }: CenterPanelProps) => (
  <div className={styles.root}>
    <div className={`${styles.layer} ${isPitMode ? styles.hidden : ''}`}>
      <RpmFill />
      <div className={styles.scrim} />

      <div className={styles.gearSlot}>
        <GearDigit variant="track" />
      </div>

      <div className={styles.speedSlot}>
        <SpeedReadout />
      </div>

      <div className={styles.coachSlot}>
        <CoachLine />
      </div>
    </div>

    <div className={`${styles.layer} ${!isPitMode ? styles.hidden : ''}`}>
      <div className={styles.pitGearSlot}>
        <GearDigit variant="pit" />
      </div>
    </div>
  </div>
));
