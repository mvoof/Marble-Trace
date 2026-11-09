import { useWidgetSettings } from '@entities/layout/useWidgetSettings';
import { observer } from 'mobx-react-lite';

import { StatChip, type StatChipTone } from '@shared/ui/StatChip/StatChip';
import styles from './ServiceFooter.module.scss';
import { resolveServiceState } from '@widgets/pit-service/pit-service-utils';
import { useBackendComputedStore } from '@entities/cars/computed-context';
import { usePitServiceWidgetStore } from '@features/pit-service/pit-service-context';
import { usePlayerStore } from '@entities/player/player-context';

import { PositionBadge } from './PositionBadge/PositionBadge';
import type { PitServiceWidgetSettings } from '../settings-schema';

const STATE_LABEL = {
  idle: 'NO ORDER',
  armed: 'ARMED',
  servicing: 'IN BOX',
  towing: 'TOWING',
} as const;

const STATE_TONE: Record<keyof typeof STATE_LABEL, StatChipTone> = {
  idle: 'muted',
  armed: 'positive',
  servicing: 'accent',
  towing: 'danger',
};

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

  // The header this widget used to carry said "PIT SERVICE" and nothing else,
  // while the footer ran half empty — so the two states that were up there come
  // down here instead of costing a row of their own.
  const state = resolveServiceState(pitService, pitServiceWidget.isInPitStall);
  const mode = pitServiceWidget.auto.autoModeLabel;

  return (
    <footer className={styles.footer}>
      {/*
        One two-part chip: the state, and the halves auto mode still owns —
        FUEL AUTO once the tires have been picked by hand, TIRE AUTO once the
        fuel has. The mode part is absent while auto mode is off.
      */}
      <StatChip lead={STATE_LABEL[state]} tone={STATE_TONE[state]}>
        {mode === null ? undefined : (
          <span
            className={
              mode === MANUAL_LABEL ? styles.modeManual : styles.modeAuto
            }
          >
            {mode}
          </span>
        )}
      </StatChip>

      <PositionBadge
        stops={stops}
        className={styles.stops}
        useLivePositions={useLivePositions}
        classPositionInMulticlass={classPositionInMulticlass}
        showProjectedPosition={showProjectedPosition}
      />
    </footer>
  );
});
