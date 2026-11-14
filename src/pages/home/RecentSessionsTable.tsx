import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';

import { useStatisticsStore } from '@features/statistics/statistics-context';
import { formatLapTimeOrDash } from '@shared/lib/telemetry-format';
import { SettingsCard } from '@shared/ui/SettingsCard/SettingsCard';
import type { RecentSession } from '@shared/contracts/generated/bindings';
import { finishLabel } from './recent-session-format';
import styles from './RecentSessionsTable.module.scss';

const MS_PER_SECOND = 1000;
const DASH = '—';

const FinishCell = ({ session }: { session: RecentSession }) => {
  const { t } = useTranslation('main-app');
  const label = finishLabel(session);

  if (label.kind === 'place') {
    return <td className={styles.mono}>{label.text}</td>;
  }

  if (label.kind === 'event') {
    return (
      <td className={styles.secondary}>
        {t(`homePage.recentSessions.eventType.${label.eventType}`)}
      </td>
    );
  }

  if (label.kind === 'raw') {
    return <td className={styles.secondary}>{label.text}</td>;
  }

  return <td className={styles.muted}>{DASH}</td>;
};

/** The latest sessions the stats import recorded, newest first. */
export const RecentSessionsTable = observer(() => {
  const { t, i18n } = useTranslation('main-app');
  const { recentSessions } = useStatisticsStore();
  const dateFormat = new Intl.DateTimeFormat(i18n.language, {
    month: 'short',
    day: 'numeric',
  });

  return (
    <SettingsCard title={t('homePage.recentSessions.title')}>
      <div className={styles.scroll}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>{t('homePage.recentSessions.date')}</th>
              <th>{t('homePage.recentSessions.track')}</th>
              <th>{t('homePage.recentSessions.car')}</th>
              <th>{t('homePage.recentSessions.finish')}</th>
              <th>{t('homePage.recentSessions.bestLap')}</th>
              <th>{t('homePage.recentSessions.incidents')}</th>
            </tr>
          </thead>

          <tbody>
            {recentSessions.map((session) => (
              <tr key={session.key}>
                <td className={styles.secondary}>
                  {dateFormat.format(
                    new Date(session.startedAt * MS_PER_SECOND)
                  )}
                </td>

                <td title={session.trackConfig ?? undefined}>
                  {session.trackName ?? DASH}
                </td>

                <td className={styles.secondary}>{session.carName ?? DASH}</td>

                <FinishCell session={session} />

                <td className={styles.mono}>
                  {formatLapTimeOrDash(session.bestLapS)}
                </td>

                <td className={styles.mono}>{session.incidents}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SettingsCard>
  );
});
