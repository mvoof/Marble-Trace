import { observer } from 'mobx-react-lite';

import styles from './ServiceFooter.module.scss';
import type { PitServiceWidgetSettings } from '@/types/widget-settings';
import {
  projectPositionsLost,
  resolveServiceState,
} from '@ui/widgets/PitServiceWidget/pit-service-utils';
import {
  useBackendComputedStore,
  usePitServiceWidgetStore,
  usePlayerStore,
  useStandingsWidgetStore,
  useWidgetSettingsStore,
} from '@store/root-store-context';

const STATE_LABEL = {
  idle: 'NO ORDER',
  armed: 'ARMED',
  servicing: 'IN BOX',
  towing: 'TOWING',
} as const;

const MANUAL_LABEL = 'MANUAL';

export const ServiceFooter = observer(() => {
  const { pitStops, relative } = useBackendComputedStore();
  const { pitService } = usePlayerStore();
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
  const secondsLost = pitServiceWidget.panel.expectedRemainingS ?? 0;

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

  // The header this widget used to carry said "PIT SERVICE" and nothing else,
  // while the footer ran half empty — so the two states that were up there come
  // down here instead of costing a row of their own.
  const state = resolveServiceState(pitService, pitServiceWidget.isInPitStall);
  const mode = pitServiceWidget.auto.autoModeLabel;

  return (
    <footer className={styles.footer}>
      <span className={`${styles.state} ${styles[state]}`}>
        {STATE_LABEL[state]}
      </span>

      {/*
        Names the halves auto mode still owns — FUEL AUTO once the tires have
        been picked by hand, TIRE AUTO once the fuel has. Absent entirely while
        auto mode is off in the settings.
      */}
      {mode !== null && (
        <span
          className={
            mode === MANUAL_LABEL ? styles.modeManual : styles.modeAuto
          }
        >
          {mode}
        </span>
      )}

      <span className={styles.stops}>STOP {stops}</span>

      {position !== null && (
        <span className={styles.position}>
          P{position}
          {projected !== null && projected > position && (
            <span className={styles.projected}> → P{projected}</span>
          )}
        </span>
      )}
    </footer>
  );
});
