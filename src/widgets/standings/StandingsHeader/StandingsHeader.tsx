import { useWidgetSettings } from '@entities/layout/useWidgetSettings';
import { observer } from 'mobx-react-lite';

import type { StandingsColumn } from '@widgets/standings/standings-columns';
import {
  buildBlockEndColumns,
  buildGridTemplate,
  visibleStandingsColumns,
} from '@widgets/standings/standings-utils';
import { StandingsHeaderCell } from './StandingsHeaderCell';

import styles from './StandingsHeader.module.scss';
import type { StandingsWidgetSettings } from '../settings-schema';

interface HeaderSpec {
  label: string;
  align?: 'left' | 'center' | 'right';
  title?: string;
}

// The flag column has no heading; a space keeps the cell from collapsing.
const HEADERS: Record<StandingsColumn, HeaderSpec> = {
  pos: { label: 'Pos' },
  carNumber: { label: '#', align: 'right' },
  posChange: { label: '±', align: 'center' },
  countryFlag: { label: ' ' },
  name: { label: 'Driver' },
  sr: { label: 'SR', align: 'center' },
  ir: { label: 'iR', align: 'center' },
  irChange: {
    label: '±iR',
    align: 'center',
    title: 'Projected iR change (Elo estimate, not real iRacing data)',
  },
  laps: { label: 'Laps', align: 'center' },
  gap: { label: 'Gap', align: 'right' },
  interval: { label: 'Int', align: 'right' },
  lastLap: { label: 'Last', align: 'right' },
  lapDelta: {
    label: 'Delta',
    align: 'right',
    title: 'Last lap against the lap before it',
  },
  bestLap: { label: 'Best', align: 'right' },
  brand: { label: 'Brand', align: 'center' },
  tire: { label: 'Tire', align: 'center' },
};

export const StandingsHeader = observer(() => {
  const settings = useWidgetSettings<StandingsWidgetSettings>('standings');

  if (!settings.showColumnHeaders) {
    return null;
  }

  const gridTemplate = buildGridTemplate(settings);
  // The rules between groups of columns run up through the header too.
  const blockEnds = buildBlockEndColumns(settings);

  return (
    <div
      className={styles.headerRow}
      style={{ gridTemplateColumns: gridTemplate }}
    >
      {visibleStandingsColumns(settings).map((column) => {
        const { label, align, title } = HEADERS[column];

        return (
          <StandingsHeaderCell
            key={column}
            align={align}
            title={title}
            endsBlock={blockEnds.has(column)}
          >
            {label}
          </StandingsHeaderCell>
        );
      })}
    </div>
  );
});
