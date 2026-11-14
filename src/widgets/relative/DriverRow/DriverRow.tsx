import { Fragment, type ReactNode } from 'react';
import { observer } from 'mobx-react-lite';

import { useWidgetSettings } from '@entities/layout/useWidgetSettings';
import { useBackendComputedStore } from '@entities/cars/computed-context';
import { CarNumberBadge } from '@entities/cars/driver-table/CarNumberBadge';
import { DriverNameContent } from '@entities/cars/driver-table/DriverNameContent';
import { driverRowStateOf } from '@entities/cars/driver-table/driver-row-state';
import { DriverRowShell } from '@entities/cars/driver-table/DriverRowShell';
import { RatingCell } from '@entities/cars/driver-table/RatingCell';
import { usePlayerStore } from '@entities/player/player-context';
import { TowTime } from '@entities/player/TowTime/TowTime';
import { useSessionStore } from '@entities/session/session-context';
import { useReactiveDomWrite } from '@shared/hooks/useReactiveDomWrite';
import { cx } from '@shared/lib/class-names';
import { computeRelativeGap } from '@shared/lib/driver';
import { CountryFlag } from '@shared/ui/CountryFlag/CountryFlag';
import {
  useLiveParts,
  writeState,
  writeText,
} from '@shared/ui/live/live-parts';
import {
  buildRelativeBlockEnds,
  buildRelativeGridTemplate,
  resolveRowPosition,
  visibleRelativeColumns,
} from '@widgets/relative/relative-utils';
import type { RelativeColumn } from '@widgets/relative/relative-columns';

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

        writeText(element, gapText);

        writeState(element, 'sign', gapSign);

        parts.state('name', 'lap', lapState);
      });
    },
    [computed, carIdx, parts]
  );

  if (!driver) {
    return null;
  }

  const state = driverRowStateOf(driver, {
    isSessionEnded: session.isSessionEnded,
    isPlayerTowing: player.isTowing,
  });

  const position = resolveRowPosition(driver, settings.useLivePositions);
  const blockEnds = buildRelativeBlockEnds(settings);

  // The cell that closes a group of columns carries the rule after it.
  const cellWithRule = (column: RelativeColumn, className: string): string =>
    cx(className, blockEnds.has(column) && styles.blockEnd);

  // One cell per visible column, drawn in the order the settings give.
  const renderCell = (column: RelativeColumn): ReactNode => {
    switch (column) {
      case 'pos':
        return (
          <div className={cellWithRule('pos', styles.posBlock)}>
            <span
              className={styles.driverPosition}
              style={
                driver.isPlayer
                  ? { color: settings.playerAccentColor }
                  : undefined
              }
            >
              {position}
            </span>
          </div>
        );
      case 'carNumber':
        return (
          <div className={cellWithRule('carNumber', styles.carNumberCell)}>
            <CarNumberBadge
              carNumber={driver.carNumber}
              classColor={driver.carClassColor}
            />
          </div>
        );
      case 'countryFlag':
        return (
          <div className={cellWithRule('countryFlag', styles.countryFlagCell)}>
            <CountryFlag flairId={driver.flairId} isAi={driver.isAi} />
          </div>
        );
      case 'name':
        return (
          <div className={cellWithRule('name', styles.infoBlock)}>
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
        );
      case 'sr':
      case 'ir':
        return (
          <RatingCell
            column={column}
            driver={driver}
            settings={settings}
            className={cellWithRule(column, styles.colRating)}
          />
        );
      case 'gap':
        return (
          <div className={cellWithRule('gap', styles.f2Block)}>
            <span ref={gapRef} className={styles.f2Time} />
          </div>
        );
      case 'distance':
        return (
          <TrackDistance
            carIdx={driver.carIdx}
            isPaceCar={false}
            className={cellWithRule('distance', '')}
          />
        );
    }
  };

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
      {visibleRelativeColumns(settings).map((column) => (
        <Fragment key={column}>{renderCell(column)}</Fragment>
      ))}
    </DriverRowShell>
  );
});
