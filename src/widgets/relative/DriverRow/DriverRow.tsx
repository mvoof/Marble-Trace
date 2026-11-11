import { observer } from 'mobx-react-lite';

import { useWidgetSettings } from '@entities/layout/useWidgetSettings';
import { useBackendComputedStore } from '@entities/cars/computed-context';
import { CarNumberBadge } from '@entities/cars/driver-table/CarNumberBadge';
import { DriverNameContent } from '@entities/cars/driver-table/DriverNameContent';
import { driverRowStateOf } from '@entities/cars/driver-table/driver-row-state';
import { DriverRowShell } from '@entities/cars/driver-table/DriverRowShell';
import { RatingCells } from '@entities/cars/driver-table/RatingCells';
import { usePlayerStore } from '@entities/player/player-context';
import { TowTime } from '@entities/player/TowTime/TowTime';
import { useSessionStore } from '@entities/session/session-context';
import { useReactiveDomWrite } from '@shared/hooks/useReactiveDomWrite';
import { cx } from '@shared/lib/class-names';
import { computeRelativeGap } from '@shared/lib/driver';
import { isSessionEnded } from '@shared/lib/timer-utils';
import { CountryFlag } from '@shared/ui/CountryFlag/CountryFlag';
import { useLiveParts } from '@shared/ui/live/live-parts';
import {
  buildRelativeGridTemplate,
  resolveRowPosition,
} from '@widgets/relative/relative-utils';

import { TrackDistance } from '../TrackDistance/TrackDistance';
import type { RelativeWidgetSettings } from '../settings-schema';
import styles from './DriverRow.module.scss';

/** A car more than half a lap off the player is a lap down, or lapping. */
const LAP_STATE_THRESHOLD = 0.5;

interface DriverRowProps {
  carIdx: number;
  index: number;
}

/**
 * One car of the strip. Everything it draws but the gap changes at most once a
 * lap, so the row is rendered from the identity and the gap — which moves every
 * tick, along with the lapped-and-lapping colouring that rides on it — is
 * written straight to its span. See `docs/rendering.md`.
 */
export const DriverRow = observer(({ carIdx, index }: DriverRowProps) => {
  const computed = useBackendComputedStore();
  const player = usePlayerStore();
  const session = useSessionStore();

  const settings = useWidgetSettings<RelativeWidgetSettings>('relative');

  const driver = computed.relativeIdentityByCarIdx.get(carIdx);

  const parts = useLiveParts<'name'>();

  const gapRef = useReactiveDomWrite<HTMLSpanElement>(
    (element, scheduleWrite) => {
      const liveDriver = computed.relativeEntryOf(carIdx);
      // oxlint-disable-next-line no-restricted-properties
      const livePlayer = computed.relativePlayerEntry;

      if (!liveDriver) {
        return;
      }

      const relativeGap = livePlayer
        ? computeRelativeGap(liveDriver, livePlayer)
        : 0;

      const relativeGapText =
        relativeGap > 0
          ? `+${relativeGap.toFixed(1)}`
          : relativeGap < 0
            ? relativeGap.toFixed(1)
            : '0.0';

      const gapSign = liveDriver.isPlayer
        ? 'player'
        : relativeGap > 0
          ? 'ahead'
          : relativeGap < 0
            ? 'behind'
            : 'player';

      const lapDiff = livePlayer
        ? liveDriver.lap +
          liveDriver.lapDistPct -
          (livePlayer.lap + livePlayer.lapDistPct)
        : 0;

      const lapState = liveDriver.isPlayer
        ? null
        : lapDiff < -LAP_STATE_THRESHOLD
          ? 'behind'
          : lapDiff > LAP_STATE_THRESHOLD
            ? 'lapping'
            : null;

      scheduleWrite(() => {
        const gapText = liveDriver.isPlayer ? '-' : relativeGapText;

        if (element.textContent !== gapText) {
          element.textContent = gapText;
        }

        if (element.dataset.sign !== gapSign) {
          element.dataset.sign = gapSign;
        }

        parts.state('name', 'lap', lapState);
      });
    },
    [computed, carIdx, parts]
  );

  if (!driver) {
    return null;
  }

  const state = driverRowStateOf(driver, {
    isSessionEnded: isSessionEnded(session.session?.session_state ?? null),
    isPlayerTowing: player.isTowing,
  });

  const position = resolveRowPosition(driver, settings.useLivePositions);

  return (
    <DriverRowShell
      classes={styles}
      gridTemplate={buildRelativeGridTemplate(settings)}
      classColor={driver.carClassColor}
      rowPadding={settings.rowPadding}
      isPlayer={driver.isPlayer}
      isOdd={index % 2 !== 0}
      state={state}
      playerRowColor={settings.playerRowColor}
      data-relative-row
    >
      <div className={styles.posBlock}>
        <span
          className={styles.driverPosition}
          style={
            driver.isPlayer ? { color: settings.playerAccentColor } : undefined
          }
        >
          {position}
        </span>
      </div>

      {settings.showCarNumber && (
        <div className={styles.carNumberCell}>
          <CarNumberBadge
            carNumber={driver.carNumber}
            classColor={driver.carClassColor}
          />
        </div>
      )}

      {settings.showCountryFlag && (
        <div className={styles.countryFlagCell}>
          <CountryFlag flairId={driver.flairId} isAi={driver.isAi} />
        </div>
      )}

      <div className={cx(styles.infoBlock, styles.blockEnd)}>
        <DriverNameContent
          driver={driver}
          state={state}
          abbreviate={settings.abbreviateNames}
          showDriverFlags={settings.showDriverFlags}
          showRadioMark={settings.showRadioMark}
          showPitIndicator={settings.showPitIndicator}
          chipDetail={(status) =>
            status === 'tow' && driver.isPlayer && player.isTowing ? (
              <TowTime />
            ) : undefined
          }
          nameRef={parts.ref('name')}
        />
      </div>

      {/* The rule closes the rating group after whichever of the two ends it. */}
      <RatingCells
        driver={driver}
        settings={settings}
        cellClassName={(column) =>
          cx(
            styles.colRating,
            (column === 'ir' || !settings.showIRating) && styles.blockEnd
          )
        }
      />

      <div className={styles.f2Block}>
        <span ref={gapRef} className={styles.f2Time} />
      </div>

      {settings.showDistance && (
        <TrackDistance carIdx={driver.carIdx} isPaceCar={false} />
      )}
    </DriverRowShell>
  );
});
