import { observer } from 'mobx-react-lite';
import { Trophy, Users } from 'lucide-react';

import { formatIRating } from '@utils/widget/widget-utils';

import styles from './ClassGroupHeader.module.scss';

interface ClassGroupHeaderProps {
  className: string;
  classShortName: string;
  classColor: string;
  classSof: number;
  totalDrivers: number;
  paginationLabel?: string;
}

export const ClassGroupHeader = observer(
  ({
    className,
    classShortName,
    classColor,
    classSof,
    totalDrivers,
    paginationLabel,
  }: ClassGroupHeaderProps) => (
    <div
      className={styles.header}
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
        <span className={styles.pill}>
          <Trophy size={11} color={classColor} />
          <span className={styles.pillLabel}>SOF</span>
          <span className={styles.pillValue}>{formatIRating(classSof)}</span>
        </span>

        <span className={styles.pill}>
          <Users size={11} />
          <span className={styles.pillValue}>{totalDrivers}</span>
        </span>
      </div>
    </div>
  )
);
