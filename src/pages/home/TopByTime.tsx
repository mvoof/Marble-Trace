import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';

import { useStatisticsStore } from '@features/statistics/statistics-context';
import { SettingsCard } from '@shared/ui/SettingsCard/SettingsCard';
import type { TimeDriven } from '@shared/contracts/generated/bindings';
import { useFormatDuration } from './home-format';
import styles from './TopByTime.module.scss';

const PERCENT = 100;

interface TopListProps {
  title: string;
  entries: TimeDriven[];
}

/** Names with their time, each bar against the longest. */
const TopList = observer(({ title, entries }: TopListProps) => {
  const { t } = useTranslation('main-app');
  const formatDuration = useFormatDuration();
  const longestS = entries[0]?.timeInCarS ?? 0;

  return (
    <SettingsCard
      title={
        <>
          {title}
          <span className={styles.titleAside}>
            {' · '}
            {t('homePage.tops.byTime')}
          </span>
        </>
      }
    >
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
    </SettingsCard>
  );
});

/** The cars and the tracks driven longest, side by side. */
export const TopByTime = observer(() => {
  const { t } = useTranslation('main-app');
  const { topCars, topTracks } = useStatisticsStore();

  if (topCars.length === 0 && topTracks.length === 0) {
    return null;
  }

  return (
    <div className={styles.columns}>
      <TopList title={t('homePage.tops.cars')} entries={topCars} />

      <TopList title={t('homePage.tops.tracks')} entries={topTracks} />
    </div>
  );
});
