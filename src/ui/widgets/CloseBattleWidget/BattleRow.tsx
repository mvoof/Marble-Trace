import type { CSSProperties } from 'react';
import { observer } from 'mobx-react-lite';

import { formatBrand, formatCarNumber } from '@utils/driver';
import {
  useUnitsStore,
  useWidgetSettingsStore,
} from '@store/root-store-context';
import type { CloseBattleWidgetSettings } from '@/types/widget-settings';
import {
  battleDistanceParts,
  battleDriverName,
  battleGapParts,
  plateScale,
  type BattleOpponent,
} from './close-battle-utils';

import styles from './BattleRow.module.scss';

// How far back a row of another class is pushed when the user asks for it.
const OTHER_CLASS_DIM = 0.55;

interface BattleRowProps {
  opponent: BattleOpponent;
  /** Where this car's spot sits on the axis, as a percent of the stage. */
  topPct: number;
  /**
   * How far down the stack this plate sits. Cars close enough to share one
   * spot are drawn as a stack under it rather than as one plate carrying
   * several names: each keeps its own number, distance and gap, and the axis
   * still claims a single position for all of them.
   */
  stackIndex: number;
  /**
   * Whether the lap column is drawn at all. Decided for the widget rather than
   * for the plate: a column that appears on one plate of a deck and not on the
   * next would shift every number in it against its neighbour.
   */
  showLaps: boolean;
}

/**
 * One opponent, standing on the axis at the distance they actually are — not
 * queued in a list. The inner layout never changes with distance; only the
 * plate's size does, and never past a third.
 *
 * Two layers on purpose: the outer one spans the whole stage, so its
 * `translateY` in percent is a percent *of the stage*. Position and size are
 * therefore transforms — composited, and cheap enough to transition, which is
 * what turns the 10 Hz proximity frame into continuous motion.
 */
export const BattleRow = observer(
  ({ opponent, topPct, stackIndex, showLaps }: BattleRowProps) => {
    const units = useUnitsStore();
    const widgetSettings = useWidgetSettingsStore();

    const settings =
      widgetSettings.getSettings<CloseBattleWidgetSettings>('close-battle');

    const { entry } = opponent;

    const scale = settings.scaleByDistance ? plateScale(opponent.clearance) : 1;

    const gapClass = opponent.isAhead ? styles.gapAhead : styles.gapBehind;

    const distance = battleDistanceParts(opponent.clearance, units.isMetric);
    const gap = battleGapParts(opponent.gapSeconds);

    const { givenName, surname } = battleDriverName(
      entry.userName,
      settings.nameMode
    );

    // Two reasons a plate fades, and they do different things. The user's own
    // opacity fades the plate itself and leaves the numbers on it at full
    // strength -- a translucent row is still a row you read at a glance.
    // Dimming another class is the opposite on purpose: it pushes the whole
    // row back, text included, because that row is not the one you are racing.
    const isDimmed = settings.otherClass === 'dim' && opponent.isOtherClass;

    return (
      <div
        className={styles.slot}
        style={
          {
            transform: `translateY(${topPct}%)`,
            '--stack-index': stackIndex,
          } as CSSProperties
        }
      >
        <div
          className={styles.plate}
          style={
            {
              '--plate-scale': scale,
              '--stack-index': stackIndex,
            } as CSSProperties
          }
        >
          <div
            className={[
              styles.row,
              settings.showClassBadge ? '' : styles.rowNoClass,
              showLaps ? styles.rowLaps : '',
              settings.showBrand ? styles.rowBrand : '',
            ]
              .filter(Boolean)
              .join(' ')}
            style={
              {
                opacity: isDimmed ? OTHER_CLASS_DIM : undefined,
                '--widget-bg-opacity': settings.plateOpacity,
              } as CSSProperties
            }
          >
            <span className={styles.carNumber}>
              {formatCarNumber(entry.carNumber)}
            </span>

            {settings.showClassBadge && (
              <span className={styles.classSlab}>
                <span
                  className={styles.className}
                  style={{ backgroundColor: entry.carClassColor }}
                >
                  <span className={styles.classLabel}>
                    {entry.carClassShortName}
                  </span>
                </span>
              </span>
            )}

            {settings.showBrand && (
              <span className={styles.brand} title={entry.carScreenName}>
                {formatBrand(entry.carScreenName)}
              </span>
            )}

            <span className={styles.identity}>
              <span className={styles.name}>
                {givenName && (
                  <span className={styles.givenName}>{givenName} </span>
                )}
                <span className={styles.surname}>{surname}</span>
              </span>
            </span>

            {settings.showDistance && (
              <span className={styles.distance}>
                <span className={styles.distanceValue}>{distance.value}</span>
                <span className={styles.distanceUnit}>{distance.unit}</span>
              </span>
            )}

            {showLaps && (
              <span className={styles.laps}>
                {opponent.lapsApart > 0 ? `${opponent.lapsApart}L` : ''}
              </span>
            )}

            <span className={`${styles.gap} ${gapClass}`}>
              <span className={styles.gapWhole}>{gap.whole}</span>
              <span className={styles.gapPoint}>.</span>
              <span className={styles.gapFraction}>{gap.fraction}</span>
            </span>
          </div>
        </div>
      </div>
    );
  }
);
