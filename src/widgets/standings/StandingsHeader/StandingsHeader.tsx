import { useWidgetSettings } from '@entities/layout/useWidgetSettings';
import { observer } from 'mobx-react-lite';

import {
  buildBlockEndColumns,
  buildGridTemplate,
  type StandingsColumn,
} from '@widgets/standings/standings-utils';
import { StandingsHeaderCell } from './StandingsHeaderCell';

import styles from './StandingsHeader.module.scss';
import type { StandingsWidgetSettings } from '../settings-schema';

export const StandingsHeader = observer(() => {
  const settings = useWidgetSettings<StandingsWidgetSettings>('standings');

  if (!settings.showColumnHeaders) {
    return null;
  }

  const gridTemplate = buildGridTemplate(settings);
  const blockEnds = buildBlockEndColumns(settings);

  // The rules between groups of columns run up through the header too.
  const endsBlock = (column: StandingsColumn): boolean => blockEnds.has(column);

  const ratingLabel = [
    settings.showLicBadge ? 'SR' : null,
    settings.showIRating ? 'iR' : null,
  ]
    .filter(Boolean)
    .join(' / ');

  return (
    <div
      className={styles.headerRow}
      style={{ gridTemplateColumns: gridTemplate }}
    >
      <StandingsHeaderCell>Pos</StandingsHeaderCell>

      <StandingsHeaderCell align="right" endsBlock={endsBlock('carNumber')}>
        #
      </StandingsHeaderCell>

      {settings.showPosChange && (
        <StandingsHeaderCell align="center" endsBlock={endsBlock('posChange')}>
          ±
        </StandingsHeaderCell>
      )}

      {settings.showCountryFlag && (
        <StandingsHeaderCell endsBlock={endsBlock('countryFlag')}>
          {' '}
        </StandingsHeaderCell>
      )}

      <StandingsHeaderCell endsBlock={endsBlock('name')}>
        Driver
      </StandingsHeaderCell>

      {(settings.showLicBadge || settings.showIRating) && (
        <StandingsHeaderCell align="center" endsBlock={endsBlock('rating')}>
          {ratingLabel}
        </StandingsHeaderCell>
      )}

      {settings.showIrChange && (
        <StandingsHeaderCell
          align="center"
          title="Projected iR change (Elo estimate, not real iRacing data)"
          endsBlock={endsBlock('irChange')}
        >
          ±iR
        </StandingsHeaderCell>
      )}

      {settings.showLapsCompleted && (
        <StandingsHeaderCell align="center" endsBlock={endsBlock('laps')}>
          Laps
        </StandingsHeaderCell>
      )}

      {settings.showGap && (
        <StandingsHeaderCell align="right" endsBlock={endsBlock('gap')}>
          Gap
        </StandingsHeaderCell>
      )}

      {settings.showInterval && (
        <StandingsHeaderCell align="right" endsBlock={endsBlock('interval')}>
          Int
        </StandingsHeaderCell>
      )}

      {settings.showLastLap && (
        <StandingsHeaderCell align="right" endsBlock={endsBlock('lastLap')}>
          Last
        </StandingsHeaderCell>
      )}

      {settings.showLapDelta && (
        <StandingsHeaderCell
          align="right"
          title="Last lap against the lap before it"
          endsBlock={endsBlock('lapDelta')}
        >
          Delta
        </StandingsHeaderCell>
      )}

      {settings.showBestLap && (
        <StandingsHeaderCell align="right" endsBlock={endsBlock('bestLap')}>
          Best
        </StandingsHeaderCell>
      )}

      {settings.showBrand && (
        <StandingsHeaderCell align="center" endsBlock={endsBlock('brand')}>
          Brand
        </StandingsHeaderCell>
      )}

      {settings.showTire && (
        <StandingsHeaderCell align="center" endsBlock={endsBlock('tire')}>
          Tire
        </StandingsHeaderCell>
      )}
    </div>
  );
});
