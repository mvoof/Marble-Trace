import type { ReactNode } from 'react';
import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';

import { useStatisticsStore } from '@features/statistics/statistics-context';
import { formatLapTimeOrDash } from '@shared/lib/telemetry-format';
import { cx } from '@shared/lib/class-names';
import { SettingsCard } from '@shared/ui/SettingsCard/SettingsCard';
import { countryCodeForName } from '@shared/ui/CountryFlag/country-name';
import type { TrackOutline } from '@shared/contracts/generated/bindings';
import styles from './LastRaceCard.module.scss';

const MS_PER_SECOND = 1000;
const DASH = '—';

interface FigureProps {
  label: string;
  children: ReactNode;
}

const Figure = ({ label, children }: FigureProps) => (
  <div className={styles.figure}>
    <span className={styles.figureLabel}>{label}</span>

    <span className={styles.figureValue}>{children}</span>
  </div>
);

interface OutlineProps {
  outline: TrackOutline;
}

/** The track as a line, scaled to the box whatever its size. */
const Outline = ({ outline }: OutlineProps) => (
  <div className={styles.outline}>
    <svg
      className={styles.outlineSvg}
      viewBox={outline.viewBox}
      preserveAspectRatio="xMidYMid meet"
      aria-hidden
    >
      <path d={outline.svgPath} vectorEffect="non-scaling-stroke" />
    </svg>
  </div>
);

/** The latest race: where, in what, and how it went. */
export const LastRaceCard = observer(() => {
  const { t, i18n } = useTranslation('main-app');
  const { lastRace } = useStatisticsStore();

  if (lastRace === null) {
    return null;
  }

  const { session, outline, trackCountry } = lastRace;
  const countryCode = countryCodeForName(trackCountry);
  const date = new Intl.DateTimeFormat(i18n.language, {
    month: 'short',
    day: 'numeric',
  }).format(new Date(session.startedAt * MS_PER_SECOND));

  return (
    <SettingsCard title={t('homePage.lastRace.title')}>
      {outline !== null && <Outline outline={outline} />}

      <div className={styles.track}>
        {countryCode !== null && (
          <span
            className={cx('fi', `fi-${countryCode}`, styles.flag)}
            title={trackCountry ?? undefined}
          />
        )}

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
      </div>
    </SettingsCard>
  );
});
