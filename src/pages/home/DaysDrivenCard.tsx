import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { Tooltip } from 'antd';
import { CalendarDays } from 'lucide-react';

import { useStatisticsStore } from '@features/statistics/statistics-context';
import {
  drivenTotals,
  intensityLevel,
  monthStarts,
  type DrivenDay,
  type IntensityLevel,
} from '@features/statistics/days-driven';
import { useFormatDuration } from './home-format';
import styles from './DaysDrivenCard.module.scss';

const MS_PER_SECOND = 1000;
const ICON_SIZE = 14;
const LEGEND_LEVELS: IntensityLevel[] = [0, 1, 2, 3, 4];
/** Rows of the week labelled at the left: Monday, Wednesday, Friday. */
const LABELLED_ROWS = new Set([0, 2, 4]);
const DAYS_PER_WEEK = 7;
const DASH = '—';

/** The day's sessions in the order driven: track, car, time in the car. */
const DayTooltip = observer(({ day }: { day: DrivenDay }) => {
  const { i18n } = useTranslation('main-app');
  const formatDuration = useFormatDuration();
  const dateFormat = new Intl.DateTimeFormat(i18n.language, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });

  return (
    <div className={styles.tooltip}>
      <div className={styles.tooltipHead}>
        <span>
          {dateFormat.format(new Date(day.dayStartS * MS_PER_SECOND))}
        </span>

        <span className={styles.mono}>{formatDuration(day.timeInCarS)}</span>
      </div>

      {day.sessions.map((session) => (
        <div key={session.key} className={styles.tooltipSession}>
          <span className={styles.tooltipNames}>
            {session.trackName ?? DASH}
            <span className={styles.muted}> · {session.carName ?? DASH}</span>
          </span>

          <span className={styles.mono}>
            {formatDuration(session.timeInCarS)}
          </span>
        </div>
      ))}
    </div>
  );
});

const DayCell = observer(
  ({ day, longestDayS }: { day: DrivenDay; longestDayS: number }) => {
    const level = intensityLevel(day.timeInCarS, longestDayS);

    if (day.future) {
      return <i className={styles.future} />;
    }

    if (level === 0) {
      return <i className={styles.cell} data-level={level} />;
    }

    return (
      <Tooltip title={<DayTooltip day={day} />} mouseEnterDelay={0}>
        <i className={styles.cell} data-level={level} />
      </Tooltip>
    );
  }
);

/** Month names over the columns where each month's first week starts. */
const MonthLabels = observer(({ weeks }: { weeks: DrivenDay[][] }) => {
  const { i18n } = useTranslation('main-app');
  const monthFormat = new Intl.DateTimeFormat(i18n.language, {
    month: 'short',
  });

  return (
    <div className={styles.months}>
      {monthStarts(weeks).map(({ column, mondayS }) => (
        <span
          key={mondayS}
          className={styles.month}
          style={{ gridColumnStart: column + 1 }}
        >
          {monthFormat.format(new Date(mondayS * MS_PER_SECOND))}
        </span>
      ))}
    </div>
  );
});

/** Mon, Wed and Fri in the app's language, beside their rows. */
const WeekdayLabels = observer(({ week }: { week: DrivenDay[] }) => {
  const { i18n } = useTranslation('main-app');
  const weekdayFormat = new Intl.DateTimeFormat(i18n.language, {
    weekday: 'short',
  });

  return (
    <div className={styles.weekdays}>
      {week.slice(0, DAYS_PER_WEEK).map((day, row) => (
        <span key={day.dayStartS}>
          {LABELLED_ROWS.has(row)
            ? weekdayFormat.format(new Date(day.dayStartS * MS_PER_SECOND))
            : ''}
        </span>
      ))}
    </div>
  );
});

/** The last 26 weeks, a cell a day, shaded by the time spent in the car. */
export const DaysDrivenCard = observer(() => {
  const { t } = useTranslation('main-app');
  const formatDuration = useFormatDuration();
  const statistics = useStatisticsStore();
  const weeks = statistics.drivenWeeks;
  const longestDayS = statistics.longestDrivenDayS;
  const totals = drivenTotals(weeks);

  return (
    <section className={styles.card}>
      <div className={styles.head}>
        <CalendarDays size={ICON_SIZE} />
        {t('homePage.calendar.title')}
        <span className={styles.span}>{t('homePage.calendar.span')}</span>
      </div>

      <div className={styles.calendar}>
        <MonthLabels weeks={weeks} />

        {weeks.length > 0 && <WeekdayLabels week={weeks[0]} />}

        <div className={styles.grid}>
          {weeks.flat().map((day) => (
            <DayCell key={day.dayStartS} day={day} longestDayS={longestDayS} />
          ))}
        </div>
      </div>

      <div className={styles.legend}>
        <span>
          {t('homePage.calendar.summary', {
            days: totals.days,
            time: formatDuration(totals.timeInCarS),
          })}
        </span>

        <span className={styles.scale}>
          {t('homePage.calendar.less')}
          {LEGEND_LEVELS.map((level) => (
            <i key={level} className={styles.cell} data-level={level} />
          ))}
          {t('homePage.calendar.more')}
        </span>
      </div>
    </section>
  );
});
