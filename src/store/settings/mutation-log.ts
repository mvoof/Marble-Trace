import { makeAutoObservable } from 'mobx';

/**
 * What changed in the settings since anyone last looked.
 *
 * Every settings write has to leave two marks besides the write itself, and
 * both are why an edit reaches disk at all:
 *
 * - a **token** moves, which is what the save and emit reactions watch. Local
 *   edits and edits arriving from the other window move different ones —
 *   echoing a synced edit back is a loop, so `recordSynced` exists precisely to
 *   be the write that does *not* trigger the emit.
 * - the **widgets touched** are collected, so the overlay can be sent a patch
 *   of what moved instead of the whole layout. A write that installs a map
 *   wholesale — a layout load, an undo, any change to the monitors the widgets
 *   stand on — can only be described by the full list, and says so with
 *   `recordEveryWidget`.
 *
 * The log holds ids, never widgets: only the store that owns the live map can
 * turn an id into a record, and keeping that out of here is what lets a layout
 * write mark itself without knowing a thing about widgets.
 */
export class SettingsMutationLog {
  /** Moved by every local edit. Watched by the save and emit reactions. */
  changeToken = 0;

  /**
   * Moved by edits that arrived from the other window (an overlay drag in F9
   * mode). Kept apart from `changeToken` so those edits are saved without being
   * emitted straight back to the window that sent them.
   */
  syncToken = 0;

  private touchedWidgetIds = new Set<string>();

  private touchedEveryWidget = false;

  constructor() {
    makeAutoObservable(this, {}, { autoBind: true });
  }

  /** One widget was edited in place. */
  recordWidget(widgetId: string) {
    this.touchedWidgetIds.add(widgetId);
    this.changeToken++;
  }

  /** The map was installed wholesale — only a full list describes it. */
  recordEveryWidget() {
    this.touchedEveryWidget = true;
    this.changeToken++;
  }

  /** An edit from the other window: save it, do not send it back. */
  recordSynced() {
    this.syncToken++;
  }

  /** Takes what has been marked since the last call and forgets it. */
  drain(): { everyWidget: boolean; widgetIds: string[] } {
    const everyWidget = this.touchedEveryWidget;
    const widgetIds = [...this.touchedWidgetIds];

    this.touchedEveryWidget = false;
    this.touchedWidgetIds = new Set<string>();

    return { everyWidget, widgetIds };
  }
}
