import { observer } from 'mobx-react-lite';

import { WidgetPanel } from '@ui/shared/WidgetPanel/WidgetPanel';
import { useWheelToWheelWidgetStore } from '@store/root-store-context';
import { BattleSide } from './BattleSide/BattleSide';
import { GapCenter } from './GapCenter/GapCenter';
import { RivalHalf } from './RivalHalf/RivalHalf';

import styles from './WheelToWheelWidget.module.scss';

export const WheelToWheelWidget = observer(() => {
  const wheelToWheel = useWheelToWheelWidgetStore();

  // No fight, no plate: a rival panel with nobody in it is noise on the screen.
  if (!wheelToWheel.isVisible) {
    return null;
  }

  return (
    <WidgetPanel className={styles.root} direction="row" minWidth={0} gap={0}>
      <BattleSide slot="player" />
      <div className={styles.divider} />
      <GapCenter />
      <div className={styles.divider} />
      <RivalHalf />
    </WidgetPanel>
  );
});
