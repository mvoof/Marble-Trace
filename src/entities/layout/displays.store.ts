import { makeAutoObservable } from 'mobx';

import {
  listMonitorDetails,
  type MonitorDetails,
} from '@shared/api/overlay-resolution';
import { emitMonitorIdentify } from '@shared/api/events.service';
import type {
  LayoutMonitor,
  LayoutResolution,
  MonitorBounds,
} from '@shared/contracts/widget-settings';

import type { LiveWidgetsStore } from './live-widgets.store';
import { MONITOR_IDENTIFY_DURATION_MS } from './monitor-identify.store';
import { numberMonitors } from './monitor-numbers';

/** An attached monitor as the editor's map labels it. */
export interface PhysicalDisplay {
  name: string;
  number: number;
  /** The EDID model, or null when the monitor reports none. */
  model: string | null;
  isPrimary: boolean;
  /** Physical pixels once the details are read; the logical size until then. */
  resolution: LayoutResolution;
  bounds: MonitorBounds;
}

/**
 * Main's view of the physical monitors: their numbers, models and which is
 * primary, beside the bounds `LiveWidgetsStore` already tracks. Identify
 * flashes each number on its own monitor and on the editor's map at once.
 */
export class DisplaysStore {
  private details: MonitorDetails[] = [];
  /** True while the numbers flash. */
  isIdentifying = false;

  private identifyTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly liveWidgets: Pick<LiveWidgetsStore, 'attachedMonitors'>
  ) {
    makeAutoObservable<DisplaysStore, 'liveWidgets' | 'identifyTimer'>(
      this,
      { liveWidgets: false, identifyTimer: false },
      { autoBind: true }
    );
  }

  /** Read again on every arrangement change: a swapped cable moves models. */
  async refresh() {
    try {
      const details = await listMonitorDetails();

      this.setDetails(details);
    } catch (error) {
      console.error('[displays] failed to read the monitor models:', error);
    }
  }

  setDetails(details: MonitorDetails[]) {
    this.details = details;
  }

  /** Every attached monitor, in number order. */
  get displays(): PhysicalDisplay[] {
    const attached: LayoutMonitor[] = this.liveWidgets.attachedMonitors;
    const detailsByName = new Map(
      this.details.map((detail) => [detail.name, detail])
    );
    const primaryName =
      this.details.find((detail) => detail.isPrimary)?.name ?? null;
    const numbers = numberMonitors(attached, primaryName);

    return attached
      .map((monitor) => {
        const details = detailsByName.get(monitor.name);

        return {
          name: monitor.name,
          number: numbers.get(monitor.name) ?? 0,
          model: details?.model ?? null,
          isPrimary: monitor.name === primaryName,
          resolution: details?.resolution ?? {
            width: monitor.bounds.width,
            height: monitor.bounds.height,
          },
          bounds: monitor.bounds,
        };
      })
      .sort((first, second) => first.number - second.number);
  }

  identify() {
    const numbers = new Map(
      this.displays.map((display) => [display.name, display.number])
    );

    void emitMonitorIdentify(numbers).catch((error: unknown) =>
      console.error('[displays] identify failed:', error)
    );

    this.isIdentifying = true;

    if (this.identifyTimer !== null) {
      clearTimeout(this.identifyTimer);
    }

    this.identifyTimer = setTimeout(
      () => this.endIdentify(),
      MONITOR_IDENTIFY_DURATION_MS
    );
  }

  private endIdentify() {
    this.identifyTimer = null;
    this.isIdentifying = false;
  }

  dispose() {
    if (this.identifyTimer !== null) {
      clearTimeout(this.identifyTimer);
    }
  }
}
