import { observer } from 'mobx-react-lite';

import { projectPositionsLost } from '@widgets/pit-service/pit-service-utils';
import { useBackendComputedStore } from '@entities/cars/computed-context';
import { usePlayerPositionStore } from '@entities/player/player-position-context';
import { usePitServiceWidgetStore } from '@features/pit-service/pit-service-context';

import styles from './PositionBadge.module.scss';

interface PositionBadgeProps {
  useLivePositions: boolean;
  classPositionInMulticlass: boolean;
  showProjectedPosition: boolean;
}

/**
 * The one part of the footer that follows the field, a heavy 10 Hz frame, and
 * the stop clock that ticks with it — everything else in `ServiceFooter` is a
 * settled setting or a state transition, so this is split out to be the only
 * thing that re-renders on them. See `docs/rendering.md`.
 */
export const PositionBadge = observer(
  ({
    useLivePositions,
    classPositionInMulticlass,
    showProjectedPosition,
  }: PositionBadgeProps) => {
    // This is the sanctioned shell/body split for a 10 Hz heavy frame, not the
    // escape hatch: `PositionBadge` is deliberately the smallest component
    // that re-renders on the field, split out of `ServiceFooter` for exactly
    // that reason. See "The hot/cold split" in docs/rendering.md.
    // oxlint-disable-next-line no-restricted-properties
    const { fieldEntries } = useBackendComputedStore();
    const playerPosition = usePlayerPositionStore();
    const pitServiceWidget = usePitServiceWidgetStore();

    const { position, total } = playerPosition.playerPositionInfo(
      useLivePositions,
      classPositionInMulticlass
    );

    const secondsLost = pitServiceWidget.panel.timeStillToLoseS ?? 0;

    const lost = showProjectedPosition
      ? projectPositionsLost(
          fieldEntries,
          secondsLost,
          classPositionInMulticlass,
          useLivePositions
        )
      : 0;

    // Last place is last place — the field cannot hand out a position that
    // does not exist, whatever the gaps suggest.
    const projected =
      position === null
        ? null
        : total === null
          ? position + lost
          : Math.min(position + lost, total);

    if (position === null) {
      return null;
    }

    return (
      <span className={styles.position}>
        P{position}
        {projected !== null && projected > position && (
          <span className={styles.projected}> → P{projected}</span>
        )}
      </span>
    );
  }
);
