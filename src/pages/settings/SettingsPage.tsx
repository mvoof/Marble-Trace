import { useState } from 'react';
import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import {
  Activity,
  Info,
  Layers,
  MousePointer2,
  RefreshCw,
  SlidersHorizontal,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import { SectionedPage } from '@shared/ui/SectionedPage/SectionedPage';
import { MENU_SEPARATOR } from '@shared/ui/SectionedPage/section-menu';
import { SECTION_COMPONENTS } from './section-components';
import {
  DEFAULT_SETTINGS_SECTION,
  SETTINGS_MENU,
  type SettingsMenuSectionId,
} from './settings-sections';

const SECTION_ICONS: Record<SettingsMenuSectionId, LucideIcon> = {
  general: SlidersHorizontal,
  overlay: Layers,
  interaction: MousePointer2,
  updates: RefreshCw,
  maintenance: Wrench,
  about: Info,
  telemetryInspector: Activity,
};

export const SettingsPage = observer(() => {
  const { t } = useTranslation('main-app');

  const [activeSection, setActiveSection] = useState<SettingsMenuSectionId>(
    DEFAULT_SETTINGS_SECTION
  );

  const menu = SETTINGS_MENU.map((entry) =>
    entry === MENU_SEPARATOR
      ? entry
      : {
          id: entry,
          label: t(`settingsPage.nav.sections.${entry}`),
          icon: SECTION_ICONS[entry],
        }
  );

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
