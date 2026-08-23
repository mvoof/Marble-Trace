import type { CSSProperties } from 'react';
import { observer } from 'mobx-react-lite';

import { formatCarNumber } from '@utils/driver';
import {
  useUnitsStore,
  useWidgetSettingsStore,
} from '@store/root-store-context';
import type { CloseBattleWidgetSettings } from '@/types/widget-settings';
import {
  battleDriverName,
  formatBattleDistance,
  formatBattleGap,
  plateScale,
  type BattleOpponent,
} from './close-battle-utils';

import styles from './BattleRow.module.scss';

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
  ({ opponent, topPct, stackIndex }: BattleRowProps) => {
    const units = useUnitsStore();
    const widgetSettings = useWidgetSettingsStore();

    const settings =
      widgetSettings.getSettings<CloseBattleWidgetSettings>('close-battle');

    const { entry } = opponent;

    const scale = settings.scaleByDistance ? plateScale(opponent.clearance) : 1;

    const gapClass = opponent.isAhead ? styles.gapAhead : styles.gapBehind;

    const { givenName, surname } = battleDriverName(
      entry.userName,
      settings.nameMode
    );

    // Two reasons a plate fades, and they multiply rather than fight: the user's
    // own opacity, and the deliberate dimming of another class.
    const isDimmed = settings.otherClass === 'dim' && opponent.isOtherClass;
    const opacity = settings.plateOpacity * (isDimmed ? 0.55 : 1);

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
            className={
              settings.showClassBadge
                ? styles.row
                : `${styles.row} ${styles.rowNoClass}`
            }
            style={{ opacity }}
          >
            <span className={styles.carNumber}>
              {formatCarNumber(entry.carNumber)}
            </span>

            {settings.showClassBadge && (
              <span className={styles.classSlab}>
                <span
                  className={styles.className}
                  style={{ background: entry.carClassColor }}
                >
                  <span className={styles.classLabel}>
                    {entry.carClassShortName}
                  </span>
                </span>
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
                {formatBattleDistance(opponent.clearance, units.isMetric)}
              </span>
            )}

            <span className={`${styles.gap} ${gapClass}`}>
              {formatBattleGap(opponent.gapSeconds)}
            </span>
          </div>
        </div>
      </div>
    );
  }
);
