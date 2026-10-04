import type { WidgetInstanceContext } from '@store/widgets/widget-instances';
import type { CoachPreviewTarget } from '@store/preview/coach-advisory-seed';
import { useWidgetInstanceStore } from '@ui/widgets/WidgetInstanceScope/widget-instance-context';
import { CoachWidgetStore } from './coach.widget';
import { DrivingCoachWidgetStore } from './driving-coach.widget';

/**
 * One coach instance's stores: the call (`advisory`) and the speed trace
 * (`trace`). Two classes because they share no state — the trace never decides
 * the call — but one lifetime, so the mount builds and disposes them together.
 */
export class CoachWidgetStores implements CoachPreviewTarget {
  readonly advisory: DrivingCoachWidgetStore;
  readonly trace: CoachWidgetStore;

  constructor(context: WidgetInstanceContext) {
    this.advisory = new DrivingCoachWidgetStore(context);
    this.trace = new CoachWidgetStore(context);
  }

  dispose() {
    this.advisory.dispose();
    this.trace.dispose();
  }
}

export const useDrivingCoachWidgetStore = () =>
  useWidgetInstanceStore<CoachWidgetStores>().advisory;

export const useCoachWidgetStore = () =>
  useWidgetInstanceStore<CoachWidgetStores>().trace;
