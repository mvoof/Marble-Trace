import { useEffect, useState, type ComponentType } from 'react';
import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { Alert, Button, Segmented } from 'antd';
import { useVoiceCrewStore } from '@features/voice-crew/voice-crew-context';
import { CrewDownloads } from './CrewDownloads';
import { CrewVoice } from './CrewVoice';
import { CrewCommands } from './CrewCommands';
import { CrewPackFiles } from './CrewPackFiles';
import { CrewSaveBar } from './CrewSaveBar';
import styles from './CrewPage.module.scss';

type CrewSection = 'commands' | 'voice' | 'downloads' | 'pack';

const SECTIONS: CrewSection[] = ['commands', 'voice', 'downloads', 'pack'];

const SECTION_COMPONENTS: Record<CrewSection, ComponentType> = {
  commands: CrewCommands,
  voice: CrewVoice,
  downloads: CrewDownloads,
  pack: CrewPackFiles,
};

/**
 * The voice crew: what it hears and says first, then how it sounds and what
 * it needs downloaded. Commands fill the window as a list and an editor, with
 * their own bar; the other sections scroll as one column.
 */
export const CrewPage = observer(() => {
  const crew = useVoiceCrewStore();
  const { t } = useTranslation('main-app');
  const [section, setSection] = useState<CrewSection>('commands');
  const Section = SECTION_COMPONENTS[section];
  const fillsWindow = section === 'commands';

  useEffect(() => {
    crew.start();

    return () => crew.dispose();
  }, [crew]);

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h2 className={styles.title}>{t('crewPage.title')}</h2>

        <Segmented
          value={section}
          onChange={(value) => setSection(value as CrewSection)}
          options={SECTIONS.map((value) => ({
            value,
            label: t(`crewPage.sections.${value}`),
          }))}
        />
      </div>

      {!crew.ready && section !== 'downloads' && (
        <Alert
          className={styles.alert}
          type="info"
          showIcon
          message={t('crewPage.notReady')}
          action={
            <Button size="small" onClick={() => setSection('downloads')}>
              {t('crewPage.openDownloads')}
            </Button>
          }
        />
      )}

      {crew.dirty && crew.packOutdated && (
        <Alert
          className={styles.alert}
          type="warning"
          showIcon
          message={t('crewPage.packOutdated', {
            pack: crew.packLanguage,
            language: crew.language,
          })}
        />
      )}

      {crew.lastError && (
        <Alert
          className={styles.alert}
          type="error"
          showIcon
          message={crew.lastError}
        />
      )}

      <div className={fillsWindow ? styles.body : styles.bodyScroll}>
        {fillsWindow ? (
          <Section />
        ) : (
          <div className={styles.column}>
            <Section />
          </div>
        )}
      </div>

      {!fillsWindow && <CrewSaveBar />}
    </div>
  );
});
