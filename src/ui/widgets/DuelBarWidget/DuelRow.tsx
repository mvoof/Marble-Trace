import type { CSSProperties } from 'react';
import { observer } from 'mobx-react-lite';

import { formatCarNumber, splitDriverName } from '@utils/driver';
import {
  useUnitsStore,
  useWidgetSettingsStore,
} from '@store/root-store-context';
import type { DuelBarWidgetSettings } from '@/types/widget-settings';
import {
  duelDriverName,
  formatDuelDistance,
  formatDuelGap,
  plateScale,
  type DuelPlateGroup,
} from './duel-bar-utils';

import styles from './DuelRow.module.scss';

/** Beyond this the surnames stop fitting and the rest become a count. */
const MAX_NAMED_COMPANIONS = 2;

interface DuelRowProps {
  /** The nearest car of this spot on the axis, plus whoever shares it. */
  group: DuelPlateGroup;
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
export const DuelRow = observer(({ group }: DuelRowProps) => {
  const { leader: opponent, topPct } = group;
  const units = useUnitsStore();
  const widgetSettings = useWidgetSettingsStore();

  const settings =
    widgetSettings.getSettings<DuelBarWidgetSettings>('duel-bar');

  const { entry } = opponent;

  const scale = settings.scaleByDistance ? plateScale(opponent.clearance) : 1;

  const gapClass = opponent.isAhead ? styles.gapAhead : styles.gapBehind;

  const { givenName, surname } = duelDriverName(
    entry.userName,
    settings.nameMode
  );

  // A merged plate names the cars it stands for instead of counting them: "+2"
  // says there is traffic, the surnames say who. Only when even the surnames
  // stop fitting does the rest fall back to a count.
  const companions = group.merged.slice(0, MAX_NAMED_COMPANIONS);
  const unnamed = group.merged.length - companions.length;

  // Two reasons a plate fades, and they multiply rather than fight: the user's
  // own opacity, and the deliberate dimming of another class.
  const isDimmed = settings.otherClass === 'dim' && opponent.isOtherClass;
  const opacity = settings.plateOpacity * (isDimmed ? 0.55 : 1);

  return (
    <div
      className={styles.slot}
      style={{ transform: `translateY(${topPct}%)` }}
    >
      <div
        className={styles.plate}
        style={{ '--plate-scale': scale } as CSSProperties}
      >
        <div className={styles.row} style={{ opacity }}>
          <div
            className={styles.rail}
            style={{ background: entry.carClassColor }}
          />

          {settings.showClassBadge && entry.carClassShortName && (
            <span
              className={styles.className}
              style={{ color: entry.carClassColor }}
            >
              {entry.carClassShortName}
            </span>
          )}

          <span className={styles.carNumber}>
            {formatCarNumber(entry.carNumber)}
          </span>

          <span className={styles.name}>
            {/* A shared plate spends its width on the second driver instead of
                on a given name nobody reads at speed. */}
            {givenName && companions.length === 0 && (
              <span className={styles.givenName}>{givenName} </span>
            )}
            <span className={styles.surname}>{surname}</span>
          </span>

          {companions.map((companion) => (
            <span key={companion.carIdx} className={styles.companion}>
              <span
                className={styles.companionRail}
                style={{ background: companion.entry.carClassColor }}
              />
              <span className={styles.companionNumber}>
                {formatCarNumber(companion.entry.carNumber)}
              </span>
              <span className={styles.companionName}>
                {splitDriverName(companion.entry.userName).surname}
              </span>
            </span>
          ))}

          {unnamed > 0 && <span className={styles.companion}>+{unnamed}</span>}

          {settings.showDistance && (
            <span className={styles.distance}>
              {formatDuelDistance(opponent.clearance, units.isMetric)}
            </span>
          )}

          <span className={`${styles.gap} ${gapClass}`}>
            {formatDuelGap(opponent.gapSeconds)}
          </span>
        </div>
      </div>
    </div>
  );
});
