import { makeAutoObservable } from 'mobx';

import type { WidgetDefaultConfig } from '@/types/widget-settings';

// Ten steps is what the editor's toolbar is worth: the actions that push a
// snapshot are coarse (a drag, a slider release), so a deeper stack costs
// memory for edits nobody walks back to.
const MAX_UNDO_DEPTH = 10;

/**
 * Undo/redo for the live widget map.
 *
 * Holds snapshots and nothing else — it never touches the store, and the store
 * never reaches into the stacks. Restoring a snapshot is the caller's job,
 * because that is where `commitActiveLayout` and the mutation bump belong.
 */
export class WidgetHistory {
  private undoStack: WidgetDefaultConfig[][] = [];
  private redoStack: WidgetDefaultConfig[][] = [];

  constructor() {
    makeAutoObservable(this, {}, { autoBind: true });
  }

  get canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  get canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  /**
   * Records a step. Identical consecutive snapshots are dropped: the editor
   * calls this on focus and on drag start, and both fire without an edit in
   * between often enough that the stack would fill with no-ops.
   */
  push(snapshot: WidgetDefaultConfig[]) {
    const last = this.undoStack[this.undoStack.length - 1];

    if (last && JSON.stringify(last) === JSON.stringify(snapshot)) {
      return;
    }

    this.undoStack.push(snapshot);

    if (this.undoStack.length > MAX_UNDO_DEPTH) {
      this.undoStack.shift();
    }

    this.redoStack = [];
  }

  /** The state to restore, with `current` filed away for redo. Null when empty. */
  undo(current: WidgetDefaultConfig[]): WidgetDefaultConfig[] | null {
    const previous = this.undoStack.pop();

    if (previous === undefined) {
      return null;
    }

    this.redoStack.push(current);

    return previous;
  }

  redo(current: WidgetDefaultConfig[]): WidgetDefaultConfig[] | null {
    const next = this.redoStack.pop();

    if (next === undefined) {
      return null;
    }

    this.undoStack.push(current);

    return next;
  }
}
