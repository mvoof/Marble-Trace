import { makeAutoObservable, runInAction } from 'mobx';

import { DEFAULT_WIDGETS } from '@store/widget-defaults';
import { mergeWithDefaults } from '@utils/deep-merge';
import { applyLayoutResize } from '@utils/widget/layout-resize';
import type {
  BaseUserSettings,
  WidgetDefaultConfig,
  WidgetSpecificSettings,
  WidgetUserSettings,
} from '@/types/widget-settings';

const FUEL_BAR_WIDTH_MIN = 5;
const FUEL_BAR_WIDTH_MAX = 20;

/**
 * The global widget catalog — the template edited on the Widgets page, before a
 * widget is ever placed in a layout.
 *
 * Deliberately independent of the live working copy in `WidgetSettingsStore`:
 * editing a template never touches what the overlay is currently drawing, and
 * nothing here reaches the backend. A new layout copies these as its starting
 * widgets.
 */
export class WidgetDefaultsStore {
  widgets = new Map<string, WidgetDefaultConfig>(
    DEFAULT_WIDGETS.map((widgetConfig) => [
      widgetConfig.id,
      { ...widgetConfig, userSettings: { ...widgetConfig.userSettings } },
    ])
  );

  // Bumped on every mutation so the catalog preview can react without coupling
  // to the live layout's changeToken.
  changeToken = 0;

  constructor() {
    makeAutoObservable(this, {}, { autoBind: true });
  }

  getWidget(id: string): WidgetDefaultConfig | undefined {
    return this.widgets.get(id);
  }

  getSettings<SpecificSettings extends WidgetSpecificSettings>(
    id: string
  ): BaseUserSettings & SpecificSettings {
    const widget = this.widgets.get(id);

    const fallback = DEFAULT_WIDGETS.find(
      (defaultWidget) => defaultWidget.id === id
    )?.userSettings as (BaseUserSettings & SpecificSettings) | undefined;

    return (
      (widget?.userSettings as unknown as BaseUserSettings &
        SpecificSettings) ?? fallback
    );
  }

  updateUserSettings(id: string, partial: Partial<WidgetUserSettings>) {
    const widget = this.widgets.get(id);

    if (!widget) return;

    let resolvedPartial = partial;

    if (
      id === 'fuel' &&
      'barWidth' in partial &&
      partial.barWidth !== undefined
    ) {
      resolvedPartial = {
        ...partial,
        barWidth: Math.max(
          FUEL_BAR_WIDTH_MIN,
          Math.min(FUEL_BAR_WIDTH_MAX, partial.barWidth)
        ),
      };
    }

    const prevSettings = { ...widget.userSettings };

    Object.assign(widget.userSettings, resolvedPartial);

    applyLayoutResize(id, widget, prevSettings, widget.userSettings);

    this.changeToken++;
  }

  /** Hydration: merge the saved catalog over the shipped defaults. */
  setWidgets(widgets: WidgetDefaultConfig[]) {
    runInAction(() => {
      DEFAULT_WIDGETS.forEach((defaultWidget) => {
        const saved = widgets.find((widget) => widget.id === defaultWidget.id);

        const mergedUserSettings = saved
          ? mergeWithDefaults(
              defaultWidget.userSettings,
              saved.userSettings ?? {}
            )
          : { ...defaultWidget.userSettings };

        const existing = this.widgets.get(defaultWidget.id);

        if (existing) {
          Object.assign(existing.userSettings, mergedUserSettings);

          if (saved) {
            const merged = mergeWithDefaults(defaultWidget, saved);
            existing.designWidth = merged.designWidth;
            existing.designHeight = merged.designHeight;
          }
        } else {
          this.widgets.set(defaultWidget.id, {
            ...defaultWidget,
            userSettings: mergedUserSettings,
          });
        }
      });

      this.changeToken++;
    });
  }

  /** Detached copy — the seed a freshly created layout starts from. */
  snapshot(): WidgetDefaultConfig[] {
    return Array.from(this.widgets.values()).map((widget) => ({
      ...widget,
      userSettings: { ...widget.userSettings },
    }));
  }
}
