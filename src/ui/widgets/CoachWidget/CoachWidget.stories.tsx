import type { Meta, StoryObj } from '@storybook/react-vite';

import type { ReferenceLapData, ReferenceLapSample } from '@/types/bindings';
import type { CoachWidgetSettings } from '@/types/widget-settings';
import type { DrivingAdvisory } from '@utils/driving-coach-utils';
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

/** Brake pedal down from `brakeStartPct` until the apex, mirroring a real braking zone. */
const brakeAtPct = (pct: number, brakeStartPct: number): number =>
  pct >= brakeStartPct && pct <= CORNER_CENTER_PCT ? 1 : 0;

/** Where the reference driver gets on the brakes for the sample corner. */
const REFERENCE_BRAKE_PCT = CORNER_CENTER_PCT - 0.035;

const referenceLap = (): ReferenceLapData => ({
  trackId: 1,
  carScreenName: 'Storybook GT3',
  lapTime: REFERENCE_LAP_TIME_S,
  samples: Array.from({ length: BUCKET_COUNT }, (_unused, index) => {
    const pct = index / BUCKET_COUNT;

    return {
      speed: speedAtPct(pct, APEX_SPEED_MPS),
      throttle: 1,
      brake: brakeAtPct(pct, REFERENCE_BRAKE_PCT),
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
  /** Where this lap gets on the brakes — later than the reference costs time. */
  ownBrakeOffsetPct: number;
  distPct: number;
  showSpeed: boolean;
  showReferenceLapTime: boolean;
  wetReference: boolean;
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
    seed: (store, args) => {
      store.widgetSettings.updateUserSettings('coach', {
        showTrace: args.showTrace,
        showUrgencyBar: args.showUrgencyBar,
        showSpeed: args.showSpeed,
        showReferenceLapTime: args.showReferenceLapTime,
        showTrackCondition: true,
        traceChannel: args.traceChannel,
        windowMeters: 150,
      } as Partial<CoachWidgetSettings>);

      store.session.updateSessionInfo({
        ...store.session.sessionInfo,
        trackLengthM: TRACK_LENGTH_M,
      } as NonNullable<typeof store.session.sessionInfo>);

      if (args.hasReferenceLap) {
        store.referenceLap.updateReferenceLap({
          ...referenceLap(),
          condition: args.wetReference ? 'wet' : 'dry',
        });
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
        const pct = bucket / BUCKET_COUNT;

        store.coachWidget.seedBucket(
          bucket,
          speedAtPct(pct, args.ownApexSpeed),
          brakeAtPct(pct, args.ownBrakeOffsetPct)
        );
      }

      store.player.updateLapTiming({
        ...store.player.lapTiming,
        lap_dist_pct: args.distPct,
      } as NonNullable<typeof store.player.lapTiming>);

      // The store fills the window on the telemetry frame, which a seeded
      // preview never receives.
      store.coachWidget.refreshFromSeed();
    },
    args: {
      advisory: 'neutral',
      brakeUrgency: 0,
      hasReferenceLap: true,
      showTrace: true,
      showUrgencyBar: true,
      ownApexSpeed: APEX_SPEED_MPS,
      ownBrakeOffsetPct: REFERENCE_BRAKE_PCT,
      distPct: CORNER_CENTER_PCT + 0.01,
      showSpeed: true,
      showReferenceLapTime: true,
      wetReference: false,
      traceChannel: 'speed',
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

// Both braking stories sit the car just past the apex so that the reference
// mark and this lap's mark are inside the same window and can be compared.
export const BrakingLaterThanReference: Story = {
  args: {
    ownBrakeOffsetPct: REFERENCE_BRAKE_PCT + 0.008,
    ownApexSpeed: APEX_SPEED_MPS - 6,
    distPct: CORNER_CENTER_PCT - 0.005,
  },
};

export const BrakingEarlierThanReference: Story = {
  args: {
    ownBrakeOffsetPct: REFERENCE_BRAKE_PCT - 0.008,
    ownApexSpeed: APEX_SPEED_MPS + 4,
    distPct: CORNER_CENTER_PCT - 0.005,
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
    ownBrakeOffsetPct: REFERENCE_BRAKE_PCT + 0.008,
    distPct: CORNER_CENTER_PCT - 0.005,
  },
};
