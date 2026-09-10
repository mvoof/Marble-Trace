import { observer } from 'mobx-react-lite';

import { WidgetPanel } from '@ui/shared/WidgetPanel/WidgetPanel';
import { useWidgetSettings } from '@ui/hooks/useWidgetSettings';
import type { PitLineWidgetSettings } from '@/types/widget-settings';

import { PitSpeedPlate } from './PitSpeedPlate/PitSpeedPlate';
import { PitApproachRail } from './PitApproachRail/PitApproachRail';
import styles from './PitLineWidget.module.scss';

/**
 * Everything about the lane itself: how fast the car may go on it, and how far
 * is left to roll. Split out of the pit box, which is now only the order — the
 * two answer different questions, are read at different moments, and want to
 * sit in different places on the screen.
 *
 * Both bars stand on end: the speed fills towards the limit at the top, the lane
 * fills towards the box, and each carries its number at its foot. Narrow enough
 * to live beside a mirror, and as tall as the driver drags it.
 */
export const PitLineWidget = observer(() => {
  const {
    showPitSpeed,
    showPitApproach,
    showPitBrakeCue,
    showUnits,
    revealOnApproachM,
  } = useWidgetSettings<PitLineWidgetSettings>('pit-line');

  // Both bars size themselves; the panel's shipped 200 px floor is not theirs.
  return (
    <WidgetPanel direction="column" gap={0} minWidth={0}>
      <div className={styles.stack}>
        {showPitSpeed && (
          <div className={styles.slot}>
            <PitSpeedPlate withUnit={showUnits} />
          </div>
        )}

        {showPitApproach && (
          <div className={styles.slot}>
            <PitApproachRail
              withBrakeCue={showPitBrakeCue}
              withUnit={showUnits}
              revealOnApproachM={revealOnApproachM}
            />
          </div>
        )}
      </div>
    </WidgetPanel>
  );
});
