import { makeAutoObservable } from 'mobx';

/**
 * Which groups the user opened in the widget settings panels.
 *
 * Groups start folded: a panel opens as a short list of group headers, so the
 * whole of a long one (Standings runs to ~30 rows) is visible at once and the
 * 280px editor drawer stops being a scrolling exercise.
 *
 * Session-only on purpose — this is where you were looking, not a preference
 * worth carrying into settings.json.
 */
export class SettingsPanelUiStore {
  private expanded = new Set<string>();

  constructor() {
    makeAutoObservable(this, {}, { autoBind: true });
  }

  // The same panel renders in the layout-editor drawer, the F9 popup and the
  // widgets catalog, so the key is per widget and group rather than per surface.
  private key(widgetId: string, groupId: string) {
    return `${widgetId}:${groupId}`;
  }

  isExpanded(widgetId: string, groupId: string): boolean {
    return this.expanded.has(this.key(widgetId, groupId));
  }

  toggle(widgetId: string, groupId: string) {
    const key = this.key(widgetId, groupId);

    if (this.expanded.has(key)) {
      this.expanded.delete(key);
    } else {
      this.expanded.add(key);
    }
  }

  collapseAll(widgetId: string) {
    for (const key of Array.from(this.expanded)) {
      if (key.startsWith(`${widgetId}:`)) {
        this.expanded.delete(key);
      }
    }
  }
}
