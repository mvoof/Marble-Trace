import { useState } from 'react';
import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { Button, Modal } from 'antd';
import { List } from 'lucide-react';

import { useLapAnalysisStore } from '@features/lap-analysis/lap-analysis-context';
import { SessionLapsModal } from '@features/lap-analysis/SessionLapsModal/SessionLapsModal';
import { SessionsTable } from '@features/statistics/SessionsTable/SessionsTable';
import { useStatisticsStore } from '@features/statistics/statistics-context';
import { PageTitle } from '@shared/ui/PageTitle/PageTitle';
import { AnalysisSection } from './AnalysisSection';
import styles from './AnalysisSection.module.scss';

const ICON_SIZE = 14;
const SESSIONS_MODAL_WIDTH = 1100;

/**
 * The laps picked for the analysis and their telemetry. Without laps the
 * sessions table fills the page; with them it opens from the title row, and
 * a session picked in it shows its laps to add.
 */
export const AnalysisPage = observer(() => {
  const { t } = useTranslation('main-app');
  const analysis = useLapAnalysisStore();
  const statistics = useStatisticsStore();
  const [isPickingSession, setPickingSession] = useState(false);
  const currentKey = analysis.set.session?.key ?? null;

  const handleOpenSession = (key: string) => {
    setPickingSession(false);
    void analysis.openSession(key);
  };

  return (
    <div className={styles.page}>
      <PageTitle
        title={t('appHeader.sections.analysis')}
        actions={
          currentKey === null ? undefined : (
            <Button
              size="small"
              icon={<List size={ICON_SIZE} />}
              onClick={() => setPickingSession(true)}
            >
              {t('dataPage.analysis.changeSession')}
            </Button>
          )
        }
      />

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
