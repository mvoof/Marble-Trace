import { useState } from 'react';
import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { BindingsSettings } from '@ui/app/main/components/BindingsSettings/BindingsSettings';
import { DevicesSettings } from '@ui/app/main/components/BindingsSettings/DevicesSettings';
import { StreamChatSourceCard } from './StreamChatSourceCard/StreamChatSourceCard';
import { SettingsNav } from './SettingsNav';
import { GeneralSection } from './sections/GeneralSection';
import { UpdatesSection } from './sections/UpdatesSection';
import { OverlaySection } from './sections/OverlaySection';
import { InteractionSection } from './sections/InteractionSection';
import { TrackMapSection } from './sections/TrackMapSection';
import { SharedValuesSection } from './sections/SharedValuesSection';
import { MaintenanceSection } from './sections/MaintenanceSection';
import { TelemetryInspectorSection } from './sections/TelemetryInspectorSection/TelemetryInspectorSection';
import { RemoteScreensSection } from './sections/RemoteScreensSection';
import {
  DEFAULT_SECTION,
  groupOfSection,
  type SettingsSectionId,
} from './settings-sections';
import styles from './SettingsPage.module.scss';

const SECTION_COMPONENTS: Record<SettingsSectionId, () => React.ReactElement> =
  {
    general: GeneralSection,
    updates: UpdatesSection,
    overlay: OverlaySection,
    interaction: InteractionSection,
    bindings: BindingsSettings,
    devices: DevicesSettings,
    trackMap: TrackMapSection,
    sharedValues: SharedValuesSection,
    streamChat: StreamChatSourceCard,
    remoteScreens: RemoteScreensSection,
    maintenance: MaintenanceSection,
    telemetryInspector: TelemetryInspectorSection,
  };

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
