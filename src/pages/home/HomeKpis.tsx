import type { ReactNode } from 'react';
import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { Clock, Route, ShieldCheck, Trophy } from 'lucide-react';

import { useStatisticsStore } from '@features/statistics/statistics-context';
import {
  changeBetween,
  cleanLapsPercent,
  directionOf,
  personalBestTracks,
} from '@features/statistics/home-stats';
import { cx } from '@shared/lib/class-names';
import type { WeekStats } from '@shared/contracts/generated/bindings';
import { formatClock, signedChange } from './home-format';
import { LastRaceCard } from './LastRaceCard';
import styles from './HomeKpis.module.scss';

const ICON_SIZE = 14;
const DASH = '—';
const PERCENT_SIGN = '%';

interface KpiCardProps {
  icon: ReactNode;
  label: string;
  value: string;
  detail: ReactNode;
}

const KpiCard = observer(({ icon, label, value, detail }: KpiCardProps) => (
  <div className={styles.kpi}>
    <div className={styles.label}>
      {icon}
      {label}
    </div>

    <div className={styles.value}>{value}</div>

    <div className={styles.detail}>{detail}</div>
  </div>
));

interface WeekChangeProps {
  /** `null` when last week cannot be compared. */
  change: number | null;
  format?: (size: number) => string;
}

/** "+212 vs last week", coloured by its sign. */
const WeekChange = observer(({ change, format }: WeekChangeProps) => {
  const { t } = useTranslation('main-app');

  if (change === null) {
    return <span className={styles.muted}>{t('homePage.kpi.thisWeek')}</span>;
  }

  return (
    <span className={cx(styles.change, styles[directionOf(change)])}>
      {t('homePage.kpi.vsLastWeek', { change: signedChange(change, format) })}
    </span>
  );
});

interface WeekKpisProps {
  week: WeekStats;
  previousWeek: WeekStats;
}

/** The four figures of the last seven days, each against the seven before. */
const WeekKpis = observer(({ week, previousWeek }: WeekKpisProps) => {
  const { t, i18n } = useTranslation('main-app');
  const kmFormat = new Intl.NumberFormat(i18n.language, {
    maximumFractionDigits: 0,
  });
  const formatKm = (km: number) => kmFormat.format(km);
  const formatPercent = (percent: number) => `${percent}${PERCENT_SIGN}`;
  const clean = cleanLapsPercent(week);
  const bestTracks = personalBestTracks(week);

  return (
    <>
      <KpiCard
        icon={<Clock size={ICON_SIZE} />}
        label={t('homePage.kpi.timeWeek')}
        value={formatClock(week.timeInCarS)}
        detail={
          <WeekChange
            change={week.timeInCarS - previousWeek.timeInCarS}
            format={formatClock}
          />
        }
      />

      <KpiCard
        icon={<Route size={ICON_SIZE} />}
        label={t('homePage.kpi.kmWeek')}
        value={formatKm(week.km)}
        detail={
          <WeekChange
            change={Math.round(week.km) - Math.round(previousWeek.km)}
            format={formatKm}
          />
        }
      />

      <KpiCard
        icon={<ShieldCheck size={ICON_SIZE} />}
        label={t('homePage.kpi.cleanLaps')}
        value={clean === null ? DASH : formatPercent(clean)}
        detail={
          <WeekChange
            change={changeBetween(clean, cleanLapsPercent(previousWeek))}
            format={formatPercent}
          />
        }
      />

      <KpiCard
        icon={<Trophy size={ICON_SIZE} />}
        label={t('homePage.kpi.personalBests')}
        value={String(week.personalBests.length)}
        detail={
          <span className={styles.tracks} title={bestTracks.join(', ')}>
            {bestTracks.length > 0
              ? bestTracks.join(', ')
              : t('homePage.kpi.noPersonalBests')}
          </span>
        }
      />
    </>
  );
});

/** The last race, two columns wide, then the last seven days in figures. */
export const HomeKpis = observer(() => {
  const { homeStats, lastRace } = useStatisticsStore();

  return (
    <div className={cx(styles.row, lastRace !== null && styles.withRace)}>
      <LastRaceCard />

      {homeStats !== null && (
        <WeekKpis week={homeStats.week} previousWeek={homeStats.previousWeek} />
      )}
    </div>
  );
});
