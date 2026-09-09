import { observer } from 'mobx-react-lite';

import type { RaceDashWidgetSettings } from '@/types/widget-settings';
import { useWidgetSettings } from '@ui/hooks/useWidgetSettings';
import { PIT_LIMITER_BIT } from '@ui/hooks/usePitState';
import { usePlayerStore } from '@store/root-store-context';

import { PitBar } from './PitBar/PitBar';
import { RpmBar } from './RpmBar/RpmBar';

/**
 * Picks the bar to draw and nothing else. The choice is made from the car's
 * status, which arrives four times a second — the revs and the speed that drive
 * either bar are read inside it, so the root does not wake with them.
 */
export const RpmLightsWidget = observer(() => {
  const { carStatus } = usePlayerStore();
  const { showPitAssist } =
    useWidgetSettings<RaceDashWidgetSettings>('race-dash');

  const isLimiterOn =
    ((carStatus?.engine_warnings ?? 0) & PIT_LIMITER_BIT) !== 0;
  const isPitMode =
    showPitAssist && ((carStatus?.on_pit_road ?? false) || isLimiterOn);

  if (isPitMode) {
    return <PitBar />;
  }

  return <RpmBar />;
});
