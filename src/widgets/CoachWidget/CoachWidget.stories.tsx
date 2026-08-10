import type { Meta, StoryObj } from '@storybook/react-vite';

import type { ReferenceLapData, ReferenceLapSample } from '@/types/bindings';
import type { CoachWidgetSettings } from '@/types/widget-settings';
import type { DrivingAdvisory } from '@store/widgets/driving-coach-utils';
import { CoachWidget } from './CoachWidget';
import { defineWidgetStories } from '@/storybook/define-widget-stories';

const BUCKET_COUNT = 1000;
const TRACK_LENGTH_M = 4000;
const REFERENCE_LAP_TIME_S = 107.48;
/** Where the sample corner sits on the lap, as a fraction of lap distance. */
const CORNER_CENTER_PCT = 0.5;
/** How wide the sample braking zone is, in lap fraction. */
const CORNER_HALF_WIDTH_PCT = 0.05;
const STRAIGHT_SPEED_MPS = 68;
const APEX_SPEED_MPS = 32;

/**
 * One braking zone into a corner and back out, so the trace has a real shape
 * to draw instead of a flat line.
 */
const speedAtPct = (pct: number, apexSpeedMps: number): number => {
  const distance = Math.abs(pct - CORNER_CENTER_PCT);

  if (distance >= CORNER_HALF_WIDTH_PCT) {
    return STRAIGHT_SPEED_MPS;
  }

  const depth = 1 - distance / CORNER_HALF_WIDTH_PCT;

  return STRAIGHT_SPEED_MPS - (STRAIGHT_SPEED_MPS - apexSpeedMps) * depth;
};

const referenceLap = (): ReferenceLapData => ({
  trackId: 1,
  carScreenName: 'Storybook GT3',
  lapTime: REFERENCE_LAP_TIME_S,
  samples: Array.from({ length: BUCKET_COUNT }, (_unused, index) => {
    const pct = index / BUCKET_COUNT;

    return {
      speed: speedAtPct(pct, APEX_SPEED_MPS),
      throttle: 1,
      brake: 0,
      latAccel: null,
      longAccel: null,
      steeringWheelAngle: 0,
    } satisfies ReferenceLapSample;
  }),
  recordedWetness: null,
  recordedTireWear: null,
  recordedFuelLevel: null,
});

interface StoryArgs {
  advisory: DrivingAdvisory;
  brakeUrgency: number;
  hasReferenceLap: boolean;
  showTrace: boolean;
  showUrgencyBar: boolean;
  /** Apex speed this lap ran: below the reference loses time, above it gains. */
  ownApexSpeed: number;
  distPct: number;
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
    seed: (store, args) => {
      store.widgetSettings.updateUserSettings('coach', {
        showTrace: args.showTrace,
        showUrgencyBar: args.showUrgencyBar,
        windowMeters: 150,
      } as Partial<CoachWidgetSettings>);

      store.session.updateSessionInfo({
        ...store.session.sessionInfo,
        trackLengthM: TRACK_LENGTH_M,
      } as NonNullable<typeof store.session.sessionInfo>);

      if (args.hasReferenceLap) {
        store.referenceLap.updateReferenceLap(referenceLap());
      } else {
        store.referenceLap.reset();
      }

      store.drivingCoachWidget.displayedAdvisory = args.advisory;
      store.drivingCoachWidget.displayedBrakeUrgency = args.brakeUrgency;

      // Replay this lap up to the car's position, so the trace behind it has
      // something recorded to compare against the reference.
      store.coachWidget.reset();

      const currentBucket = Math.floor(args.distPct * BUCKET_COUNT);

      for (let bucket = 0; bucket <= currentBucket; bucket++) {
        store.coachWidget.ownSpeedByBucket[bucket] = speedAtPct(
          bucket / BUCKET_COUNT,
          args.ownApexSpeed
        );
      }

      store.coachWidget.frameTick++;
      store.player.updateLapTiming({
        ...store.player.lapTiming,
        lap_dist_pct: args.distPct,
      } as NonNullable<typeof store.player.lapTiming>);
    },
    args: {
      advisory: 'neutral',
      brakeUrgency: 0,
      hasReferenceLap: true,
      showTrace: true,
      showUrgencyBar: true,
      ownApexSpeed: APEX_SPEED_MPS,
      distPct: CORNER_CENTER_PCT + 0.01,
    },
  }),
};

export default meta;
type Story = StoryObj<StoryArgs>;

export const Default: Story = {};

export const LosingTime: Story = {
  args: { ownApexSpeed: APEX_SPEED_MPS - 8 },
};

export const GainingTime: Story = {
  args: { ownApexSpeed: APEX_SPEED_MPS + 8 },
};

export const BrakeCall: Story = {
  args: {
    advisory: 'brake',
    brakeUrgency: 1,
    distPct: CORNER_CENTER_PCT - 0.03,
    ownApexSpeed: APEX_SPEED_MPS - 8,
  },
};

export const GasCall: Story = {
  args: {
    advisory: 'gas',
    distPct: CORNER_CENTER_PCT + 0.03,
    ownApexSpeed: APEX_SPEED_MPS + 8,
  },
};

export const BrakeSoon: Story = {
  args: { brakeUrgency: 0.85, distPct: CORNER_CENTER_PCT - 0.055 },
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
