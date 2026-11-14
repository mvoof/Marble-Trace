import { makeAutoObservable, reaction } from 'mobx';

import {
  deleteBackgroundImage,
  saveBackgroundImage,
} from '@entities/layout/layout-background';
import type { LayoutsStore } from '@entities/layout/layouts.store';

const DEFAULT_IMAGE_EXTENSION = 'png';

const widgetListKeyOf = (monitorName: string, type: string): string =>
  JSON.stringify([monitorName, type]);

/**
 * The editor's three views: every screen at once on the page, one screen
 * filling the app window, or one filling the real monitor.
 */
export type EditorViewMode = 'overview' | 'fullSize' | 'fullscreen';

/** What the editor's view reads and writes of the layout records. */
export type LayoutEditorUiLayouts = Pick<
  LayoutsStore,
  'editingLayoutId' | 'editingLayout' | 'setMonitorBackground'
>;

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
  /**
   * How the editor is laid out. Outside fullscreen it follows the focus: no
   * screen in focus is the overview, one is full size. Fullscreen shows
   * whatever is in focus, every screen included, as it always has.
   */
  viewMode: EditorViewMode = 'overview';
  /** The widget list's drawer, when the canvas fills the view. */
  isPanelOpen = false;
  /** The inspector's drawer, when the canvas fills the view. */
  isInspectorOpen = false;
  isUploadingBackground = false;
  /**
   * Whether the monitor arrangement is drawn above the canvas. Hidden, the
   * canvas takes its height. Kept while the app runs, never in the settings
   * file.
   */
  isArrangementShown = true;
  /** Widgets whose resize keeps their shape, by id. */
  private lockedRatios = new Set<string>();
  /**
   * Widgets hidden from the widget list itself, by monitor and type: the
   * list goes on showing them so their eye can bring them back. Forgotten
   * when the editor closes or another layout opens.
   */
  private widgetListKeeps = new Set<string>();

  private readonly stopFollowingLayout: () => void;

  constructor(
    private readonly layouts: LayoutEditorUiLayouts,
    defaultScenarioId: string
  ) {
    this.scenarioId = defaultScenarioId;

    makeAutoObservable<LayoutEditorUiStore, 'stopFollowingLayout' | 'layouts'>(
      this,
      { stopFollowingLayout: false, layouts: false },
      { autoBind: true }
    );

    // A selection belongs to the layout it was made in.
    this.stopFollowingLayout = reaction(
      () => layouts.editingLayoutId,
      () => {
        this.selectWidget(null);
        this.forgetWidgetListKeeps();
      }
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

  /** Outside fullscreen, picking a screen goes full size on it. */
  focusMonitor(name: string | null) {
    this.focusedMonitorName = name;

    if (this.viewMode !== 'fullscreen') {
      this.setViewMode(this.viewModeForFocus);
    }
  }

  showOverview() {
    this.focusMonitor(null);
  }

  /** Full size on the screen in focus, or on the first one if none is. */
  showFullSize() {
    const monitorName =
      this.focusedMonitorName ?? this.layouts.editingLayout?.monitors[0]?.name;

    if (monitorName) {
      this.focusedMonitorName = monitorName;
      this.setViewMode('fullSize');
    }
  }

  /**
   * Follows the document's fullscreen state, which the browser owns: Escape
   * leaves it without asking. Leaving lands on whatever the focus calls for.
   */
  setFullscreen(isFullscreen: boolean) {
    if (isFullscreen) {
      this.setViewMode('fullscreen');
    } else {
      this.setViewMode(this.viewModeForFocus);
    }
  }

  get isFullscreen(): boolean {
    return this.viewMode === 'fullscreen';
  }

  get isFullSize(): boolean {
    return this.viewMode === 'fullSize';
  }

  /**
   * Whether the canvas fills the view — full size or fullscreen — with the
   * toolbar floating over it and the side panels as drawers.
   */
  get isCanvasOnly(): boolean {
    return this.viewMode !== 'overview';
  }

  /** What the focus calls for outside fullscreen. */
  private get viewModeForFocus(): EditorViewMode {
    return this.focusedMonitorName === null ? 'overview' : 'fullSize';
  }

  /** The overview docks the panels; the widget drawer is not left open. */
  private setViewMode(viewMode: EditorViewMode) {
    this.viewMode = viewMode;

    if (viewMode === 'overview') {
      this.isPanelOpen = false;
    }
  }

  setPanelOpen(isOpen: boolean) {
    this.isPanelOpen = isOpen;
  }

  setInspectorOpen(isOpen: boolean) {
    this.isInspectorOpen = isOpen;
  }

  setArrangementShown(isShown: boolean) {
    this.isArrangementShown = isShown;
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

  keepInWidgetList(monitorName: string, type: string) {
    this.widgetListKeeps.add(widgetListKeyOf(monitorName, type));
  }

  /** A widget taken off the monitor: its row goes, hidden or not. */
  forgetInWidgetList(monitorName: string, type: string) {
    this.widgetListKeeps.delete(widgetListKeyOf(monitorName, type));
  }

  isKeptInWidgetList(monitorName: string, type: string): boolean {
    return this.widgetListKeeps.has(widgetListKeyOf(monitorName, type));
  }

  forgetWidgetListKeeps() {
    this.widgetListKeeps.clear();
  }

  /** Whether the selected widget's resize keeps its shape. */
  get isSelectedRatioLocked(): boolean {
    return this.isRatioLocked(this.selectedWidgetId);
  }

  /** The screens a widget can be sent to: every one but the screen in focus. */
  get unfocusedMonitorNames(): string[] {
    return (this.layouts.editingLayout?.monitors ?? [])
      .map((monitor) => monitor.name)
      .filter((name) => name !== this.focusedMonitorName);
  }

  /**
   * The screen a background picture goes to. Pictures belong to a screen, so
   * it is the one in focus — in the overview, the first.
   */
  get backgroundMonitorName(): string | undefined {
    return (
      this.focusedMonitorName ?? this.layouts.editingLayout?.monitors[0]?.name
    );
  }

  /** The picture that screen carries now, if any. */
  get currentBackground(): string | undefined {
    const monitorName = this.backgroundMonitorName;

    return monitorName
      ? this.layouts.editingLayout?.backgroundImages?.[monitorName]
      : undefined;
  }

  /**
   * Saves the picked picture and hands it to the screen, deleting the file it
   * replaces. No file — the picker was dismissed — only ends the upload.
   */
  async setBackgroundFromFile(file: File | undefined) {
    const layoutId = this.layouts.editingLayoutId;
    const monitorName = this.backgroundMonitorName;
    const previous = this.currentBackground;

    if (!file || !layoutId) {
      this.setUploadingBackground(false);

      return;
    }

    try {
      const extension = (
        file.name.split('.').pop() ?? DEFAULT_IMAGE_EXTENSION
      ).toLowerCase();
      const bytes = new Uint8Array(await file.arrayBuffer());
      const fileName = await saveBackgroundImage(layoutId, bytes, extension);

      if (previous && previous !== fileName) {
        void deleteBackgroundImage(previous);
      }

      if (monitorName) {
        this.layouts.setMonitorBackground(monitorName, fileName);
      }
    } catch (error) {
      console.error('Failed to save background image:', error);
    } finally {
      this.setUploadingBackground(false);
    }
  }

  clearBackground() {
    const monitorName = this.backgroundMonitorName;

    if (!monitorName) {
      return;
    }

    void deleteBackgroundImage(this.currentBackground);
    this.layouts.setMonitorBackground(monitorName, undefined);
  }
}
