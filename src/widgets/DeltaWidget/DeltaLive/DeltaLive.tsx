import { useLayoutEffect, useRef, useState } from 'react';
import { observer } from 'mobx-react-lite';
import {
  usePlayerStore,
  useWidgetSettingsStore,
} from '@store/root-store-context';
import {
  advanceDeltaLatch,
  formatDelta,
  getDeltaState,
  getDisplayedDelta,
  getGameDelta,
  INITIAL_DELTA_LATCH_STATE,
  isGameDeltaOk,
} from '@utils/widget/delta-utils';
import type { DeltaWidgetSettings } from '@/types/widget-settings';
import { ReferenceBadge } from '@/components/shared/ReferenceBadge/ReferenceBadge';
import styles from './DeltaLive.module.scss';

const DELTA_CLASS = {
  ahead: styles.ahead,
  behind: styles.behind,
  neutral: styles.neutral,
};

export const DeltaLive = observer(() => {
  const { lapTiming } = usePlayerStore();
  const widgetSettings = useWidgetSettingsStore();
  const { reference, hideWhenNoReference } =
    widgetSettings.getSettings<DeltaWidgetSettings>('delta');

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

  const deltaStr = formatDelta(delta);
  let fontSizeStyle = {};

  if (deltaStr.length >= 12) {
    fontSizeStyle = { fontSize: 'calc(18px * var(--wfs, 1))' };
  } else if (deltaStr.length >= 9) {
    fontSizeStyle = { fontSize: 'calc(24px * var(--wfs, 1))' };
  }

  return (
    <div className={styles.root}>
      <div
        className={`${styles.delta} ${DELTA_CLASS[getDeltaState(delta)]}`}
        style={fontSizeStyle}
      >
        {deltaStr}
      </div>
      <ReferenceBadge reference={reference} className={styles.badge} />
    </div>
  );
});
