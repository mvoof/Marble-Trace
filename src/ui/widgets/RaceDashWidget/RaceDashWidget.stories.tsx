import { useEffect, useLayoutEffect } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { runInAction } from 'mobx';

import type { DrivingAdvisory } from '@utils/driving-coach-utils';
import type {
  RaceDashWidgetSettings,
  RpmIndicatorMode,
} from '@/types/widget-settings';
import { useStore } from '@store/root-store-context';
import {
  PREVIEW_CORNER_CENTER_PCT,
  mockReferenceLap,
  referenceSpeedKmhAt,
} from '@store/preview/mocks/coach';
import { MPS_PER_KMH, mockCarDynamics } from '@store/preview/mocks/dynamics';
import { mockLapTiming } from '@store/preview/mocks/delta';
import { mockPitCarStatus, mockPitTarget } from '@store/preview/mocks/pit';
import { RaceDashWidget } from './RaceDashWidget';
import {
  defineWidgetStories,
  previewScenario,
} from '@/storybook/define-widget-stories';
import { seedFromSnapshot } from '@/storybook/seed-from-snapshot';

interface StoryArgs {
  /** Which call the coach is making, which is what colors the dash. */
  advisory: DrivingAdvisory;
  /** Where on the lap the car sits — the reference speed is read at this point. */
  atPct: number;
  /**
   * How far off the reference the car is running, in km/h. A coach story states
   * this rather than an absolute speed, so the bar is drawn against the lap the
   * builder supplies instead of against a number that has to agree with it by
   * hand.
   */
  speedDeltaKmh: number;
  /** An absolute speed instead — what a pit story states, with no lap being run. */
  speedKmh?: number;
  /** Whether a stored best lap is loaded at all. */
  referenceLap: boolean;
  rpm: number;
  gear: number;
  pitMode: 'none' | 'limiter' | 'pit-lane';
  pitPhase: 'toBox' | 'toExit';
  boxDistM: number;
  showSteeringMarker: boolean;
  steeringTrailColor: string;
  steeringWheelAngle: number;
}

/** How far down the lane the car is, in each of the two pit phases. */
const LANE_PROGRESS_TO_BOX = 0.4;
const LANE_PROGRESS_TO_EXIT = 0.85;

const DEGREES_PER_RADIAN = 180 / Math.PI;

const meta: Meta<StoryArgs> = {
  title: 'Widgets/RaceDashWidget',
  ...defineWidgetStories<StoryArgs>({
    widget: RaceDashWidget,
    seedSnapshot: true,
    size: {
      width: 418,
      height: 104,
      background: 'transparent',
      widgetBg: 'rgba(21, 22, 26, 0.8)',
      borderRadius: '52px',
      overflow: 'visible',
      border: 'none',
    },
    seed: (store, args, scenarioId) => {
      store.liveWidgets.updateUserSettings('race-dash', {
        showSteeringMarker: args.showSteeringMarker,
        steeringTrailColor: args.steeringTrailColor,
      });

      // A scenario states the whole car — the lap it is on, the speed it is
      // carrying and where in the pits it is. The knobs below are the other
      // base: what a story states when it names none.
      if (scenarioId !== undefined) {
        return;
      }

      store.drivingCoachWidget.displayedAdvisory = args.advisory;

      if (args.referenceLap) {
        store.referenceLap.updateReferenceLap(mockReferenceLap());
      } else {
        store.referenceLap.reset();
      }

      store.player.updateLapTiming(mockLapTiming({ lap_dist_pct: args.atPct }));

      const speedKmh =
        args.speedKmh ?? referenceSpeedKmhAt(args.atPct) + args.speedDeltaKmh;

      store.player.updateCarDynamics(
        mockCarDynamics({
          speed: speedKmh / MPS_PER_KMH,
          rpm: args.rpm,
          gear: args.gear,
          steering_wheel_angle: args.steeringWheelAngle / DEGREES_PER_RADIAN,
        })
      );

      if (args.pitMode === 'none' || args.boxDistM <= 0) {
        store.player.updatePitTarget(null);

        return;
      }

      store.player.updateCarStatus(
        mockPitCarStatus({ limiterOn: args.pitMode === 'limiter' })
      );

      store.player.updatePitTarget(
        mockPitTarget({
          distM: args.boxDistM,
          target: args.pitPhase === 'toExit' ? 'pitExit' : 'pitbox',
          laneProgressPct:
            args.pitPhase === 'toExit'
              ? LANE_PROGRESS_TO_EXIT
              : LANE_PROGRESS_TO_BOX,
        })
      );
    },
    args: {
      advisory: 'neutral',
      atPct: PREVIEW_CORNER_CENTER_PCT,
      speedDeltaKmh: -1,
      referenceLap: true,
      rpm: 6400,
      gear: 4,
      pitMode: 'none',
      pitPhase: 'toBox',
      boxDistM: 0,
      showSteeringMarker: false,
      steeringTrailColor: '#f59e0b',
      steeringWheelAngle: 0,
    },
    argTypes: {
      advisory: { control: 'radio', options: ['neutral', 'brake', 'gas'] },
      atPct: { control: { type: 'range', min: 0, max: 1, step: 0.01 } },
      speedDeltaKmh: { control: { type: 'number' } },
      speedKmh: { control: { type: 'number' } },
      referenceLap: { control: 'boolean' },
      rpm: { control: { type: 'number' } },
      gear: { control: { type: 'number' } },
      pitMode: { control: 'radio', options: ['none', 'limiter', 'pit-lane'] },
      pitPhase: { control: 'radio', options: ['toBox', 'toExit'] },
      boxDistM: { control: { type: 'number' } },
      showSteeringMarker: { control: 'boolean' },
      steeringTrailColor: { control: 'color' },
      steeringWheelAngle: {
        control: { type: 'range', min: -450, max: 450, step: 5 },
      },
    },
  }),
};

