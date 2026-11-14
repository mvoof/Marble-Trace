import type { ReactNode } from 'react';
import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { CalendarDays, Repeat, TriangleAlert } from 'lucide-react';

import { useStatisticsStore } from '@features/statistics/statistics-context';
import {
  directionOf,
  incidentsPerLap,
  incidentsPerLapChange,
} from '@features/statistics/home-stats';
import { changeLabel } from './home-format';
import { RatingsCard } from './RatingsCard';
import styles from './HomeKpis.module.scss';

const ICON_SIZE = 14;
const PER_LAP_DIGITS = 2;
const DASH = '—';

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

/** Incidents per lap of the last seven days, and how they moved on the seven before. */
const IncidentsPerLapCard = observer(() => {
  const { t } = useTranslation('main-app');
  const { homeStats } = useStatisticsStore();
  const perLap = homeStats ? incidentsPerLap(homeStats.week) : null;
  const change = homeStats
    ? incidentsPerLapChange(homeStats.week, homeStats.previousWeek)
    : null;
  // More incidents is the bad way: it takes the colour of a fall.
  const direction = directionOf(change === null ? null : -change);

  return (
    <KpiCard
      icon={<TriangleAlert size={ICON_SIZE} />}
      label={t('homePage.kpi.incidentsPerLap')}
      value={perLap === null ? DASH : perLap.toFixed(PER_LAP_DIGITS)}
      detail={
        <>
          {change !== null && (
            <span className={`${styles.change} ${styles[direction]}`}>
              {changeLabel(change, PER_LAP_DIGITS)}{' '}
            </span>
          )}
          <span className={styles.muted}>{t('homePage.kpi.sevenDays')}</span>
        </>
      }
    />
  );
});

/** The licence and iRating card, then the last seven days in figures. */
export const HomeKpis = observer(() => {
  const { t, i18n } = useTranslation('main-app');
  const { homeStats } = useStatisticsStore();
  const week = homeStats?.week;
  const numberFormat = new Intl.NumberFormat(i18n.language);
  const practices = week ? week.sessions - week.races : 0;

  return (
    <div className={styles.kpis}>
      <RatingsCard />

      <KpiCard
        icon={<CalendarDays size={ICON_SIZE} />}
        label={t('homePage.kpi.sessions')}
        value={week ? numberFormat.format(week.sessions) : DASH}
        detail={
          <span className={styles.muted}>
            {t('homePage.kpi.sessionsSplit', {
              races: week?.races ?? 0,
              practices,
            })}
          </span>
        }
      />

      <KpiCard
        icon={<Repeat size={ICON_SIZE} />}
        label={t('homePage.kpi.laps')}
        value={week ? numberFormat.format(week.laps) : DASH}
        detail={
          <span className={styles.muted}>{t('homePage.kpi.sevenDays')}</span>
        }
      />

      <IncidentsPerLapCard />
    </div>
  );
});
