import type { SavedLayout } from '@shared/contracts/widget-settings';
import { isRemoteMonitor } from '@shared/lib/remote-screen';

export interface NowSummary {
  layoutName: string | null;
  /** The PC's own displays the layout covers. */
  monitors: number;
  widgetsOn: number;
  browserScreens: number;
}

/** What the layout on screen puts where, for Home's now column. */
export const nowSummary = (layout: SavedLayout | undefined): NowSummary => {
  const monitors = layout?.monitors ?? [];
  const browserScreens = monitors.filter(isRemoteMonitor).length;

  return {
    layoutName: layout?.name ?? null,
    monitors: monitors.length - browserScreens,
    widgetsOn: (layout?.widgets ?? []).filter(
      (widget) => widget.userSettings.enabled
    ).length,
    browserScreens,
  };
};
