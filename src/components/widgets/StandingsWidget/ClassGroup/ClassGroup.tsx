import { Trophy, Users, MoreHorizontal } from 'lucide-react';
import { isSeparator } from '../types';
import type { DriverGroup } from '../types';
import type { StandingsWidgetSettings } from '../../../../store/widget-settings.store';
import { formatIRating } from '../../widget-utils';
import { DriverRow } from '../DriverRow/DriverRow';

import styles from './ClassGroup.module.scss';

interface ClassGroupProps {
  group: DriverGroup;
  showGroupHeader: boolean;
  settings: StandingsWidgetSettings;
  irDeltaMap: Map<number, number>;
  playerPitStops: number;
}

export const ClassGroup = ({
  group,
  showGroupHeader,
  settings,
  irDeltaMap,
  playerPitStops,
}: ClassGroupProps) => (
  <>
    {showGroupHeader && (
      <tr className={styles.classHeader}>
        <td colSpan={100}>
          <div
            className={styles.classHeaderInner}
            style={{
              background: `linear-gradient(90deg, ${group.classColor}25 0%, rgba(24,24,27,0.5) 40%, transparent 100%)`,
              borderLeft: `3px solid ${group.classColor}`,
            }}
          >
            <div className={styles.classHeaderLeft}>
              <span
                className={styles.className}
                style={{
                  color: group.classColor,
                  textShadow: `0 0 12px ${group.classColor}80`,
                }}
              >
                {group.classShortName}
              </span>

              <div className={styles.classStats}>
                <span className={styles.classBadge}>
                  <Trophy size={14} style={{ color: group.classColor }} />
                  SOF
                  <span className={styles.classBadgeValue}>
                    {formatIRating(group.classSof)}
                  </span>
                </span>

                <span className={styles.classBadge}>
                  <Users size={14} />
                  <span className={styles.classBadgeValue}>
                    {group.totalDrivers}
                  </span>
                </span>
              </div>
            </div>

            <div className={styles.classHeaderLine} />
          </div>
        </td>
      </tr>
    )}

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
          showGroupHeaders={showGroupHeader}
          settings={settings}
          irDelta={irDeltaMap.get(entry.carIdx)}
          playerPitStops={playerPitStops}
        />
      );
    })}
  </>
);
