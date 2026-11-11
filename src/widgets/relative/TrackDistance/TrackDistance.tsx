import { observer } from 'mobx-react-lite';

import { bumperGapMeters, trackGapMeters } from '@shared/lib/driver';
import { formatWidgetDistance } from '@shared/lib/telemetry-format';
import { useReactiveDomWrite } from '@shared/hooks/useReactiveDomWrite';
import { useBackendComputedStore } from '@entities/cars/computed-context';
import { useSessionStore } from '@entities/session/session-context';
import { useUnitsStore } from '@entities/app-settings/units-context';
import { useAppSettingsStore } from '@entities/app-settings/app-settings-context';
import { useRelativeWidgetStore } from '@widgets/relative/relative.store';

import styles from './TrackDistance.module.scss';

interface TrackDistanceProps {
  carIdx: number;
  isPaceCar: boolean;
}

const NO_DISTANCE = '-';

/**
 * Distance along the track from the player to one row's car, bumper to bumper
 * as the radar prints it, in the driver's units. It moves every tick, so it is
 * written straight to its span.
 */
export const TrackDistance = observer(
  ({ carIdx, isPaceCar }: TrackDistanceProps) => {
    const computed = useBackendComputedStore();
    const relativeWidget = useRelativeWidgetStore();
    const session = useSessionStore();
    const units = useUnitsStore();
    const appSettings = useAppSettingsStore();

    const distanceRef = useReactiveDomWrite<HTMLSpanElement>(
      (element, scheduleWrite) => {
        const entry = isPaceCar
          ? relativeWidget.paceCarRowOf(carIdx)
          : computed.relativeEntryOf(carIdx);

        const centerGap =
          entry && !entry.isPlayer
            ? trackGapMeters(
                entry.relativeLapDist,
                session.sessionInfo?.trackLengthM
              )
            : null;

        const text =
          centerGap === null
            ? NO_DISTANCE
            : formatWidgetDistance(
                Math.abs(
                  bumperGapMeters(centerGap, appSettings.appSettings.carLength)
                ),
                units.unitSystem
              );

        scheduleWrite(() => {
          element.textContent = text;
        });
      },
      [computed, relativeWidget, session, units, appSettings, carIdx, isPaceCar]
    );

    return (
      <div className={styles.distanceBlock}>
        <span ref={distanceRef} className={styles.distance} />
      </div>
    );
  }
);

TrackDistance.displayName = 'TrackDistance';
