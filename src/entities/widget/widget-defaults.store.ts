import { makeAutoObservable, runInAction } from 'mobx';

import {
  checkedSettings,
  DEFAULT_WIDGETS,
} from '@entities/widget/widget-catalog';
import { mergeWithDefaults } from '@shared/lib/deep-merge';
import {
  applyLayoutResize,
  deriveWidgetDesignWidth,
} from '@entities/widget/layout-resize';
import { availableWidgetIdsOf } from '@entities/widget/widget-availability';
import type { WidgetMap } from '@entities/widget/widget-map';
import type {
  BaseUserSettings,
  WidgetDefaultConfig,
  WidgetUserSettings,
} from '@shared/contracts/widget-settings';
import type { CapabilitiesPayload } from '@shared/contracts/bindings';

/** The sim's capabilities, which decide the widgets a sim can show. */
interface WidgetDefaultsDeps {
  sim: { readonly capabilities: CapabilitiesPayload | null };
}

/**
 * The global widget catalog — the template edited on the Widgets page, before a
 * widget is ever placed in a layout.
 *
 * Deliberately independent of the live working copy in `LiveWidgetsStore`:
 * editing a template never touches what the overlay is currently drawing, and
 * nothing here reaches the backend. A new layout copies these as its starting
 * widgets.
 */
export class WidgetDefaultsStore implements WidgetMap {
  widgets = new Map<string, WidgetDefaultConfig>(
    DEFAULT_WIDGETS.map((widgetConfig) => [
      widgetConfig.id,
      { ...widgetConfig, userSettings: { ...widgetConfig.userSettings } },
    ])
  );

  // Bumped on every mutation so the catalog preview can react without coupling
  // to the live layout's changeToken.
  changeToken = 0;

  constructor(private readonly root?: WidgetDefaultsDeps) {
    makeAutoObservable<WidgetDefaultsStore, 'root'>(
      this,
      { root: false },
      { autoBind: true }
    );
  }

  /**
   * The catalog as the Widgets page lists it: one entry per widget the app
   * ships, never the active layout's copies.
   */
  get catalogWidgets(): WidgetDefaultConfig[] {
    void this.changeToken;

    return Array.from(this.widgets.values());
  }

  get availableWidgetIds(): string[] {
    return availableWidgetIdsOf(
      this.widgets.values(),
      this.root?.sim?.capabilities
    );
  }

  getWidget(id: string): WidgetDefaultConfig | undefined {
    void this.changeToken;
    return this.widgets.get(id);
  }

  getSettings<SpecificSettings extends object = Record<string, unknown>>(
    id: string
  ): BaseUserSettings & SpecificSettings {
    void this.changeToken;
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

    const resolvedPartial = checkedSettings(widget.type, partial);

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

          existing.designWidth = deriveWidgetDesignWidth(
            defaultWidget.id,
            existing.userSettings,
            existing.designWidth
          );
        } else {
          const installed = {
            ...defaultWidget,
            userSettings: mergedUserSettings,
          };

          installed.designWidth = deriveWidgetDesignWidth(
            defaultWidget.id,
            installed.userSettings,
            installed.designWidth
          );

          this.widgets.set(defaultWidget.id, installed);
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
