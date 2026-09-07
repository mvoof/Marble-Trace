import { observer } from 'mobx-react-lite';

import type { RaceDashWidgetSettings } from '@/types/widget-settings';
import { WidgetPanel } from '@ui/shared/WidgetPanel/WidgetPanel';
import { useWidgetSettings } from '@ui/hooks/useWidgetSettings';
import { usePitServiceWidgetStore } from '@store/root-store-context';

import { PitBlock } from './PitBlock/PitBlock';
import { RingBadge } from './RingBadge/RingBadge';
import { StatsStrip } from './StatsStrip/StatsStrip';

import styles from './RaceDashWidget.module.scss';

/**
 * Picks the strip beside the badge and nothing else. Whether the car is bound by
 * the pit limit is a question the car's status answers four times a second — the
 * speed that decides how far over the limit it is belongs to the block that
 * draws it. See `docs/rendering.md`.
 */
export const RaceDashWidget = observer(() => {
  const { isOnPitRoad, isLimiterOn } = usePitServiceWidgetStore();
  const { showPitAssist } =
    useWidgetSettings<RaceDashWidgetSettings>('race-dash');

  const isPitMode = showPitAssist && (isOnPitRoad || isLimiterOn);

  return (
    <WidgetPanel gap={0} minWidth={0} direction="row" className={styles.plate}>
      <RingBadge />

      {isPitMode ? <PitBlock /> : <StatsStrip />}
    </WidgetPanel>
  );
});
