import { useState, type ReactNode } from 'react';
import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { Button, Modal } from 'antd';
import { List } from 'lucide-react';

import { useLapAnalysisStore } from '@features/lap-analysis/lap-analysis-context';
import { SessionLapsModal } from '@features/lap-analysis/SessionLapsModal/SessionLapsModal';
import { SessionsTable } from '@features/statistics/SessionsTable/SessionsTable';
import { useStatisticsStore } from '@features/statistics/statistics-context';
import type { RecentSession } from '@shared/contracts/generated/bindings';
import { PageTitle } from '@shared/ui/PageTitle/PageTitle';
import { AnalysisSection } from './AnalysisSection';
import { AnalysisSettings } from './AnalysisSettings';
import styles from './AnalysisSection.module.scss';

const ICON_SIZE = 14;
const SESSIONS_MODAL_WIDTH = 1100;
const MS_PER_SECOND = 1000;
const DASH = '—';
const SEPARATOR = ' · ';

/** The session's track as the title, its car, kind and date beside it. */
const SessionTitle = observer(
  ({ session, actions }: { session: RecentSession; actions: ReactNode }) => {
    const { t, i18n } = useTranslation('main-app');

    const date = new Intl.DateTimeFormat(i18n.language, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(session.startedAt * MS_PER_SECOND));

    const track = [session.trackName ?? DASH, session.trackConfig]
      .filter((part) => part !== null)
      .join(SEPARATOR);

    const details = [
      session.carName ?? DASH,
      t(`homePage.recentSessions.kind.${session.kind}`),
      date,
    ].join(SEPARATOR);

    return <PageTitle title={track} subtitle={details} actions={actions} />;
  }
);

/**
 * The laps picked for the analysis and their telemetry. Without laps the
 * sessions table fills the page; with them the session's title row opens it,
 * and a session picked in it shows its laps to add.
 */
export const AnalysisPage = observer(() => {
  const { t } = useTranslation('main-app');
  const analysis = useLapAnalysisStore();
  const statistics = useStatisticsStore();
  const [isPickingSession, setPickingSession] = useState(false);
  const session = analysis.set.session;
  const currentKey = session?.key ?? null;

  const handleOpenSession = (key: string) => {
    setPickingSession(false);
    void analysis.openSession(key);
  };

  return (
    <div className={styles.page}>
      {session !== null && (
        <SessionTitle
          session={session}
          actions={
            <>
              <AnalysisSettings />

              <Button
                size="small"
                icon={<List size={ICON_SIZE} />}
                onClick={() => setPickingSession(true)}
              >
                {t('dataPage.analysis.changeSession')}
              </Button>
            </>
          }
        />
      )}

      {currentKey === null ? (
        <>
          <p className={styles.empty}>{t('dataPage.analysis.empty')}</p>

          <SessionsTable onOpenSession={handleOpenSession} />
        </>
      ) : (
        <AnalysisSection />
      )}

      <Modal
        open={isPickingSession}
        width={SESSIONS_MODAL_WIDTH}
        footer={null}
        title={t('dataPage.analysis.sessionsTitle')}
        onCancel={() => setPickingSession(false)}
      >
        <SessionsTable
          onOpenSession={handleOpenSession}
          currentKey={currentKey}
        />
      </Modal>

      <SessionLapsModal
        onSessionDeleted={() => void statistics.loadSessions()}
      />
    </div>
  );
});
