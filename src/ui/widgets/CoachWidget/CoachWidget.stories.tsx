import type { Meta, StoryObj } from '@storybook/react-vite';

import type { CoachWidgetSettings } from '@/types/widget-settings';
import type { DrivingAdvisory } from '@utils/driving-coach-utils';
import { mockLapTiming } from '@store/preview/mocks/delta';
import {
  mockReferenceLap,
  PREVIEW_BRAKE_START_PCT,
  PREVIEW_CORNER_CENTER_PCT,
  referenceSpeedKmhAt,
} from '@store/preview/mocks/coach';
import { CoachWidget } from './CoachWidget';
import {
  defineWidgetStories,
  previewScenario,
} from '@/storybook/define-widget-stories';

const BUCKET_COUNT = 1000;
const KMH_PER_MPS = 3.6;

/** Where the car sits when a story does not move it — just past the apex. */
const DEFAULT_DIST_PCT = PREVIEW_CORNER_CENTER_PCT + 0.01;

const STRAIGHT_SPEED_KMH = referenceSpeedKmhAt(0);
const APEX_SPEED_KMH = referenceSpeedKmhAt(PREVIEW_CORNER_CENTER_PCT);

/**
 * This lap's speed at a point on it, in m/s.
 *
 * The corner's shape is the reference's — only the apex moves, by
 * `apexDeltaKmh`, tapering back to the reference's own speed on the straights.
 * A story that redrew the corner instead would be comparing two tracks.
 */
const ownSpeedAt = (pct: number, apexDeltaKmh: number): number => {
  const referenceKmh = referenceSpeedKmhAt(pct);
  const depth =
    (STRAIGHT_SPEED_KMH - referenceKmh) / (STRAIGHT_SPEED_KMH - APEX_SPEED_KMH);

  return (referenceKmh + apexDeltaKmh * depth) / KMH_PER_MPS;
};

/** Pedal down from this lap's braking point until the apex. */
const ownBrakeAt = (pct: number, brakeLatePct: number): number => {
  const brakeStartPct = PREVIEW_BRAKE_START_PCT + brakeLatePct;

  if (pct >= brakeStartPct && pct <= PREVIEW_CORNER_CENTER_PCT) {
    return 1;
  }

  return 0;
};

interface StoryArgs {
  /**
   * The call and the pedal state under it. Applied only when the story names
   * no scenario — one that does takes the coach the scenario put in place
   * rather than writing a second call over it.
   */
  advisory: DrivingAdvisory;
  brakeUrgency: number;
  /** Metres later than the reference this exit's throttle was opened, or null outside an exit. */
  exitLateM: number | null;
  /** Pedal missing against the reference inside a corner exit, 0-1. */
  exitThrottleDeficit: number;
  hasReferenceLap: boolean;
  wetReference: boolean;

  /** How much faster (+) or slower (-) than the reference this lap takes the apex, in km/h. */
  ownApexDeltaKmh: number;
  /** How much later than the reference this lap gets on the brakes, in lap fraction. */
  ownBrakeLatePct: number;
  /** Where the car sits. Left undefined, the base's own position is kept. */
  distPct?: number;

  showTrace: boolean;
  showUrgencyBar: boolean;
  showSpeed: boolean;
  showReferenceLapTime: boolean;
  traceChannel: CoachWidgetSettings['traceChannel'];
}

