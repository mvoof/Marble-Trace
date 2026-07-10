import { observer } from 'mobx-react-lite';

import { WidgetPanel } from '@/components/shared/WidgetPanel/WidgetPanel';
import { usePitState } from '@widgets/SpeedWidget/hooks/usePitState';
import { useWidgetSettingsStore } from '@store/root-store-context';
import type { RaceDashWidgetSettings } from '@/types/widget-settings';

import { CoachTab } from './CoachTab/CoachTab';
import { PitBlock } from './PitBlock/PitBlock';
import { RingBadge } from './RingBadge/RingBadge';
import { StatsStrip } from './StatsStrip/StatsStrip';

import styles from './RaceDashWidget.module.scss';

const PLATE_STATE_CLASS: Record<string, string> = {
  'limiter-active': styles.plateSafe,
  'limiter-near-exit': styles.plateSafe,
  'limiter-exit': styles.plateSafe,
  'pit-lane': styles.plateWarning,
  'over-limit': styles.plateDanger,
};

export const RaceDashWidget = observer(() => {
  const { pitState, showPitAssist } = usePitState('race-dash');
  const widgetSettings = useWidgetSettingsStore();

  const settings =
    widgetSettings.getSettings<RaceDashWidgetSettings>('race-dash');

  const isPitMode = showPitAssist && pitState !== 'normal';
  const plateStateClass = isPitMode ? PLATE_STATE_CLASS[pitState] : '';

  return (
    <WidgetPanel
      gap={0}
      minWidth={0}
      direction="row"
      className={`${styles.plate} ${plateStateClass}`}
    >
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
