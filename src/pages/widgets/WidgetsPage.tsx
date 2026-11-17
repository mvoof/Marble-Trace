import { useState } from 'react';
import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { Button, Segmented } from 'antd';
import { Check, PanelLeft, PanelTop, Plus } from 'lucide-react';
import { SectionedPage } from '@shared/ui/SectionedPage/SectionedPage';
import {
  MENU_SEPARATOR,
  type MenuSection,
  type SectionMenuEntry,
} from '@shared/ui/SectionedPage/section-menu';
import { useAppSettingsStore } from '@entities/app-settings/app-settings-context';
import type {
  WidgetMenuSort,
  WidgetPreviewPosition,
} from '@entities/app-settings/app-settings.store';
import { useMainLiveWidgetsStore } from '@entities/layout/main-live-widgets-context';
import type { WidgetDefaultConfig } from '@shared/contracts/widget-settings';
import { useWidgetDefaultsStore } from '@entities/widget/widget-defaults-context';
import { getWidgetLabel } from '@entities/widget/widget-i18n';
import { useMainNavigationStore } from '@features/main-navigation/main-navigation-context';
import { AllWidgets } from './AllWidgets/AllWidgets';
import { WidgetScenarioPicker } from './WidgetWorkbench/WidgetScenarioPicker';
import { WidgetWorkbench } from './WidgetWorkbench/WidgetWorkbench';
import {
  openingScenarioFor,
  scenarioOptionsFor,
} from './WidgetWorkbench/widget-scenarios';
import { widgetMenuRuns } from './widget-menu';
import styles from './WidgetsPage.module.scss';

// The menu's id for All widgets; no widget type is spelled like it.
const ALL_WIDGETS = '*all';

// A sort the file holds that this build does not know reads as the default.
const sortOf = (stored: string): WidgetMenuSort =>
  stored === 'az' ? 'az' : 'tier';

const previewPositionOf = (stored: string): WidgetPreviewPosition =>
  stored === 'left' ? 'left' : 'top';

/**
 * The Widgets page: a text-only menu (All widgets, then every widget in the
 * chosen order) and the chosen widget's workbench, or all widgets.
 */
export const WidgetsPage = observer(() => {
  const { t } = useTranslation('main-app');
  const appSettings = useAppSettingsStore();
  const widgetDefaults = useWidgetDefaultsStore();
  const navigation = useMainNavigationStore();
  const liveWidgets = useMainLiveWidgetsStore();
  // Pinned to the widget it was picked on: a pick says "show me this state of
  // this widget", and carrying it to the next widget shows another domain's
  // state or, on a widget that cannot draw it, nothing at all.
  const [pickedScenario, setPickedScenario] = useState<{
    widgetId: string;
    scenarioId: string;
  } | null>(null);

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
      className={styles.sortSwitch}
      block
      value={sort}
      onChange={(next) => appSettings.update({ widgetMenuSort: next })}
      options={[
        { value: 'tier', label: t('widgetsPage.sort.tier') },
        { value: 'az', label: t('widgetsPage.sort.az') },
      ]}
    />
  );

  const previewPosition = previewPositionOf(
    appSettings.appSettings.widgetPreviewPosition
  );

  const scenarioOptions =
    activeWidgetId === null ? [] : scenarioOptionsFor(activeWidgetId);
  const isPickedHere =
    pickedScenario !== null &&
    pickedScenario.widgetId === activeWidgetId &&
    scenarioOptions.some(
      (option) => option.value === pickedScenario.scenarioId
    );
  let activeScenarioId: string | null = null;

  if (isPickedHere) {
    activeScenarioId = pickedScenario.scenarioId;
  } else if (activeWidgetId !== null) {
    activeScenarioId = openingScenarioFor(activeWidgetId);
  }

  const widgetActions = activeWidgetId !== null && (
    <>
      {scenarioOptions.length > 0 && activeScenarioId !== null && (
        <WidgetScenarioPicker
          options={scenarioOptions}
          value={activeScenarioId}
          onChange={(scenarioId) =>
            setPickedScenario({ widgetId: activeWidgetId, scenarioId })
          }
        />
      )}

      <Segmented<WidgetPreviewPosition>
        value={previewPosition}
        onChange={(next) => appSettings.update({ widgetPreviewPosition: next })}
        options={[
          {
            value: 'top',
            icon: <PanelTop size={15} />,
            title: t('widgetsPage.previewTop'),
          },
          {
            value: 'left',
            icon: <PanelLeft size={15} />,
            title: t('widgetsPage.previewLeft'),
          },
        ]}
      />

      {liveWidgets.isWidgetOnScreen(activeWidgetId) ? (
        <Button disabled icon={<Check size={15} />}>
          {t('widgetsPage.onScreen')}
        </Button>
      ) : (
        <Button
          icon={<Plus size={15} />}
          title={t('widgetsPage.addToLayoutHint')}
          disabled={!available.has(activeWidgetId)}
          onClick={() => liveWidgets.addTypeToScreen(activeWidgetId)}
        >
          {t('widgetsPage.addToLayout')}
        </Button>
      )}
    </>
  );

  // All widgets keeps one order whatever the menu's sort: the sort orders the
  // menu, not the grid.
  const catalogOrder = widgetMenuRuns(widgetDefaults.catalogWidgets, 'tier');

  return (
    <SectionedPage
      menu={menu}
      active={activeWidgetId ?? ALL_WIDGETS}
      onSelect={selectSection}
      textOnly
      menuHeader={sortControl}
      subtitle={
        activeWidgetId === null
          ? t('widgetsPage.widgetsCount', { count: catalogOrder.flat().length })
          : undefined
      }
      titleActions={widgetActions || undefined}
      pinnedTitle={activeWidgetId !== null}
    >
      {activeWidgetId === null || activeScenarioId === null ? (
        <AllWidgets
          widgets={catalogOrder.flat()}
          isAvailable={(widgetId) => available.has(widgetId)}
          labelOf={(widget) => getWidgetLabel(t, widget)}
          onOpen={(widgetId) => navigation.openWidget(widgetId)}
        />
      ) : (
        <WidgetWorkbench
          widgetId={activeWidgetId}
          scenarioId={activeScenarioId}
          previewPosition={previewPosition}
        />
      )}
    </SectionedPage>
  );
});
