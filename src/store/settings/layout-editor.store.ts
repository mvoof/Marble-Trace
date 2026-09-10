import { makeAutoObservable } from 'mobx';

import type { LayoutsStore } from '@store/settings/layouts.store';
import type { SettingsMutationLog } from '@store/settings/mutation-log';
import type { WidgetDefaultConfig } from '@/types/widget-settings';

/**
 * What the editing session needs from the live widget map — the two gestures
 * that put widgets on screen. Declared here rather than taken as the whole
 * store so the dependency says what it is used for.
 */
export interface EditorWidgetMap {
  loadLayout(id: string, options?: { notify?: boolean }): void;
  setWidgets(widgets: WidgetDefaultConfig[]): void;
}

/**
 * The editing session: what exists only while the layout editor is on screen.
 *
 * Everything here is main-window state with no meaning once the editor closes,
 * which is exactly why it is not part of the layout records. The records answer
 * "which layout is the application looking at" whether or not an editor exists;
 * this store answers "the editor is open, and it is holding the live layout
 * still".
 */
export class LayoutEditorStore {
  /**
   * True while the layout editor is on screen, whatever layout it edits.
   *
   * It is what pins the live layout: for as long as the editor is open the
   * layout on the overlay and the layout under the cursor are two separate
   * values, and the session auto-switch moves the first one only. Nothing
   * stands down — an overlay that stopped following the session because a
   * window nobody is looking at happens to be open is exactly the confusion
   * this replaced.
   */
  open = false;

  /**
   * The layout the overlay is rendering, when that is not the one being edited.
   *
   * Null whenever the two are the same, which is every moment the layout editor
   * is closed. While it is open the two part company on purpose: the editor
   * keeps whatever layout the user opened, and the session auto-switch moves
   * this one instead, so the screen the driver races on always matches the
   * session even mid-edit.
   */
  pinnedLiveLayoutId: string | null = null;

  /**
   * The live map is reached through a getter, not a constructor argument: it
   * depends on this store in turn, and deferring the lookup is what lets the
   * root compose the two without either one being half-built.
   */
  constructor(
    private readonly mutations: SettingsMutationLog,
    private readonly layoutRecords: LayoutsStore,
    private readonly liveWidgets: () => EditorWidgetMap
  ) {
    makeAutoObservable<
      LayoutEditorStore,
      'mutations' | 'layoutRecords' | 'liveWidgets'
    >(
      this,
      { mutations: false, layoutRecords: false, liveWidgets: false },
      { autoBind: true }
    );
  }

  /** The editor is showing a layout that is not the one on the overlay. */
  get previewMode(): boolean {
    return (
      this.pinnedLiveLayoutId !== null &&
      this.pinnedLiveLayoutId !== this.layoutRecords.editingLayoutId
    );
  }

  setPinnedLiveLayoutId(id: string | null) {
    this.pinnedLiveLayoutId = id;
    this.mutations.recordEveryWidget();
  }

  /**
   * Opening the editor pins what the overlay is showing; closing it hands that
   * back as the layout being edited.
   *
   * Between the two the editor may open any layout it likes and the session may
   * switch the screen underneath, each without disturbing the other. Closing
   * takes the overlay's answer, not the editor's: the driver's screen is the
   * one that was live, and the editor is gone.
   */
  setOpen(open: boolean) {
    if (open === this.open) return;

    this.open = open;

    if (open) {
      this.setPinnedLiveLayoutId(this.layoutRecords.editingLayoutId);

      return;
    }

    const liveId = this.pinnedLiveLayoutId;

    this.setPinnedLiveLayoutId(null);

    if (liveId && liveId !== this.layoutRecords.editingLayoutId) {
      this.liveWidgets().loadLayout(liveId);
    }
  }

  // Load a layout into the editor without pushing it to the overlay, which
  // keeps showing the live one. activateLayout() puts it on screen.
  switchLayout(id: string) {
    const layout = this.layoutRecords.byId(id);

    if (!layout) return;

    // Pins the screen itself rather than trusting the editor to have done it:
    // the layout being left is what stays on the overlay, and it is only
    // knowable before the switch.
    if (this.pinnedLiveLayoutId === null) {
      this.setPinnedLiveLayoutId(this.layoutRecords.editingLayoutId);
    }

    this.layoutRecords.setEditingLayoutId(id);

    this.liveWidgets().setWidgets(layout.widgets);

    this.mutations.recordEveryWidget();
  }

  // Make the layout currently shown in the editor the one on the overlay.
  activateLayout() {
    this.setPinnedLiveLayoutId(this.layoutRecords.editingLayoutId);
    this.mutations.recordEveryWidget();
  }
}
