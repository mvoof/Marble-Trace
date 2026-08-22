import { observer } from 'mobx-react-lite';

import {
  useDuelBarWidgetStore,
  useUnitsStore,
  useWidgetSettingsStore,
} from '@store/root-store-context';
import type { DuelBarWidgetSettings } from '@/types/widget-settings';
import {
  axisTicks,
  buildAxisSegments,
  distanceToTopPct,
  glowIntensity,
} from './duel-bar-utils';

import styles from './DuelAxis.module.scss';

/**
 * The axis, the player and the glow.
 *
 * The glow is two halves cut exactly at the player line — never a full radial
 * centred on it: a car behind must light the road behind, and a full circle
 * would claim both sides at once.
 */
export const DuelAxis = observer(() => {
  const duelBar = useDuelBarWidgetStore();
  const widgetSettings = useWidgetSettingsStore();
  const units = useUnitsStore();

  const settings =
    widgetSettings.getSettings<DuelBarWidgetSettings>('duel-bar');

  const axisRange = duelBar.axisRange;

  const ticks = settings.showTicks ? axisTicks(axisRange, units.isMetric) : [];

  // The line is only cut where a number sits on it. With the numbers off the
  // marks are narrow enough to hang either side of an unbroken axis.
  const showTickLabels = settings.showTicks && settings.showTickLabels;
  const segments = buildAxisSegments(showTickLabels ? ticks : []);

  const behind = duelBar.nearestBehind;
  const ahead = duelBar.nearestAhead;

  const behindGlow = behind
    ? glowIntensity(behind.clearance, settings.glowRange)
    : 0;

  const aheadGlow = ahead
    ? glowIntensity(ahead.clearance, settings.glowRange)
    : 0;

  return (
    <div className={styles.axis}>
      {segments.map((segment) => (
        <div
          key={segment.topPct}
          className={styles.line}
          style={{ top: `${segment.topPct}%`, height: `${segment.heightPct}%` }}
        />
      ))}

      {ticks.map((tick) => (
        <div
          key={`${tick.topPct}-${tick.label}`}
          className={
            showTickLabels ? styles.tick : `${styles.tick} ${styles.tickBare}`
          }
          style={{ top: `${tick.topPct}%` }}
        >
          {showTickLabels && (
            <span className={styles.tickLabel}>{tick.label}</span>
          )}
        </div>
      ))}

      {aheadGlow > 0 && (
        <div className={styles.glowAhead} style={{ opacity: aheadGlow }} />
      )}

      {behindGlow > 0 && (
        <div className={styles.glowBehind} style={{ opacity: behindGlow }} />
      )}

      {settings.compactMode &&
        duelBar.opponents.map((opponent) => (
          <div
            key={opponent.carIdx}
            className={styles.blip}
            style={{
              top: `${distanceToTopPct(opponent.longitudinalDist, axisRange)}%`,
              background: opponent.entry.carClassColor,
            }}
          />
        ))}

      <div className={styles.player} />
    </div>
  );
});
