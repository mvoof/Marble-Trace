import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { Tooltip } from 'antd';

import { useStatisticsStore } from '@features/statistics/statistics-context';
import {
  intensityLevel,
  type DrivenDay,
  type IntensityLevel,
} from '@features/statistics/days-driven';
import { SettingsCard } from '@shared/ui/SettingsCard/SettingsCard';
import { useFormatDuration } from './home-format';
import styles from './DaysDrivenCard.module.scss';

const MS_PER_SECOND = 1000;
const LEGEND_LEVELS: IntensityLevel[] = [0, 1, 2, 3, 4];
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

/** The last 53 weeks, a cell a day, shaded by the time spent in the car. */
export const DaysDrivenCard = observer(() => {
  const { t } = useTranslation('main-app');
  const statistics = useStatisticsStore();
  const longestDayS = statistics.longestDrivenDayS;

  return (
    <SettingsCard
      title={
        <>
          {t('homePage.calendar.title')}
          <span className={styles.titleAside}>
            {' · '}
            {t('homePage.calendar.timeInCar')}
          </span>
        </>
      }
      extra={
        <div className={styles.legend}>
          {t('homePage.calendar.less')}
          {LEGEND_LEVELS.map((level) => (
            <i key={level} className={styles.cell} data-level={level} />
          ))}
          {t('homePage.calendar.more')}
        </div>
      }
    >
      {/* The newest week at the right; a narrow window cuts the oldest. */}
      <div className={styles.viewport}>
        <div className={styles.grid}>
          {statistics.drivenWeeks.flat().map((day) => (
            <DayCell key={day.dayStartS} day={day} longestDayS={longestDayS} />
          ))}
        </div>
      </div>
    </SettingsCard>
  );
});
