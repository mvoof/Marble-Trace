import { ChevronLeft, ChevronRight } from 'lucide-react';
import { formatIRating } from '@/components/widgets/widget-utils';
import type { DriverGroup } from '@/types/standings';

import styles from './ClassSwitcher.module.scss';

interface ClassSwitcherProps {
  groups: DriverGroup[];
  activeIndex: number;
  onPrev: () => void;
  onNext: () => void;
}

export const ClassSwitcher = ({
  groups,
  activeIndex,
  onPrev,
  onNext,
}: ClassSwitcherProps) => {
  const group = groups[activeIndex];
  const total = groups.length;

  if (!group) return null;

  return (
    <div className={styles.switcher}>
      <button
        className={styles.navBtn}
        onClick={onPrev}
        onMouseDown={(e) => e.stopPropagation()}
        disabled={total <= 1}
        aria-label="Previous class"
      >
        <ChevronLeft size={14} />
      </button>

      <div className={styles.classInfo}>
        <span
          className={styles.className}
          style={{ color: group.classColor || 'inherit' }}
        >
          {group.classShortName || group.className}
        </span>

        <span className={styles.meta}>
          {total > 1 && (
            <span className={styles.pagination}>
              {activeIndex + 1}/{total}
            </span>
          )}
          <span className={styles.stat}>
            SOF {formatIRating(group.classSof)}
          </span>
          <span className={styles.stat}>{group.totalDrivers} drivers</span>
        </span>
      </div>

      <button
        className={styles.navBtn}
        onClick={onNext}
        onMouseDown={(e) => e.stopPropagation()}
        disabled={total <= 1}
        aria-label="Next class"
      >
        <ChevronRight size={14} />
      </button>
    </div>
  );
};