const meta: Meta<StoryArgs> = {
  title: 'Widgets/CoachWidget',
  ...defineWidgetStories<StoryArgs>({
    widget: CoachWidget,
    size: {
      width: 300,
      background: '#101318',
      widgetBg: 'rgba(21, 22, 26, 0.8)',
      borderRadius: 8,
    },
    seedSnapshot: true,
    seed: (store, args, scenarioId) => {
      store.liveWidgets.updateUserSettings('coach', {
        ...store.liveWidgets.getSettings<CoachWidgetSettings>('coach'),
        showTrace: args.showTrace,
        showUrgencyBar: args.showUrgencyBar,
        showSpeed: args.showSpeed,
        showReferenceLapTime: args.showReferenceLapTime,
        showTrackCondition: true,
        traceChannel: args.traceChannel,
      });

      // A story with no scenario under it states the builder's stored lap and
      // the call that goes with it; one with a scenario leaves both alone — the
      // scenario has already put a reference and a coach in place, and the
      // inactive one in particular is a reference this must not overwrite.
      if (!scenarioId) {
        if (args.hasReferenceLap) {
          store.referenceLap.updateReferenceLap(
            mockReferenceLap({ condition: args.wetReference ? 'wet' : 'dry' })
          );
        } else {
          store.referenceLap.reset();
        }

        store.drivingCoachWidget.displayedAdvisory = args.advisory;
        store.drivingCoachWidget.displayedBrakeUrgency = args.brakeUrgency;
        store.drivingCoachWidget.displayedExitLateM = args.exitLateM;
        store.drivingCoachWidget.displayedExitThrottleDeficit =
          args.exitThrottleDeficit;
      }

      const lapTiming = store.player.lapTiming;
      const distPct =
        args.distPct ?? lapTiming?.lap_dist_pct ?? DEFAULT_DIST_PCT;

      store.player.updateLapTiming(
        lapTiming
          ? { ...lapTiming, lap_dist_pct: distPct }
          : mockLapTiming({ lap_dist_pct: distPct })
      );

      // Replay this lap up to the car's position, so the trace behind it has
      // something recorded to compare against the reference.
      store.coachWidget.reset();

      const currentBucket = Math.floor(distPct * BUCKET_COUNT);

      for (let bucket = 0; bucket <= currentBucket; bucket++) {
        const pct = bucket / BUCKET_COUNT;

        store.coachWidget.seedBucket(
          bucket,
          ownSpeedAt(pct, args.ownApexDeltaKmh),
          ownBrakeAt(pct, args.ownBrakeLatePct)
        );
      }

      // The store fills the window on the telemetry frame, which a seeded
      // preview never receives.
      store.coachWidget.refreshFromSeed();
    },
    args: {
      advisory: 'neutral',
      brakeUrgency: 0,
      exitLateM: null,
      exitThrottleDeficit: 0,
      hasReferenceLap: true,
      wetReference: false,
      ownApexDeltaKmh: 0,
      ownBrakeLatePct: 0,
      showTrace: true,
      showUrgencyBar: true,
      showSpeed: true,
      showReferenceLapTime: true,
      traceChannel: 'speed',
    },
  }),
};

export default meta;
type Story = StoryObj<StoryArgs>;

/** How far off the reference's apex a story has to be for the trace to read. */
const APEX_DELTA_KMH = 29;

export const Default: Story = {};

export const LosingTime: Story = {
  args: { ownApexDeltaKmh: -APEX_DELTA_KMH },
};

export const GainingTime: Story = {
  args: { ownApexDeltaKmh: APEX_DELTA_KMH },
};

export const BrakeCall: Story = {
  parameters: previewScenario('driving-coach-brake'),
  args: { ownApexDeltaKmh: -APEX_DELTA_KMH },
};

export const BrakeSoon: Story = {
  parameters: previewScenario('driving-coach-brake-soon'),
};

export const GasCall: Story = {
  parameters: previewScenario('driving-coach-gas'),
  args: { ownApexDeltaKmh: APEX_DELTA_KMH },
};

/** The car is being caught — no pedal advice applies, so the coach says so instead. */
export const UnsettledCar: Story = {
  parameters: previewScenario('driving-coach-grip'),
};

/** The longest call the coach makes: a stored lap it can find no corner in. */
export const NothingToCompare: Story = {
  parameters: previewScenario('driving-coach-inactive'),
};

/** Out of the corner and still off the power — the metres count up until the throttle opens. */
export const LateOnThrottle: Story = {
  args: {
    advisory: 'gas',
    distPct: PREVIEW_CORNER_CENTER_PCT + 0.02,
    exitLateM: 14,
  },
};

/** On the power at the reference's own point, but carrying less of it. */
export const ExitThrottleDeficit: Story = {
  args: {
    advisory: 'gas',
    distPct: PREVIEW_CORNER_CENTER_PCT + 0.03,
    exitThrottleDeficit: 0.18,
  },
};

export const NoReferenceLap: Story = {
  args: { hasReferenceLap: false },
};

export const TraceOff: Story = {
  args: { showTrace: false },
};

export const TraceOffNoUrgencyBar: Story = {
  args: { showTrace: false, showUrgencyBar: false },
};

// Both braking stories sit the car just past the apex so that the reference
// mark and this lap's mark are inside the same window and can be compared.
export const BrakingLaterThanReference: Story = {
  args: {
    ownBrakeLatePct: 0.008,
    ownApexDeltaKmh: -22,
    distPct: PREVIEW_CORNER_CENTER_PCT - 0.005,
  },
};

export const BrakingEarlierThanReference: Story = {
  args: {
    ownBrakeLatePct: -0.008,
    ownApexDeltaKmh: 15,
    distPct: PREVIEW_CORNER_CENTER_PCT - 0.005,
  },
};

export const NoReadouts: Story = {
  args: { showSpeed: false, showReferenceLapTime: false },
};

export const WetReference: Story = {
  args: { wetReference: true },
};

export const BrakeChannel: Story = {
  args: {
    traceChannel: 'brake',
    ownBrakeLatePct: 0.008,
    distPct: PREVIEW_CORNER_CENTER_PCT - 0.005,
  },
};
