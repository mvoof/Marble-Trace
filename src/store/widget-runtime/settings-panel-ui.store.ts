import { makeAutoObservable } from 'mobx';

/**
 * Which groups the user opened or folded in the widget settings panels.
 *
 * Groups start folded by default: a panel opens as a short list of group
 * headers, so the whole of a long one (Standings runs to ~30 rows) is visible
 * at once and the 280px editor drawer stops being a scrolling exercise. A group
 * may start open instead (`defaultOpen`); what is kept is only where the user
 * departed from that start.
 *
 * Session-only on purpose — this is where you were looking, not a preference
 * worth carrying into settings.json.
 */
export class SettingsPanelUiStore {
  private toggled = new Map<string, boolean>();

  constructor() {
    makeAutoObservable(this, {}, { autoBind: true });
  }

  // The same panel renders in the layout-editor drawer, the F9 popup and the
  // widgets catalog, so the key is per widget and group rather than per surface.
  private key(widgetId: string, groupId: string) {
    return `${widgetId}:${groupId}`;
  }

  isExpanded(widgetId: string, groupId: string, defaultOpen = false): boolean {
    return this.toggled.get(this.key(widgetId, groupId)) ?? defaultOpen;
  }

  toggle(widgetId: string, groupId: string, defaultOpen = false) {
    const key = this.key(widgetId, groupId);

    this.toggled.set(key, !(this.toggled.get(key) ?? defaultOpen));
  }

  /** Puts every group of a widget back where it starts. */
  collapseAll(widgetId: string) {
    for (const key of Array.from(this.toggled.keys())) {
      if (key.startsWith(`${widgetId}:`)) {
        this.toggled.delete(key);
      }
    }
  }
}
