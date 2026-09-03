import { makeAutoObservable } from 'mobx';

import type {
  MonitorBounds,
  WidgetDefaultConfig,
} from '@/types/widget-settings';
import type {
  RemoteConnectionState,
  RemoteScreenSnapshot,
} from '@/types/remote';
import { DEFAULT_REMOTE_BACKGROUND, fitScale } from '@utils/remote-screen';

/**
 * State of the browser tab a remote screen runs in: which screen it is, whether
 * the socket is up, and how the layout has to be scaled to fit the device.
 *
 * Only ever instantiated in the remote entry point — the overlay windows and
 * the main window never construct one.
 */
export class RemoteScreenStore {
  slug = '';
  connection: RemoteConnectionState = 'connecting';
  snapshot: RemoteScreenSnapshot | null = null;

  /** Live browser viewport, which is not the device screen: the address bar
   * takes a slice of it and gives it back when the user scrolls. */
  viewportWidth = 0;
  viewportHeight = 0;

  constructor(slug: string) {
    this.slug = slug;

    makeAutoObservable(this, {}, { autoBind: true });
  }

  /** What the page paints behind the widgets, as the screen was set up. */
  get background(): string {
    return this.snapshot?.background ?? DEFAULT_REMOTE_BACKGROUND;
  }

  /**
   * Painted for an encoder rather than for a person: nothing behind the
   * widgets, and so nowhere to put a status card either — one mid-reconnect is
   * worse on a broadcast than nothing at all.
   */
  get isTransparent(): boolean {
    return this.background === 'transparent';
  }

  setConnection(state: RemoteConnectionState) {
    this.connection = state;
  }

  setSnapshot(snapshot: RemoteScreenSnapshot) {
    this.snapshot = snapshot;
  }

  setViewport(width: number, height: number) {
    this.viewportWidth = width;
    this.viewportHeight = height;
  }

  get bounds(): MonitorBounds | null {
    return this.snapshot?.bounds ?? null;
  }

  /** True once there is something to draw — a socket that is up but has not
   * delivered a snapshot yet still shows the waiting screen. */
  get isReady(): boolean {
    return this.snapshot !== null;
  }

  get enabledWidgets(): WidgetDefaultConfig[] {
    return (this.snapshot?.widgets ?? []).filter(
      (widget) => widget.userSettings.enabled
    );
  }

  /**
   * Scale that fits the screen the layout was drawn for into this viewport.
   * Uniform, so the layout keeps its proportions and lands where the editor
   * showed it.
   */
  get scale(): number {
    const { bounds } = this;

    if (!bounds || this.viewportWidth === 0 || this.viewportHeight === 0) {
      return 1;
    }

    return fitScale(bounds, this.viewportWidth, this.viewportHeight);
  }
}
