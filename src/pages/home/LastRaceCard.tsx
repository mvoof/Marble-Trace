import type { ReactNode } from 'react';
import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';

import { useStatisticsStore } from '@features/statistics/statistics-context';
import { directionOf } from '@features/statistics/home-stats';
import { formatLapTimeOrDash } from '@shared/lib/telemetry-format';
import { cx } from '@shared/lib/class-names';
import { SettingsCard } from '@shared/ui/SettingsCard/SettingsCard';
import styles from './LastRaceCard.module.scss';

const MS_PER_SECOND = 1000;
const DASH = '—';

interface FigureProps {
  label: string;
  children: ReactNode;
  className?: string;
  title?: string;
}

const Figure = ({ label, children, className, title }: FigureProps) => (
  <div className={styles.figure} title={title}>
    <span className={styles.figureLabel}>{label}</span>

    <span className={cx(styles.figureValue, className)}>{children}</span>
  </div>
);

/** The latest race: where, in what, and how it went. */
export const LastRaceCard = observer(() => {
  const { t, i18n } = useTranslation('main-app');
  const { lastRace } = useStatisticsStore();

  if (lastRace === null) {
    return null;
  }

  const { session, iratingChange } = lastRace;
  const date = new Intl.DateTimeFormat(i18n.language, {
    month: 'short',
    day: 'numeric',
  }).format(new Date(session.startedAt * MS_PER_SECOND));
  const direction = directionOf(iratingChange);
  const iratingText =
    iratingChange === null
      ? DASH
      : `${iratingChange > 0 ? '+' : ''}${iratingChange}`;

  return (
    <SettingsCard title={t('homePage.lastRace.title')}>
      <div className={styles.track}>
        {session.trackName ?? DASH}

        {session.trackConfig !== null && (
          <span className={styles.config}> · {session.trackConfig}</span>
        )}
      </div>

      <div className={styles.carLine}>
        {session.carName ?? DASH} · {date}
      </div>

      <div className={styles.figures}>
        <Figure label={t('homePage.lastRace.finish')}>
          {session.finishPos === null ? (
            DASH
          ) : (
            <span className={styles.finish}>
              P{session.finishPos}
              {session.fieldSize !== null && (
                <span className={styles.field}>/{session.fieldSize}</span>
              )}
            </span>
          )}
        </Figure>

        <Figure label={t('homePage.lastRace.bestLap')}>
          {formatLapTimeOrDash(session.bestLapS)}
        </Figure>

        <Figure label={t('homePage.lastRace.incidents')}>
          {session.incidents}x
        </Figure>

        <Figure
          label={t('homePage.lastRace.irating')}
          className={styles[direction]}
          title={
            iratingChange === null
              ? t('homePage.lastRace.iratingUnknown')
              : undefined
          }
        >
          {iratingText}
        </Figure>
      </div>
    </SettingsCard>
  );
});
