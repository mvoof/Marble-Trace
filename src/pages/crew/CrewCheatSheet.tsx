import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { App, Button, Tooltip } from 'antd';
import { Printer } from 'lucide-react';
import type { PackFileFailure } from '@features/voice-crew/voice-crew.store';
import { useVoiceCrewStore } from '@features/voice-crew/voice-crew-context';
import { SettingsCard } from '@shared/ui/SettingsCard/SettingsCard';
import styles from './CrewPage.module.scss';
import { PackFileFailureAlert } from './PackFileFailureAlert';

const SHEET_ACTIONS: readonly PackFileFailure['action'][] = ['sheet'];

/** What the engineer understands, as the printable sheet, and its export. */
export const CrewCheatSheet = observer(() => {
  const crew = useVoiceCrewStore();
  const { t, i18n } = useTranslation('main-app');
  const { message } = App.useApp();
  const labelsFor = (language: string) => i18n.getFixedT(language, 'main-app');
  const sheet = crew.commandSheet(labelsFor);

  const exportSheet = async () => {
    const done = await crew.exportSheet(labelsFor);

    if (done?.action === 'sheetExported') {
      void message.success(
        t('crewPage.pack.sheetExported', { path: done.path })
      );
    }
  };

  return (
    <SettingsCard
      title={t('crewPage.pack.sheet')}
      extra={
        <Tooltip title={crew.dirty ? t('crewPage.pack.sheetSaveFirst') : null}>
          <Button
            icon={<Printer size={14} />}
            disabled={crew.busy || crew.dirty || !crew.pack}
            onClick={() => void exportSheet()}
          >
            {t('crewPage.pack.sheetButton')}
          </Button>
        </Tooltip>
      }
    >
      <div className={styles.fieldDesc}>{t('crewPage.pack.sheetDesc')}</div>

      <PackFileFailureAlert actions={SHEET_ACTIONS} />

      {sheet && (
        // The pack may come from someone else: no scripts, no reaching out.
        <iframe
          className={styles.sheet}
          sandbox=""
          srcDoc={sheet}
          title={t('crewPage.pack.sheet')}
        />
      )}
    </SettingsCard>
  );
});
