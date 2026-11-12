import { useEffect } from 'react';

import { useAppSettingsStore } from '@entities/app-settings/app-settings-context';
import { useMainLiveWidgetsStore } from '@entities/layout/main-live-widgets-context';
import { nudgedPosition } from '@features/layout-editor/keyboard-nudge';
import { useLayoutEditorUiStore } from '@features/layout-editor/layout-editor-ui-context';

const isTypingInto = (element: Element | null): boolean => {
  if (!element) {
    return false;
  }

  const tagName = element.tagName.toLowerCase();

  return (
    tagName === 'input' ||
    tagName === 'textarea' ||
    element.getAttribute('contenteditable') === 'true'
  );
};

/**
 * The editor's keys, on the whole document while the canvas is up: undo and
 * redo, and for the selected widget the arrows, Delete and Escape.
 */
export const useCanvasKeyboard = () => {
  const liveWidgets = useMainLiveWidgetsStore();
  const appSettings = useAppSettingsStore();
  const editorUi = useLayoutEditorUiStore();
  const selectedWidgetId = editorUi.selectedWidgetId;
  const snapToGrid = appSettings.appSettings.editorSnapToGrid;
  const gridSize = appSettings.appSettings.editorGridSize;

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isTypingInto(document.activeElement)) {
        return;
      }

      const isModified = event.ctrlKey || event.metaKey;
      const key = event.key.toLowerCase();

      if (isModified && !event.shiftKey && key === 'z') {
        event.preventDefault();
        liveWidgets.undo();

        return;
      }

      if (isModified && (key === 'y' || (event.shiftKey && key === 'z'))) {
        event.preventDefault();
        liveWidgets.redo();

        return;
      }

      const widget = selectedWidgetId
        ? liveWidgets.getWidget(selectedWidgetId)
        : undefined;

      if (!selectedWidgetId || !widget) {
        return;
      }

      if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault();
        liveWidgets.setWidgetEnabled(selectedWidgetId, false);
        editorUi.selectWidget(null);

        return;
      }

      if (event.key === 'Escape') {
        event.preventDefault();
        editorUi.selectWidget(null);

        return;
      }

      const current = { x: widget.userSettings.x, y: widget.userSettings.y };
      const next = nudgedPosition(current, event.key, event.shiftKey, {
        snap: snapToGrid,
        size: gridSize,
      });

      if (!next) {
        return;
      }

      event.preventDefault();

      if (next.x !== current.x || next.y !== current.y) {
        liveWidgets.pushUndo();
        liveWidgets.updatePosition(selectedWidgetId, next.x, next.y);
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [selectedWidgetId, liveWidgets, editorUi, snapToGrid, gridSize]);
};
