import { observer } from 'mobx-react-lite';

import { projectPositionsLost } from '@widgets/pit-service/pit-service-utils';
import { useBackendComputedStore } from '@entities/cars/computed-context';
import { usePlayerPositionStore } from '@entities/player/player-position-context';

import styles from './PositionBadge.module.scss';

interface PositionBadgeProps {
  useLivePositions: boolean;
  classPositionInMulticlass: boolean;
  showProjectedPosition: boolean;
  secondsLost: number;
}

/**
 * The one part of the footer that follows the field, a heavy 10 Hz frame —
 * everything else in `ServiceFooter` is a settled setting or a state
 * transition, so this is split out to be the only thing that re-renders on
 * `relative`. See `docs/rendering.md`.
 */
export const PositionBadge = observer(
  ({
    useLivePositions,
    classPositionInMulticlass,
    showProjectedPosition,
    secondsLost,
  }: PositionBadgeProps) => {
    // This is the sanctioned shell/body split for a 10 Hz heavy frame, not the
    // escape hatch: `PositionBadge` is deliberately the smallest component
    // that re-renders on `relative`, split out of `ServiceFooter` for exactly
    // that reason. See "The hot/cold split" in docs/rendering.md.
    const { relativeEntries } = useBackendComputedStore();
    const playerPosition = usePlayerPositionStore();

    const { position, total } = playerPosition.playerPositionInfo(
      useLivePositions,
      classPositionInMulticlass
    );

    const lost = showProjectedPosition
      ? projectPositionsLost(
          relativeEntries,
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
