import { observer } from 'mobx-react-lite';
import { WidgetPanel } from '@/components/shared/WidgetPanel/WidgetPanel';
import { useLapStore, useWidgetSettingsStore } from '@store/root-store-context';
import type {
  DeltaWidgetSettings,
  LapTimePosition,
} from '@/types/widget-settings';
import { DeltaLive } from './DeltaLive/DeltaLive';
import { LapFlash } from './LapFlash/LapFlash';
import styles from './DeltaWidget.module.scss';

const FLASH_POSITION_CLASS: Record<LapTimePosition, string> = {
  none: '',
  top: styles.flashTop,
  bottom: styles.flashBottom,
  left: styles.flashLeft,
  right: styles.flashRight,
};

export const DeltaWidget = observer(() => {
  const lapStore = useLapStore();
  const widgetSettings = useWidgetSettingsStore();

  const { lapTimePosition, flashDuration, reference } =
    widgetSettings.getSettings<DeltaWidgetSettings>('delta');

  const lap = lapStore.lastCompletedLap;

  const showFlash = lapTimePosition !== 'none' && lap !== null;

  return (
    <div className={styles.root}>
      {showFlash && lap !== null && (
        <div
          className={`${styles.flash} ${FLASH_POSITION_CLASS[lapTimePosition]}`}
        >
          <LapFlash
            key={lap.lapNum}
            lapNum={lap.lapNum}
            lapTime={lap.lapTime}
            delta={lap.deltas[reference] ?? 0}
            isBest={lap.isBest}
            duration={flashDuration}
            deltaAbove={lapTimePosition === 'top'}
          />
        </div>
      )}

      <WidgetPanel minWidth={0} gap={0}>
        <DeltaLive />
      </WidgetPanel>
    </div>
  );
});
