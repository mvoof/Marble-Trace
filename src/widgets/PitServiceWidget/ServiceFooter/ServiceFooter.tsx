import { observer } from 'mobx-react-lite';

import styles from './ServiceFooter.module.scss';
import type { PitServiceWidgetSettings } from '@/types/widget-settings';
import { projectPositionsLost } from '@utils/widget/pit-service-utils';
import {
  useBackendComputedStore,
  usePitServiceWidgetStore,
  useStandingsWidgetStore,
  useWidgetSettingsStore,
} from '@store/root-store-context';

export const ServiceFooter = observer(() => {
  const { pitStops, relative } = useBackendComputedStore();
  const pitServiceWidget = usePitServiceWidgetStore();
  const standingsWidget = useStandingsWidgetStore();
  const widgetSettings = useWidgetSettingsStore();

  const { useLivePositions, classPositionInMulticlass, showProjectedPosition } =
    widgetSettings.getSettings<PitServiceWidgetSettings>('pit-service');

  const stops = pitStops?.playerStops ?? 0;

  // Same resolver the Race Dash and Timer use, so all three agree on what "P4"
  // means in a multiclass field.
  const { position, total } = standingsWidget.playerPositionInfo(
    useLivePositions,
    classPositionInMulticlass
  );

  // Repairs and tow come from the sim; the service part is what is left of a
  // stop as long as the previous one, since the sim reports no duration.
  const secondsLost = pitServiceWidget.expectedRemainingS ?? 0;

  const lost = showProjectedPosition
    ? projectPositionsLost(
        relative?.entries ?? [],
        secondsLost,
        classPositionInMulticlass,
        useLivePositions
      )
    : 0;

  // Last place is last place — the field cannot hand out a position that does
  // not exist, whatever the gaps suggest.
  const projected =
    position === null
      ? null
      : total === null
        ? position + lost
        : Math.min(position + lost, total);

  return (
    <footer className={styles.footer}>
      <span>STOP {stops}</span>

      {position !== null && (
        <span>
          P{position}
          {projected !== null && projected > position && (
            <span className={styles.projected}> → P{projected}</span>
          )}
        </span>
      )}
    </footer>
  );
});
