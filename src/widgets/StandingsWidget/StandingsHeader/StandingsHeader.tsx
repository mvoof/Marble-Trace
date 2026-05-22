import { observer } from 'mobx-react-lite';

import { useWidgetSettingsStore } from '@store/root-store-context';
import { buildGridTemplate } from '@utils/widget/standings-utils';
import { StandingsHeaderCell } from './StandingsHeaderCell';

import styles from './StandingsHeader.module.scss';

export const StandingsHeader = observer(() => {
  const widgetSettings = useWidgetSettingsStore();
  const settings = widgetSettings.getStandingsSettings();

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
      <StandingsHeaderCell>#</StandingsHeaderCell>
      <StandingsHeaderCell>Driver</StandingsHeaderCell>

      {settings.showBrand && (
        <StandingsHeaderCell align="center">Brand</StandingsHeaderCell>
      )}

      {settings.showTire && (
        <StandingsHeaderCell align="center">Tire</StandingsHeaderCell>
      )}

      {!settings.enableClassCycling && settings.showClassBadge && (
        <StandingsHeaderCell align="center">Class</StandingsHeaderCell>
      )}

      {settings.showIRatingBadge && (
        <StandingsHeaderCell align="center">Lic/iR</StandingsHeaderCell>
      )}

      {settings.showIrChange && (
        <StandingsHeaderCell
          align="center"
          title="Projected iR change (Elo estimate, not real iRacing data)"
        >
          ΔiR
        </StandingsHeaderCell>
      )}

      {settings.showLapsCompleted && (
        <StandingsHeaderCell align="center">Laps</StandingsHeaderCell>
      )}

      {settings.showPosChange && (
        <StandingsHeaderCell align="center">+/-</StandingsHeaderCell>
      )}

      <StandingsHeaderCell align="right">Gap</StandingsHeaderCell>
      <StandingsHeaderCell align="right">Last</StandingsHeaderCell>
      <StandingsHeaderCell align="right">Best</StandingsHeaderCell>
    </div>
  );
});
