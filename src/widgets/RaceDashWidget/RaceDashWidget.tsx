import { observer } from 'mobx-react-lite';

import { WidgetPanel } from '@/components/shared/WidgetPanel/WidgetPanel';
import { usePitState } from '@hooks/usePitState';
import { useWidgetSettingsStore } from '@store/root-store-context';
import type { RaceDashWidgetSettings } from '@/types/widget-settings';

import { CoachTab } from './CoachTab/CoachTab';
import { PitBlock } from './PitBlock/PitBlock';
import { RingBadge } from './RingBadge/RingBadge';
import { StatsStrip } from './StatsStrip/StatsStrip';

import styles from './RaceDashWidget.module.scss';

export const RaceDashWidget = observer(() => {
  const { pitState, showPitAssist } = usePitState();
  const widgetSettings = useWidgetSettingsStore();

  const settings =
    widgetSettings.getSettings<RaceDashWidgetSettings>('race-dash');

  const isPitMode = showPitAssist && pitState !== 'normal';

  return (
    <WidgetPanel gap={0} minWidth={0} direction="row" className={styles.plate}>
      <RingBadge />

      {isPitMode ? (
        <PitBlock />
      ) : (
        <>
          <StatsStrip expanded={!settings.showReferenceSpeed} />
          {settings.showReferenceSpeed ? <CoachTab /> : null}
        </>
      )}
    </WidgetPanel>
  );
});
