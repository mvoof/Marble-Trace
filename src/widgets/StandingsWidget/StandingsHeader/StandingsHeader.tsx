import { observer } from 'mobx-react-lite';

import { useWidgetSettingsStore } from '@store/root-store-context';
import type { StandingsWidgetSettings } from '@/types/widget-settings';
import { buildGridTemplate } from '@utils/widget/standings-utils';
import { StandingsHeaderCell } from './StandingsHeaderCell';

import styles from './StandingsHeader.module.scss';

export const StandingsHeader = observer(() => {
  const widgetSettings = useWidgetSettingsStore();
  const settings =
    widgetSettings.getSettings<StandingsWidgetSettings>('standings');

  if (!settings.showColumnHeaders) {
    return null;
  }

  const gridTemplate = buildGridTemplate(settings);

  return (
    <div
      className={styles.headerRow}
      style={{ gridTemplateColumns: gridTemplate }}
    >
      <StandingsHeaderCell>Pos</StandingsHeaderCell>

      {settings.showPosChange && (
        <StandingsHeaderCell align="center">±</StandingsHeaderCell>
      )}

      <StandingsHeaderCell className={styles.carNumHeader}>
        #
      </StandingsHeaderCell>
      <StandingsHeaderCell>Driver</StandingsHeaderCell>
      <StandingsHeaderCell />

      {settings.showLicBadge && (
        <StandingsHeaderCell align="center">SR</StandingsHeaderCell>
      )}

      {settings.showIRating && (
        <StandingsHeaderCell align="center">iR</StandingsHeaderCell>
      )}

      {settings.showIrChange && (
        <StandingsHeaderCell
          align="center"
          title="Projected iR change (Elo estimate, not real iRacing data)"
        >
          ±iR
        </StandingsHeaderCell>
      )}

      {settings.showLapsCompleted && (
        <StandingsHeaderCell align="center">Laps</StandingsHeaderCell>
      )}

      <StandingsHeaderCell align="center">Gap</StandingsHeaderCell>
      <StandingsHeaderCell align="center">Last</StandingsHeaderCell>
      <StandingsHeaderCell align="center">Best</StandingsHeaderCell>

      {settings.showBrand && (
        <StandingsHeaderCell align="center">Brand</StandingsHeaderCell>
      )}

      {settings.showTire && (
        <StandingsHeaderCell align="center">Tire</StandingsHeaderCell>
      )}
    </div>
  );
});
