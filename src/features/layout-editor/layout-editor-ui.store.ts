import { makeAutoObservable, reaction } from 'mobx';

import type { LayoutsStore } from '@entities/layout/layouts.store';

/**
 * What the layout editor shows, as opposed to the layout it edits: the
 * selected widget, the screen in focus, the preview scenario, the drawers and
 * the pinned ratios. A store rather than component state, so it survives the
 * editor being remounted and the canvas, the panel and the inspector read the
 * same values without passing them down.
 */
export class LayoutEditorUiStore {
  selectedWidgetId: string | null = null;
  /** The preview scenario the canvas draws its widgets against. */
  scenarioId: string;
  /**
   * Which screen fills the canvas. Null shows every monitor of the layout at
   * once — needed to drag widgets between screens, useless for fine work.
   */
  focusedMonitorName: string | null = null;
  isFullscreen = false;
  /** The widget list's drawer, in fullscreen. */
  isPanelOpen = false;
  /** The inspector's drawer, in fullscreen. */
  isInspectorOpen = false;
  isUploadingBackground = false;
  /** Widgets whose resize keeps their shape, by id. */
  private lockedRatios = new Set<string>();

  private readonly stopFollowingLayout: () => void;

  constructor(layouts: LayoutsStore, defaultScenarioId: string) {
    this.scenarioId = defaultScenarioId;

    makeAutoObservable<LayoutEditorUiStore, 'stopFollowingLayout'>(
      this,
      { stopFollowingLayout: false },
      { autoBind: true }
    );

    // A selection belongs to the layout it was made in.
    this.stopFollowingLayout = reaction(
      () => layouts.editingLayoutId,
      () => this.selectWidget(null)
    );
  }

  dispose() {
    this.stopFollowingLayout();
  }

  selectWidget(id: string | null) {
    this.selectedWidgetId = id === '' ? null : id;
  }

  setScenario(id: string) {
    this.scenarioId = id;
  }

  focusMonitor(name: string | null) {
    this.focusedMonitorName = name;
  }

  /** Leaving fullscreen closes the drawers that only it has. */
  setFullscreen(isFullscreen: boolean) {
    this.isFullscreen = isFullscreen;

    if (!isFullscreen) {
      this.isPanelOpen = false;
    }
  }

  setPanelOpen(isOpen: boolean) {
    this.isPanelOpen = isOpen;
  }

  setInspectorOpen(isOpen: boolean) {
    this.isInspectorOpen = isOpen;
  }

  setUploadingBackground(isUploading: boolean) {
    this.isUploadingBackground = isUploading;
  }

  isRatioLocked(widgetId: string | null): boolean {
    return widgetId !== null && this.lockedRatios.has(widgetId);
  }

  toggleRatioLock(widgetId: string) {
    if (this.lockedRatios.has(widgetId)) {
      this.lockedRatios.delete(widgetId);
    } else {
      this.lockedRatios.add(widgetId);
    }
  }

  /** Whether the selected widget's resize keeps its shape. */
  get isSelectedRatioLocked(): boolean {
    return this.isRatioLocked(this.selectedWidgetId);
  }
}
