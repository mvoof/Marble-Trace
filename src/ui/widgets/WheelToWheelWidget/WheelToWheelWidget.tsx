import { observer } from 'mobx-react-lite';

import { WidgetPanel } from '@ui/shared/WidgetPanel/WidgetPanel';
import { useWidgetSettings } from '@ui/hooks/useWidgetSettings';
import { useWheelToWheelWidgetStore } from '@store/root-store-context';
import type { WheelToWheelWidgetSettings } from '@/types/widget-settings';
import { BattleSide } from './BattleSide/BattleSide';
import { GapCenter } from './GapCenter/GapCenter';
import { RivalHalf } from './RivalHalf/RivalHalf';
import { RowsLayout } from './RowsLayout/RowsLayout';

import styles from './WheelToWheelWidget.module.scss';

export const WheelToWheelWidget = observer(() => {
  const wheelToWheel = useWheelToWheelWidgetStore();
  const settings =
    useWidgetSettings<WheelToWheelWidgetSettings>('wheel-to-wheel');

  // No fight, no plate: a rival panel with nobody in it is noise on the screen.
  if (!wheelToWheel.isVisible) {
    return null;
  }

  if (settings.layout === 'rows') {
    return (
      <WidgetPanel className={styles.rowsRoot} minWidth={0} gap={0}>
        <RowsLayout />
      </WidgetPanel>
    );
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
