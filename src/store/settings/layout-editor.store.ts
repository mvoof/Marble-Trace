import { makeAutoObservable } from 'mobx';

import { emitLayoutActivated } from '@platform/services/events.service';

import type { LayoutsStore } from '@store/settings/layouts.store';
import type { WidgetDefaultConfig } from '@/types/widget-settings';

/**
 * What the editing session needs from the live widget map — the two gestures
 * that put widgets on screen. Declared here rather than taken as the whole
 * store so the dependency says what it is used for.
 */
export interface EditorWidgetMap {
  loadLayout(id: string): void;
  setWidgets(widgets: WidgetDefaultConfig[]): void;
}

/**
 * The editing session: what exists only while the layout editor is on screen.
 *
 * `open` is the whole of its state. The pin it moves — which layout the
 * overlay renders while the editor holds another — belongs to the records,
 * because it is a pointer into the record set that callers with no editor read
 * too. This store is the last one built, and it depends on the other two
 * rather than either depending on it.
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

  constructor(
    private readonly layoutRecords: LayoutsStore,
    private readonly liveWidgets: EditorWidgetMap
  ) {
    makeAutoObservable<LayoutEditorStore, 'layoutRecords' | 'liveWidgets'>(
      this,
      { layoutRecords: false, liveWidgets: false },
      { autoBind: true }
    );
  }

  /** The editor is showing a layout that is not the one on the overlay. */
  get previewMode(): boolean {
    return (
      this.layoutRecords.pinnedLiveLayoutId !== null &&
      this.layoutRecords.pinnedLiveLayoutId !==
        this.layoutRecords.editingLayoutId
    );
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
      this.layoutRecords.setPinnedLiveLayoutId(
        this.layoutRecords.editingLayoutId
      );

      return;
    }

    const liveId = this.layoutRecords.pinnedLiveLayoutId;

    this.layoutRecords.setPinnedLiveLayoutId(null);

    if (liveId && liveId !== this.layoutRecords.editingLayoutId) {
      this.liveWidgets.loadLayout(liveId);
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
    if (this.layoutRecords.pinnedLiveLayoutId === null) {
      this.layoutRecords.setPinnedLiveLayoutId(
        this.layoutRecords.editingLayoutId
      );
    }

    this.layoutRecords.setEditingLayoutId(id);
    this.liveWidgets.setWidgets(layout.widgets);
  }

  // Make the layout currently shown in the editor the one on the overlay.
  activateLayout() {
    this.layoutRecords.setPinnedLiveLayoutId(
      this.layoutRecords.editingLayoutId
    );
  }

  /**
   * The layout the session asks for, applied wherever it belongs: to the screen
   * while the editor is open, and to both otherwise. Answers false when there
   * was nothing to change.
   *
   * Whichever way it lands, the screen changed and the screen says so — one
   * announcement, made here, rather than one per branch. The editor holding a
   * different layout is exactly when the driver has least reason to expect the
   * switch and most reason to be told.
   */
  applySessionLayout(id: string): boolean {
    const layout = this.layoutRecords.byId(id);

    if (!layout || this.layoutRecords.liveLayoutId === id) return false;

    if (this.open) {
      this.layoutRecords.setPinnedLiveLayoutId(id);
    } else {
      this.liveWidgets.loadLayout(id);
    }

    void emitLayoutActivated(layout.name);

    return true;
  }
}
