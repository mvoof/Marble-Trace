import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import {
  Activity,
  AppWindow,
  BarChart3,
  Fuel,
  Info,
  Keyboard,
  Layers,
  MessageSquare,
  MonitorSmartphone,
  MousePointer2,
  RefreshCw,
  Route,
  SlidersHorizontal,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import { useMainNavigationStore } from '@features/main-navigation/main-navigation-context';
import { SectionedPage } from '@shared/ui/SectionedPage/SectionedPage';
import { CardGrid } from '@shared/ui/CardGrid/CardGrid';
import { MENU_SEPARATOR } from '@shared/ui/SectionedPage/section-menu';
import { SECTION_COMPONENTS } from './section-components';
import { BindingSearch } from './hotkeys/BindingSearch';
import { ExportCsvButton } from './data/ExportCsvButton';
import {
  SETTINGS_MENU,
  settingsSectionOf,
  type SettingsMenuSectionId,
} from './settings-sections';

const SECTION_ICONS: Record<SettingsMenuSectionId, LucideIcon> = {
  general: SlidersHorizontal,
  overlay: Layers,
  interaction: MousePointer2,
  hotkeys: Keyboard,
  browserScreens: MonitorSmartphone,
  streamChat: MessageSquare,
  companionApps: AppWindow,
  tracks: Route,
  strategy: Fuel,
  statistics: BarChart3,
  updates: RefreshCw,
  maintenance: Wrench,
  about: Info,
  telemetryInspector: Activity,
};

/** Sections laid out on their own: two columns, or a tool filling the pane. */
const OWN_LAYOUT = new Set<SettingsMenuSectionId>([
  'hotkeys',
  'telemetryInspector',
]);

/** Controls a section puts at the right of its title. */
const TITLE_ACTIONS: Partial<
  Record<SettingsMenuSectionId, React.ReactElement>
> = {
  hotkeys: <BindingSearch />,
  statistics: <ExportCsvButton />,
};

export const SettingsPage = observer(() => {
  const { t } = useTranslation('main-app');

  const navigation = useMainNavigationStore();
  const activeSection = settingsSectionOf(navigation.settingsSection);

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
      onSelect={(section: SettingsMenuSectionId) =>
        navigation.selectSettingsSection(section)
      }
      subtitle={
        activeSection === 'statistics'
          ? t('dataPage.statistics.subtitle')
          : undefined
      }
      titleActions={TITLE_ACTIONS[activeSection]}
    >
      {OWN_LAYOUT.has(activeSection) ? (
        <ActiveSection />
      ) : (
        <CardGrid>
          <ActiveSection />
        </CardGrid>
      )}
    </SectionedPage>
  );
});
