import { useEffect, useState, type ComponentType } from 'react';
import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { Alert, Button } from 'antd';
import {
  BookOpen,
  Download,
  MessageCircle,
  Package,
  Radio,
  type LucideIcon,
} from 'lucide-react';
import { useVoiceCrewStore } from '@features/voice-crew/voice-crew-context';
import { SectionedPage } from '@shared/ui/SectionedPage/SectionedPage';
import { CrewOverview } from './CrewOverview';
import { CrewCheatSheet } from './CrewCheatSheet';
import { CrewCommands } from './CrewCommands';
import { CrewDownloads } from './CrewDownloads';
import { CrewPackFiles } from './CrewPackFiles';
import { CrewSaveBar } from './CrewSaveBar';
import {
  CREW_MENU,
  DEFAULT_CREW_SECTION,
  type CrewSectionId,
} from './crew-sections';
import styles from './CrewPage.module.scss';

const SECTION_ICONS: Record<CrewSectionId, LucideIcon> = {
  overview: Radio,
  downloads: Download,
  commands: BookOpen,
  phrases: MessageCircle,
  packs: Package,
};

const SECTION_COMPONENTS: Record<CrewSectionId, ComponentType> = {
  overview: CrewOverview,
  downloads: CrewDownloads,
  commands: CrewCheatSheet,
  phrases: CrewCommands,
  packs: CrewPackFiles,
};

/** Where the engineer is set up; a not-ready engineer is not flagged there. */
const SETUP_SECTIONS: ReadonlySet<CrewSectionId> = new Set([
  'overview',
  'downloads',
]);

/** The editor fills the pane with its own list and bar; the rest scroll. */
const FILLING_SECTION: CrewSectionId = 'phrases';

/**
 * The voice crew. The engineer is all it has so far: how they stand and
 * sound, what they understand, what they answer, and the packs that hold it.
 */
export const CrewPage = observer(() => {
  const crew = useVoiceCrewStore();
  const { t } = useTranslation('main-app');

  const [activeSection, setActiveSection] =
    useState<CrewSectionId>(DEFAULT_CREW_SECTION);

  useEffect(() => {
    crew.start();

    return () => crew.dispose();
  }, [crew]);

  const menu = CREW_MENU.map((sectionId) => ({
    id: sectionId,
    label: t(`crewPage.sections.${sectionId}`),
    icon: SECTION_ICONS[sectionId],
  }));

  const ActiveSection = SECTION_COMPONENTS[activeSection];
  const fillsPane = activeSection === FILLING_SECTION;

  return (
    <SectionedPage
      menu={menu}
      active={activeSection}
      onSelect={setActiveSection}
      fillsHeight={fillsPane}
    >
      {!crew.ready && !SETUP_SECTIONS.has(activeSection) && (
        <Alert
          className={styles.alert}
          type="info"
          showIcon
          title={t('crewPage.notReady')}
          action={
            <Button size="small" onClick={() => setActiveSection('overview')}>
              {t('crewPage.openOverview')}
            </Button>
          }
        />
      )}

      {crew.dirty && crew.packOutdated && (
        <Alert
          className={styles.alert}
          type="warning"
          showIcon
          title={t('crewPage.packOutdated', {
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
          title={crew.lastError}
        />
      )}

      {fillsPane ? (
        <div className={styles.body}>
          <ActiveSection />
        </div>
      ) : (
        <>
          <ActiveSection />

          <div className={styles.stickyBar}>
            <CrewSaveBar />
          </div>
        </>
      )}
    </SectionedPage>
  );
});
