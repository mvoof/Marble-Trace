import { useState } from 'react';
import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { BarChart3, Fuel, Route, type LucideIcon } from 'lucide-react';
import { SectionedPage } from '@shared/ui/SectionedPage/SectionedPage';
import { TrackMapSection } from './TrackMapSection';
import { SharedValuesSection } from './SharedValuesSection';
import { StatisticsSection } from './StatisticsSection';
import { ExportCsvButton } from './ExportCsvButton';
import {
  DATA_MENU,
  DEFAULT_DATA_SECTION,
  type DataSectionId,
} from './data-sections';

const SECTION_ICONS: Record<DataSectionId, LucideIcon> = {
  tracks: Route,
  strategy: Fuel,
  statistics: BarChart3,
};

const SECTION_COMPONENTS: Record<DataSectionId, () => React.ReactElement> = {
  tracks: TrackMapSection,
  strategy: SharedValuesSection,
  statistics: StatisticsSection,
};

/** Recorded tracks, strategy values and statistics, one at a time. */
export const DataPage = observer(() => {
  const { t } = useTranslation('main-app');

  const [activeSection, setActiveSection] =
    useState<DataSectionId>(DEFAULT_DATA_SECTION);

  const menu = DATA_MENU.map((sectionId) => ({
    id: sectionId,
    label: t(`dataPage.sections.${sectionId}`),
    icon: SECTION_ICONS[sectionId],
  }));

  const ActiveSection = SECTION_COMPONENTS[activeSection];
  const isStatistics = activeSection === 'statistics';

  return (
    <SectionedPage
      menu={menu}
      active={activeSection}
      onSelect={setActiveSection}
      subtitle={isStatistics ? t('dataPage.statistics.subtitle') : undefined}
      titleActions={isStatistics ? <ExportCsvButton /> : undefined}
    >
      <ActiveSection />
    </SectionedPage>
  );
});
