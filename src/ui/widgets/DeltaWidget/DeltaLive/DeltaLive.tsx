import { useWidgetSettings } from '@ui/hooks/useWidgetSettings';
import { useLayoutEffect, useRef, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { usePlayerStore } from '@store/root-store-context';
import {
  advanceDeltaLatch,
  formatDelta,
  getDeltaState,
  getDisplayedDelta,
  getGameDelta,
  INITIAL_DELTA_LATCH_STATE,
  isGameDeltaOk,
} from '@utils/delta-utils';
import type { DeltaWidgetSettings } from '@/types/widget-settings';
import { DeltaGauge } from '../DeltaGauge/DeltaGauge';
import styles from './DeltaLive.module.scss';

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

  useLayoutEffect(() => {
    const referenceChanged = reference !== previousReferenceRef.current;
    const telemetryDropped = !lapTiming && previousHasLapTimingRef.current;

    if (referenceChanged || telemetryDropped) {
      latchRef.current = INITIAL_DELTA_LATCH_STATE;
      setHasHadReference(false);
    }

    previousReferenceRef.current = reference;
    previousHasLapTimingRef.current = !!lapTiming;

    latchRef.current = advanceDeltaLatch(latchRef.current, deltaOk, liveDelta);

    setHasHadReference(latchRef.current.hasHadReference);
  }, [reference, lapTiming, deltaOk, liveDelta]);

  if (hideWhenNoReference && !hasHadReference) {
    return null;
  }

  const delta = getDisplayedDelta(latchRef.current, deltaOk, liveDelta);

  return (
    <div className={styles.root}>
      <div className={`${styles.delta} ${DELTA_CLASS[getDeltaState(delta)]}`}>
        {formatDelta(delta)}
      </div>

      {showGauge && (
        <div className={styles.gaugeSlot}>
          <DeltaGauge delta={delta} />
        </div>
      )}
    </div>
  );
});
