import { makeAutoObservable, reaction } from 'mobx';

import {
  deleteBackgroundImage,
  saveBackgroundImage,
} from '@entities/layout/layout-background';
import type { LayoutsStore } from '@entities/layout/layouts.store';

const DEFAULT_IMAGE_EXTENSION = 'png';

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
  isFullscreen = false;
  /** The widget list's drawer, in fullscreen. */
  isPanelOpen = false;
  /** The inspector's drawer, in fullscreen. */
  isInspectorOpen = false;
  isUploadingBackground = false;
  /** Widgets whose resize keeps their shape, by id. */
  private lockedRatios = new Set<string>();

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
