import { useState } from 'react';
import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import {
  AppWindow,
  MessageSquare,
  MonitorSmartphone,
  type LucideIcon,
} from 'lucide-react';
import { SectionedPage } from '@shared/ui/SectionedPage/SectionedPage';
import { RemoteScreensSection } from '@features/remote-screens/RemoteScreensSection';
import { CompanionAppsSection } from '@features/companion-apps/CompanionAppsSection';
import { StreamChatSection } from './StreamChatSection';
import {
  CONNECTIONS_MENU,
  DEFAULT_CONNECTIONS_SECTION,
  type ConnectionsSectionId,
} from './connections-sections';

const SECTION_ICONS: Record<ConnectionsSectionId, LucideIcon> = {
  browserScreens: MonitorSmartphone,
  streamChat: MessageSquare,
  companionApps: AppWindow,
};

const SECTION_COMPONENTS: Record<
  ConnectionsSectionId,
  () => React.ReactElement
> = {
  browserScreens: RemoteScreensSection,
  streamChat: StreamChatSection,
  companionApps: CompanionAppsSection,
};

/** Browser screens, stream chat and companion apps, one at a time. */
export const ConnectionsPage = observer(() => {
  const { t } = useTranslation('main-app');

  const [activeSection, setActiveSection] = useState<ConnectionsSectionId>(
    DEFAULT_CONNECTIONS_SECTION
  );

  const menu = CONNECTIONS_MENU.map((sectionId) => ({
    id: sectionId,
    label: t(`connectionsPage.sections.${sectionId}`),
    icon: SECTION_ICONS[sectionId],
  }));

  const ActiveSection = SECTION_COMPONENTS[activeSection];

  return (
    <SectionedPage
      menu={menu}
      active={activeSection}
      onSelect={setActiveSection}
    >
      <ActiveSection />
    </SectionedPage>
  );
});
