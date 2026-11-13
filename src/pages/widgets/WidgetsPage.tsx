import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { Segmented } from 'antd';
import { SectionedPage } from '@shared/ui/SectionedPage/SectionedPage';
import {
  MENU_SEPARATOR,
  type MenuSection,
  type SectionMenuEntry,
} from '@shared/ui/SectionedPage/section-menu';
import { useAppSettingsStore } from '@entities/app-settings/app-settings-context';
import type { WidgetMenuSort } from '@entities/app-settings/app-settings.store';
import type { WidgetDefaultConfig } from '@shared/contracts/widget-settings';
import { useWidgetDefaultsStore } from '@entities/widget/widget-defaults-context';
import { getWidgetLabel } from '@entities/widget/widget-i18n';
import { useMainNavigationStore } from '@features/main-navigation/main-navigation-context';
import { AllWidgets } from './AllWidgets/AllWidgets';
import { WidgetWorkbench } from './WidgetWorkbench/WidgetWorkbench';
import { widgetMenuRuns } from './widget-menu';

// The menu's id for All widgets; no widget type is spelled like it.
const ALL_WIDGETS = '*all';

// A sort the file holds that this build does not know reads as the default.
const sortOf = (stored: string): WidgetMenuSort =>
  stored === 'az' ? 'az' : 'tier';

/**
 * The Widgets page: a text-only menu (All widgets, then every widget in the
 * chosen order) and the chosen widget's workbench, or all widgets.
 */
export const WidgetsPage = observer(() => {
  const { t } = useTranslation('main-app');
  const appSettings = useAppSettingsStore();
  const widgetDefaults = useWidgetDefaultsStore();
  const navigation = useMainNavigationStore();

  const sort = sortOf(appSettings.appSettings.widgetMenuSort);
  const runs = widgetMenuRuns(widgetDefaults.catalogWidgets, sort);
  const available = new Set(widgetDefaults.availableWidgetIds);

  const widgetSection = (widget: WidgetDefaultConfig): MenuSection<string> => {
    const isAvailable = available.has(widget.id);
    const label = getWidgetLabel(t, widget);

    return {
      id: widget.id,
      label,
      disabled: !isAvailable,
      hint: isAvailable
        ? undefined
        : `${label} — ${t('widgetsPage.unavailable')}`,
    };
  };

  // All widgets, then each run of widgets, a separator before each.
  const menu: SectionMenuEntry<MenuSection<string>>[] = [
    { id: ALL_WIDGETS, label: t('widgetsPage.allWidgets') },
  ];

  for (const run of runs) {
    menu.push(MENU_SEPARATOR, ...run.map(widgetSection));
  }

  const activeWidgetId = navigation.activeWidgetId;

  const selectSection = (sectionId: string) => {
    if (sectionId === ALL_WIDGETS) {
      navigation.openAllWidgets();

      return;
    }

    navigation.openWidget(sectionId);
  };

  const sortControl = (
    <Segmented<WidgetMenuSort>
      block
      size="small"
      value={sort}
      onChange={(next) => appSettings.update({ widgetMenuSort: next })}
      options={[
        { value: 'tier', label: t('widgetsPage.sort.tier') },
        { value: 'az', label: t('widgetsPage.sort.az') },
      ]}
    />
  );

  return (
    <SectionedPage
      menu={menu}
      active={activeWidgetId ?? ALL_WIDGETS}
      onSelect={selectSection}
      textOnly
      menuHeader={sortControl}
      fillsHeight={activeWidgetId !== null}
    >
      {activeWidgetId === null ? (
        <AllWidgets
          widgets={runs.flat()}
          isAvailable={(widgetId) => available.has(widgetId)}
          labelOf={(widget) => getWidgetLabel(t, widget)}
          onOpen={(widgetId) => navigation.openWidget(widgetId)}
        />
      ) : (
        <WidgetWorkbench widgetId={activeWidgetId} />
      )}
    </SectionedPage>
  );
});
