import { observer } from 'mobx-react-lite';

import { WidgetPanel } from '@/components/shared/WidgetPanel/WidgetPanel';
import type { RaceDashWidgetSettings } from '@/types/widget-settings';
import { PIT_LIMITER_BIT } from '@widgets/SpeedWidget/hooks/usePitState';
import {
  usePlayerStore,
  useWidgetSettingsStore,
} from '@store/root-store-context';

import { CenterPanel } from './CenterPanel/CenterPanel';
import { LeftPanel } from './LeftPanel/LeftPanel';
import { RightPanel } from './RightPanel/RightPanel';

import styles from './RaceDashWidget.module.scss';

export const RaceDashWidget = observer(() => {
  const { carStatus } = usePlayerStore();
  const widgetSettings = useWidgetSettingsStore();

  const { showPitAssist } =
    widgetSettings.getSettings<RaceDashWidgetSettings>('race-dash');

  const isLimiter = ((carStatus?.engine_warnings ?? 0) & PIT_LIMITER_BIT) !== 0;
  const onPitRoad = carStatus?.on_pit_road ?? false;
  const isPitMode = showPitAssist && (onPitRoad || isLimiter);

  return (
    <WidgetPanel
      gap={0}
      minWidth={0}
      className={`${styles.cluster} ${isPitMode ? styles.pitMode : ''}`}
    >
      <div className={`${styles.panelBox} ${styles.left}`}>
        <LeftPanel isPitMode={isPitMode} />
      </div>

      <div className={`${styles.panelBox} ${styles.right}`}>
        <RightPanel />
      </div>

      <div className={`${styles.panelBox} ${styles.center}`}>
        <CenterPanel isPitMode={isPitMode} />
      </div>
    </WidgetPanel>
  );
});
