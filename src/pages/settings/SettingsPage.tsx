import { useState } from 'react';
import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { SettingsNav } from './SettingsNav';
import { SECTION_COMPONENTS } from './section-components';
import {
  DEFAULT_SECTION,
  groupOfSection,
  type SettingsSectionId,
} from './settings-sections';
import styles from './SettingsPage.module.scss';

export const SettingsPage = observer(() => {
  const { t } = useTranslation('main-app');

  const [activeSection, setActiveSection] =
    useState<SettingsSectionId>(DEFAULT_SECTION);

  // More than one group may stay open at a time — collapsing the group you just
  // navigated away from hides where you were.
  const [openGroups, setOpenGroups] = useState<string[]>([
    groupOfSection(DEFAULT_SECTION),
  ]);

  const toggleGroup = (groupId: string) => {
    setOpenGroups((open) =>
      open.includes(groupId)
        ? open.filter((candidate) => candidate !== groupId)
        : [...open, groupId]
    );
  };

  const ActiveSection = SECTION_COMPONENTS[activeSection];

  return (
    <div className={styles.animateFadeIn}>
      <header className={styles.header}>
        <span className={styles.moduleLabel}>
          {t('settingsPage.moduleLabel')}
        </span>

        <h1 className={styles.title}>{t('settingsPage.title')}</h1>
      </header>

      <div className={styles.layout}>
        <SettingsNav
          active={activeSection}
          openGroups={openGroups}
          onSelect={setActiveSection}
          onToggleGroup={toggleGroup}
        />

        <div className={styles.pane}>
          <h2 className={styles.paneTitle}>
            {t(`settingsPage.nav.sections.${activeSection}`)}
          </h2>

          <ActiveSection />
        </div>
      </div>
    </div>
  );
});