export default meta;
type Story = StoryObj<StoryArgs>;

const RPM_SWEEP_LOW = 1500;
const RPM_SWEEP_MS = 3000;
const RPM_SWEEP_SPEED_MPS = 60;
const RPM_SWEEP_GEAR = 4;
const FALLBACK_RED_LINE = 9500;

// Sweeps RPM from idle to redline on a loop so the ring's zone coloring,
// shift/blink thresholds, and rim-glow alert can be previewed without a live
// game connection.
const RpmSweepPreview = ({
  rpmIndicatorMode,
}: {
  rpmIndicatorMode: RpmIndicatorMode;
}) => {
  const store = useStore();

  useLayoutEffect(() => {
    runInAction(() => {
      store.sim.isConnected = true;
      seedFromSnapshot(store);
      const settings: Partial<RaceDashWidgetSettings> = { rpmIndicatorMode };

      store.liveWidgets.updateUserSettings('race-dash', settings);
    });
  }, [store, rpmIndicatorMode]);

  useEffect(() => {
    let animationFrame = 0;
    const startTime = performance.now();

    const tick = (now: number) => {
      const elapsedMs = (now - startTime) % RPM_SWEEP_MS;
      const sweepPct = elapsedMs / RPM_SWEEP_MS;
      const redLine =
        store.session.sessionInfo?.driverCarRedLine ?? FALLBACK_RED_LINE;
      const rpm = RPM_SWEEP_LOW + sweepPct * (redLine - RPM_SWEEP_LOW);

      runInAction(() => {
        store.player.updateCarDynamics(
          mockCarDynamics({
            rpm,
            gear: RPM_SWEEP_GEAR,
            speed: RPM_SWEEP_SPEED_MPS,
          })
        );
      });

      animationFrame = requestAnimationFrame(tick);
    };

    animationFrame = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(animationFrame);
    };
  }, [store]);

  return <RaceDashWidget />;
};

export const RpmSweepAnimation: Story = {
  render: () => <RpmSweepPreview rpmIndicatorMode="fill" />,
};

export const RpmSweepAnimationComb: Story = {
  render: () => <RpmSweepPreview rpmIndicatorMode="comb" />,
};

export const RpmSweepAnimationHiddenRing: Story = {
  render: () => <RpmSweepPreview rpmIndicatorMode="glow" />,
};

export const RpmSweepAnimationOff: Story = {
  render: () => <RpmSweepPreview rpmIndicatorMode="off" />,
};

export const OnPace: Story = {};

/** Into the corner carrying too much speed — the call the dash turns red for. */
export const Brake: Story = {
  args: { advisory: 'brake', speedDeltaKmh: 12, gear: 5 },
};

/** Off the corner short of the reference, with throttle still to come. */
export const Gas: Story = {
  args: { advisory: 'gas', speedDeltaKmh: -9, rpm: 4200, gear: 3 },
};

/** The coach's own braking call, as the scenario states the whole corner. */
export const CoachBrake: Story = {
  parameters: previewScenario('driving-coach-brake'),
};

/** The car down the lane with the limiter armed, from the pit scenario. */
export const PitLaneWithLimiter: Story = {
  parameters: previewScenario('pit-limiter'),
};

export const ShiftBlink: Story = {
  args: { rpm: 9200, speedDeltaKmh: -16, gear: 2 },
};

export const PitLimiter: Story = {
  args: {
    pitMode: 'limiter',
    speedKmh: 48,
    rpm: 3200,
    gear: 1,
    boxDistM: 184,
  },
};

export const PitLimiterNearBox: Story = {
  args: {
    pitMode: 'limiter',
    speedKmh: 32,
    rpm: 2400,
    gear: 1,
    boxDistM: 28,
  },
};

export const PitLimiterToExit: Story = {
  args: {
    pitMode: 'limiter',
    pitPhase: 'toExit',
    speedKmh: 59,
    rpm: 3200,
    gear: 1,
    boxDistM: 140,
  },
};

export const PitLaneNoLimiter: Story = {
  args: {
    pitMode: 'pit-lane',
    speedKmh: 57,
    rpm: 3400,
    gear: 2,
    boxDistM: 180,
  },
};

export const PitLaneNoLimiterUnderLimit: Story = {
  args: {
    pitMode: 'pit-lane',
    speedKmh: 42,
    rpm: 2800,
    gear: 2,
    boxDistM: 180,
  },
};

export const SteeringMarkerCentered: Story = {
  args: { showSteeringMarker: true, steeringWheelAngle: 0 },
};

export const SteeringMarkerQuarterTurn: Story = {
  args: { showSteeringMarker: true, steeringWheelAngle: 90 },
};

// Past a half turn the trail must keep winding the way the wheel went instead
// of flipping to the short arc on the other side.
export const SteeringMarkerBeyondHalfTurn: Story = {
  args: { showSteeringMarker: true, steeringWheelAngle: -260 },
};

// Beyond a full turn the marker laps the badge, the way a marker taped to a
// real rim does.
export const SteeringMarkerLapped: Story = {
  args: { showSteeringMarker: true, steeringWheelAngle: 430 },
};

export const NoReferenceLap: Story = {
  args: { referenceLap: false, speedKmh: 172 },
};
