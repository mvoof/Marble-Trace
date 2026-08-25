import { observer } from 'mobx-react-lite';

import type { LinearMapWidgetSettings } from '@/types/widget-settings';
import { projectFlagZoneToWindow } from '@utils/flag-zones';
import {
  useIncidentsWidgetStore,
  useWidgetSettingsStore,
} from '@store/root-store-context';

import styles from './FlagBands.module.scss';

interface FlagBandsProps {
  playerLapDistPct: number;
  isHorizontal: boolean;
}

/**
 * Flat fill rather than the track map's hazard stripes: the strip is 40 px tall
 * and already crowded with dots, so a pattern would fight them. Two hard edges
 * say the same thing quietly, and the entry edge — the number the driver
 * actually needs — stays sharp.
 */
const BAND_COLOR = '#eab308';

export const FlagBands = observer(
  ({ playerLapDistPct, isHorizontal }: FlagBandsProps) => {
    const incidentsStore = useIncidentsWidgetStore();
    const widgetSettings = useWidgetSettingsStore();

    const settings =
      widgetSettings.getSettings<LinearMapWidgetSettings>('relative-map');

    if (!(settings.showIncidentZones ?? true)) {
      return null;
    }

    const isOutline = (settings.flagZoneStyle ?? 'filled') === 'outline';
    const blink = settings.blinkIncidentZones ?? true;

    const bands = incidentsStore.zones.flatMap((zone, zoneIndex) =>
      projectFlagZoneToWindow(zone, playerLapDistPct).map(
        (range, rangeIndex) => ({
          key: `${zoneIndex}-${rangeIndex}`,
          startDiff: range.startDiff,
          endDiff: range.endDiff,
          isActive: zone.isActive,
        })
      )
    );

    return (
      <>
        {bands.map((band) => {
          // A zone the player has already cleared is still information — the
          // next lap is coming — but it stops competing with what is ahead.
          const isBehind = band.endDiff <= 0;
          const startFraction = band.startDiff + 0.5;
          const sizeFraction = band.endDiff - band.startDiff;

          const position = isHorizontal
            ? {
                left: `${startFraction * 100}%`,
                width: `${sizeFraction * 100}%`,
              }
            : {
                bottom: `${startFraction * 100}%`,
                height: `${sizeFraction * 100}%`,
              };

          const bandClass = [
            styles.flagBand,
            isHorizontal ? styles.flagBandHorizontal : styles.flagBandVertical,
            isOutline ? styles.flagBandOutline : '',
            isBehind || !band.isActive ? styles.flagBandBehind : '',
            blink && band.isActive && !isBehind ? styles.flagBandBlink : '',
          ]
            .filter(Boolean)
            .join(' ');

          // Outline style keeps the colour on the band's edges and drops the
          // fill, so the dots inside it stay on plain background.
          const paint = isOutline
            ? { borderColor: BAND_COLOR }
            : { backgroundColor: BAND_COLOR };

          return (
            <div
              key={band.key}
              className={bandClass}
              style={{ ...position, ...paint }}
            />
          );
        })}
      </>
    );
  }
);
