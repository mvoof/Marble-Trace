import { makeAutoObservable } from 'mobx';

const LAYOUT_TOAST_DURATION_MS = 3000;

/**
 * The overlay's "layout switched" toast: the name of the layout that came on
 * screen, for a few seconds.
 */
export class LayoutToastStore {
  /** The layout's name while the toast shows; null once it expires. */
  message: string | null = null;

  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    makeAutoObservable<LayoutToastStore, 'timer'>(
      this,
      { timer: false },
      { autoBind: true }
    );
  }

  show(layoutName: string) {
    this.message = layoutName;

    if (this.timer !== null) {
      clearTimeout(this.timer);
    }

    this.timer = setTimeout(() => this.expire(), LAYOUT_TOAST_DURATION_MS);
  }

  private expire() {
    this.timer = null;
    this.message = null;
  }
}
