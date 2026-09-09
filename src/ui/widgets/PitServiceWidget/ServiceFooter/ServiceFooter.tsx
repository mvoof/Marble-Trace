import { useWidgetSettings } from '@ui/hooks/useWidgetSettings';
import { observer } from 'mobx-react-lite';

import styles from './ServiceFooter.module.scss';
import type { PitServiceWidgetSettings } from '@/types/widget-settings';
import { resolveServiceState } from '@ui/widgets/PitServiceWidget/pit-service-utils';
import {
  useBackendComputedStore,
  usePitServiceWidgetStore,
  usePlayerStore,
} from '@store/root-store-context';

import { PositionBadge } from './PositionBadge/PositionBadge';

const STATE_LABEL = {
  idle: 'NO ORDER',
  armed: 'ARMED',
  servicing: 'IN BOX',
  towing: 'TOWING',
} as const;

const MANUAL_LABEL = 'MANUAL';

/**
 * Everything here but the position badge is a settled setting or a state
 * transition, not telemetry that moves every tick — `relative`, the one heavy
 * 10 Hz field the footer needs, is read only inside `PositionBadge`, so this
 * shell does not re-render on it. See `docs/rendering.md`.
 */
export const ServiceFooter = observer(() => {
  const { pitStops } = useBackendComputedStore();
  const { pitService } = usePlayerStore();
  const pitServiceWidget = usePitServiceWidgetStore();

  const { useLivePositions, classPositionInMulticlass, showProjectedPosition } =
    useWidgetSettings<PitServiceWidgetSettings>('pit-service');

  const stops = pitStops?.playerStops ?? 0;

  // Repairs and tow come from the sim; the service part is what is left of a
  // stop as long as the previous one, since the sim reports no duration.
  const secondsLost = pitServiceWidget.panel.expectedRemainingS ?? 0;

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

      <PositionBadge
        useLivePositions={useLivePositions}
        classPositionInMulticlass={classPositionInMulticlass}
        showProjectedPosition={showProjectedPosition}
        secondsLost={secondsLost}
      />
    </footer>
  );
});
