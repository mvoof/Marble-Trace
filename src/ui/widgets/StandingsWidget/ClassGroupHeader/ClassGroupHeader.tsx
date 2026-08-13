import { observer } from 'mobx-react-lite';
import { Trophy, Users } from 'lucide-react';

import { formatIRating } from '@utils/driver';

import { StatPill } from '@ui/shared/StatPill/StatPill';
import styles from './ClassGroupHeader.module.scss';

/** Marks the class header rows, which scroll the classes rather than the drivers. */
export const CLASS_HEADER_ATTRIBUTE = 'data-class-header';

interface ClassGroupHeaderProps {
  className: string;
  classShortName: string;
  classColor: string;
  classSof: number;
  totalDrivers: number;
  paginationLabel?: string;
  /** Cursor is on this class, so the wheel would scroll its drivers. */
  isScrollTarget?: boolean;
}

export const ClassGroupHeader = observer(
  ({
    className,
    classShortName,
    classColor,
    classSof,
    totalDrivers,
    paginationLabel,
    isScrollTarget = false,
  }: ClassGroupHeaderProps) => (
    <div
      className={`${styles.header} ${isScrollTarget ? styles.headerScrollTarget : ''}`}
      data-class-header
      style={{
        background: `linear-gradient(90deg, color-mix(in srgb, ${classColor} 13%, transparent) 0%, rgba(24,24,27,0.4) 38%, transparent 100%)`,
        borderLeft: `3px solid ${classColor}`,
      }}
    >
      <div className={styles.left}>
        {paginationLabel && (
          <span className={styles.pagination}>{paginationLabel}</span>
        )}

        <span className={styles.className} style={{ color: classColor }}>
          {classShortName || className}
        </span>
      </div>

      <div className={styles.pills}>
        <StatPill icon={Trophy} iconColor={classColor} label="SOF">
          {formatIRating(classSof)}
        </StatPill>

        <StatPill icon={Users}>{totalDrivers}</StatPill>
      </div>
    </div>
  )
);
