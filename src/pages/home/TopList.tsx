import type { ReactNode } from 'react';
import { observer } from 'mobx-react-lite';

import type { TimeDriven } from '@shared/contracts/generated/bindings';
import { useFormatDuration } from './home-format';
import styles from './TopList.module.scss';

const PERCENT = 100;

interface TopListProps {
  icon: ReactNode;
  title: string;
  entries: TimeDriven[];
}

/** Names with their time in the car, each bar against the longest. */
export const TopList = observer(({ icon, title, entries }: TopListProps) => {
  const formatDuration = useFormatDuration();
  const longestS = entries[0]?.timeInCarS ?? 0;

  return (
    <section className={styles.card}>
      <div className={styles.head}>
        {icon}
        {title}
      </div>

      {entries.map((entry) => (
        <div key={entry.name} className={styles.entry}>
          <span className={styles.name} title={entry.name}>
            {entry.name}
          </span>

          <span className={styles.time}>
            {formatDuration(entry.timeInCarS)}
          </span>

          <div className={styles.track}>
            <i
              className={styles.bar}
              style={{
                width: `${longestS > 0 ? (entry.timeInCarS / longestS) * PERCENT : 0}%`,
              }}
            />
          </div>
        </div>
      ))}
    </section>
  );
});
