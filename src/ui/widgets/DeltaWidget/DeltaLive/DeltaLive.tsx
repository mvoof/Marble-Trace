import { useWidgetSettings } from '@ui/hooks/useWidgetSettings';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { usePlayerStore } from '@store/root-store-context';
import {
  advanceDeltaLatch,
  DELTA_REFERENCE_BADGE,
  formatDelta,
  getDeltaState,
  getDisplayedDelta,
  getGameDelta,
  INITIAL_DELTA_LATCH_STATE,
  isGameDeltaOk,
} from '@utils/delta-utils';
import type { DeltaWidgetSettings } from '@/types/widget-settings';
import { DeltaGauge } from '../DeltaGauge/DeltaGauge';
import { DeltaPlate } from '../DeltaPlate/DeltaPlate';
import styles from './DeltaLive.module.scss';

// Long enough to be read out of the corner of the eye on a straight, short
// enough that the number stands alone again before the next braking point.
const REFERENCE_SWITCH_MS = 1500;

const DELTA_CLASS = {
  ahead: styles.ahead,
  behind: styles.behind,
  neutral: styles.neutral,
};

export const DeltaLive = observer(() => {
  const { lapTiming } = usePlayerStore();
  const { reference, hideWhenNoReference, showGauge } =
    useWidgetSettings<DeltaWidgetSettings>('delta');

  const liveDelta = getGameDelta(lapTiming, reference);
  const deltaOk = isGameDeltaOk(lapTiming, reference);

  // The latch is history, not a render output — advancing it on commit keeps
  // render pure, so React replaying or discarding a render cannot corrupt it.
  // `hasHadReference` gates visibility, so it also needs to be React state.
  const latchRef = useRef(INITIAL_DELTA_LATCH_STATE);
  const previousReferenceRef = useRef(reference);
  const previousHasLapTimingRef = useRef(!!lapTiming);
  const [hasHadReference, setHasHadReference] = useState(false);
  // A switch is announced beside the number, never in place of it: the delta is
  // what the driver is steering by, and a key press is no reason to take it off
  // the screen.
  const [announcing, setAnnouncing] = useState(false);

  useLayoutEffect(() => {
    const referenceChanged = reference !== previousReferenceRef.current;
    const telemetryDropped = !lapTiming && previousHasLapTimingRef.current;

    if (referenceChanged || telemetryDropped) {
      latchRef.current = INITIAL_DELTA_LATCH_STATE;
      setHasHadReference(false);
    }

    if (referenceChanged) {
      setAnnouncing(true);
    }

    previousReferenceRef.current = reference;
    previousHasLapTimingRef.current = !!lapTiming;

    latchRef.current = advanceDeltaLatch(latchRef.current, deltaOk, liveDelta);

    setHasHadReference(latchRef.current.hasHadReference);
  }, [reference, lapTiming, deltaOk, liveDelta]);

  useEffect(() => {
    if (!announcing) {
      return;
    }

    // Keyed by the reference as well, so a second press mid-announcement
    // restarts the window instead of letting the first one close it early.
    const timer = setTimeout(() => {
      setAnnouncing(false);
    }, REFERENCE_SWITCH_MS);

    return () => {
      clearTimeout(timer);
    };
  }, [announcing, reference]);

  // The announcement outranks the no-reference hiding: a switch wipes the
  // latch, so the widget would otherwise vanish at the very moment it has
  // something to say.
  if (hideWhenNoReference && !hasHadReference && !announcing) {
    return null;
  }

  const delta = getDisplayedDelta(latchRef.current, deltaOk, liveDelta);

  return (
    <div className={styles.root}>
      <DeltaPlate className={announcing ? styles.plateAnnouncing : ''}>
        {/* The badge stays mounted and only opens its box, so an announcement
            widens the plate once and a second press inside it changes two
            letters and nothing else — no height moves either way. */}
        <span
          className={`${styles.badge} ${announcing ? styles.badgeShown : ''}`}
          aria-hidden={!announcing}
        >
          <span className={styles.badgeText}>
            {DELTA_REFERENCE_BADGE[reference]}
          </span>
        </span>

        <span
          className={`${styles.delta} ${DELTA_CLASS[getDeltaState(delta)]}`}
        >
          {formatDelta(delta)}
        </span>
      </DeltaPlate>

      {showGauge && (
        <div className={styles.gaugeSlot}>
          <DeltaGauge delta={delta} />
        </div>
      )}
    </div>
  );
});
