import type { ReactNode, Ref } from 'react';
import { observer } from 'mobx-react-lite';

import type { CarIdentity } from '@shared/contracts/car-identity';
import { abbreviateName } from '@shared/lib/driver';
import { DriverFlagBadge } from '@shared/ui/DriverFlagBadge/DriverFlagBadge';
import {
  resolveDriverStatuses,
  type DriverStatus,
} from '@shared/ui/StatChip/driver-status';
import { StatChip } from '@shared/ui/StatChip/StatChip';

import { RadioMark } from '../RadioMark/RadioMark';
import type { DriverRowState } from './driver-row-state';
import styles from './DriverNameContent.module.scss';

interface DriverNameContentProps {
  driver: CarIdentity;
  state: DriverRowState;
  abbreviate: boolean;
  showDriverFlags: boolean;
  showRadioMark: boolean;
  showPitIndicator: boolean;
  /**
   * A second line under the name — a team event's team. Every row of the
   * event takes it, an unnamed team too, so the table keeps one row height.
   */
  teamName?: string;
  /** What rides on a status chip's dark half: the time on pit road, the tow. */
  chipDetail?: (status: DriverStatus) => ReactNode;
  /** The name's node, for a widget that writes a live state onto it. */
  nameRef?: Ref<HTMLSpanElement>;
}

/**
 * What a driver table's name cell holds: the waved flag, the name (and team),
 * the radio mark and the status chips. The caller owns the cell around it.
 *
 * The status list is read from the identity, so it changes with the row's own
 * render and adds none: a pit stop or a tow is the rare event a row redraws
 * for.
 */
export const DriverNameContent = observer(
  ({
    driver,
    state,
    abbreviate,
    showDriverFlags,
    showRadioMark,
    showPitIndicator,
    teamName,
    chipDetail,
    nameRef,
  }: DriverNameContentProps) => {
    const statusChips = resolveDriverStatuses({
      ...state,
      pitState: driver.pitState,
      showPit: showPitIndicator,
    });

    const name = (
      <span ref={nameRef} className={styles.driverName}>
        {abbreviate ? abbreviateName(driver.userName) : driver.userName}
      </span>
    );

    return (
      <>
        {showDriverFlags &&
          (state.isFinished ? (
            <DriverFlagBadge type="checkered" />
          ) : (
            state.flagType !== 'none' && (
              <DriverFlagBadge type={state.flagType} />
            )
          ))}

        {teamName === undefined ? (
          name
        ) : (
          <div className={styles.nameStack}>
            {name}
            <span className={styles.teamName}>{teamName}</span>
          </div>
        )}

        {showRadioMark && (
          <RadioMark carIdx={driver.carIdx} onPlayerRow={driver.isPlayer} />
        )}

        {statusChips.map((chip) => (
          <StatChip
            key={chip.status}
            lead={chip.label}
            look="reading"
            tone={chip.tone}
          >
            {chipDetail?.(chip.status)}
          </StatChip>
        ))}
      </>
    );
  }
);
