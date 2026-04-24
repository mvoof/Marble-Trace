import { MoreHorizontal } from 'lucide-react';
import { isSeparator } from '@/components/widgets/widget-utils';
import type { DriverGroup } from '@/types/standings';
import type { StandingsWidgetSettings } from '@/types/widget-settings';
import { DriverRow } from '../DriverRow/DriverRow';

import styles from './ClassGroup.module.scss';

interface ClassGroupProps {
  group: DriverGroup;
  settings: StandingsWidgetSettings;
  irDeltaMap: Map<number, number>;
  playerPitStops: number;
}

export const ClassGroup = ({
  group,
  settings,
  irDeltaMap,
  playerPitStops,
}: ClassGroupProps) => (
  <>
    {group.drivers.map((entry) => {
      if (isSeparator(entry)) {
        return (
          <tr key={entry.id} className={styles.separatorRow}>
            <td colSpan={100}>
              <div className={styles.separatorInner}>
                <div className={styles.separatorLine}>
                  <div className={styles.separatorLineInner} />
                </div>

                <div className={styles.separatorDots}>
                  <MoreHorizontal size={16} />
                </div>
              </div>
            </td>
          </tr>
        );
      }

      return (
        <DriverRow
          key={entry.carIdx}
          driver={entry}
          settings={settings}
          irDelta={irDeltaMap.get(entry.carIdx)}
          playerPitStops={playerPitStops}
        />
      );
    })}
  </>
);
