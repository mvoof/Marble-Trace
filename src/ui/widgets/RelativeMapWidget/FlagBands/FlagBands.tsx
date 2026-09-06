import { useWidgetSettings } from '@ui/hooks/useWidgetSettings';
import { observer } from 'mobx-react-lite';

import type { LinearMapWidgetSettings } from '@/types/widget-settings';
import { projectFlagZoneToWindow } from '@utils/flag-zones';
import { useReactiveDomWrite } from '@ui/hooks/useReactiveDomWrite';
import {
  useBackendComputedStore,
  useIncidentsWidgetStore,
} from '@store/root-store-context';

import styles from './FlagBands.module.scss';

/**
 * Flat fill rather than the track map's hazard stripes: the strip is 40 px tall
 * and already crowded with dots, so a pattern would fight them. Two hard edges
 * say the same thing quietly, and the entry edge — the number the driver
 * actually needs — stays sharp.
 */
const BAND_COLOR = '#eab308';

const BAND_START_PROPERTY = '--band-start';
const BAND_SIZE_PROPERTY = '--band-size';

const PCT = 100;

/**
 * A zone wraps the window at most once, so it never needs more than two bands.
 * Both are rendered and the spare one is hidden, which keeps the element list a
 * function of the zone list rather than of where the player happens to be.
 */
const BANDS_PER_ZONE = 2;

interface FlagBandsProps {
  isHorizontal: boolean;
}

/**
 * The incident zones, placed against the player's own position. The player moves
 * every tick, so each band's offset and size are written straight to the DOM;
 * React re-renders only when a zone is raised or cleared. See `docs/rendering.md`.
 */
export const FlagBands = observer(function FlagBands({
  isHorizontal,
}: FlagBandsProps) {
  const incidentsStore = useIncidentsWidgetStore();
  const computed = useBackendComputedStore();

  const settings = useWidgetSettings<LinearMapWidgetSettings>('relative-map');

  const isOutline = (settings.flagZoneStyle ?? 'filled') === 'outline';
  const blink = settings.blinkIncidentZones ?? true;
  const zoneCount = incidentsStore.zones.length;

  const containerRef = useReactiveDomWrite<HTMLDivElement>(
    (element, scheduleWrite) => {
      const playerLapDistPct =
        computed.relativeEntries.find((entry) => entry.isPlayer)?.lapDistPct ??
        0;

      const placements = incidentsStore.zones.flatMap((zone) => {
        const ranges = projectFlagZoneToWindow(zone, playerLapDistPct);

        return Array.from({ length: BANDS_PER_ZONE }, (_unused, rangeIndex) => {
          const range = ranges[rangeIndex];

          if (!range) {
            return null;
          }

          return {
            startFraction: range.startDiff + 0.5,
            sizeFraction: range.endDiff - range.startDiff,
            // A zone the player has already cleared is still information — the
            // next lap is coming — but it stops competing with what is ahead.
            isBehind: range.endDiff <= 0,
            isActive: zone.isActive,
          };
        });
      });

      scheduleWrite(() => {
        for (const [bandIndex, placement] of placements.entries()) {
          const band = element.children[bandIndex];

          if (!(band instanceof HTMLElement)) {
            continue;
          }

          band.hidden = placement === null;

          if (!placement) {
            continue;
          }

          band.style.setProperty(
            BAND_START_PROPERTY,
            `${placement.startFraction * PCT}%`
          );
          band.style.setProperty(
            BAND_SIZE_PROPERTY,
            `${placement.sizeFraction * PCT}%`
          );

          const isDimmed = placement.isBehind || !placement.isActive;

          band.classList.toggle(styles.flagBandBehind, isDimmed);
          band.classList.toggle(
            styles.flagBandBlink,
            blink && placement.isActive && !placement.isBehind
          );
        }
      });
    },
    [computed, incidentsStore, blink, zoneCount, isHorizontal]
  );

  if (!(settings.showIncidentZones ?? true)) {
    return null;
  }

  const bandClass = [
    styles.flagBand,
    isHorizontal ? styles.flagBandHorizontal : styles.flagBandVertical,
    isOutline ? styles.flagBandOutline : '',
  ]
    .filter(Boolean)
    .join(' ');

  // Outline style keeps the colour on the band's edges and drops the fill, so
  // the dots inside it stay on plain background.
  const paint = isOutline
    ? { borderColor: BAND_COLOR }
    : { backgroundColor: BAND_COLOR };

  return (
    <div ref={containerRef} className={styles.bandLayer}>
      {Array.from(
        { length: zoneCount * BANDS_PER_ZONE },
        (_unused, bandIndex) => (
          <div key={bandIndex} className={bandClass} style={paint} hidden />
        )
      )}
    </div>
  );
});
