import type { Meta, StoryObj } from '@storybook/react-vite';

import type { PitLineWidgetSettings } from '@/types/widget-settings';
import { mockCarStatus } from '@store/preview/mocks/engine';
import { mockPitTarget } from '@store/preview/mocks/pit';
import {
  SAMPLE_PIT_EXIT_PCT,
  SAMPLE_PIT_IN_PCT,
} from '@store/preview/sample-track';
import { PitLineWidget } from './PitLineWidget';
import {
  defineWidgetStories,
  previewScenario,
} from '@/storybook/define-widget-stories';

interface StoryArgs {
  /**
   * Where the car is in the lane and what it is doing there. Left undefined —
   * which is what a story naming a scenario does — the scenario's own lane is
   * kept, so a knob states a difference rather than replacing it.
   */
  speedMs?: number;
  longAccelMs2?: number;
  onPitRoad?: boolean;
  distToBoxM?: number;
  /** Which leg is being driven — into the box, or out of it towards the exit. */
  leavingBox?: boolean;
}

const WIDGET_SIZE = { width: 80, height: 380 };

// The sample track's pit lane wraps the start/finish line, so the span and the
// stall's place in it are measured the long way round.
const LANE_SPAN_PCT = (SAMPLE_PIT_EXIT_PCT + 1 - SAMPLE_PIT_IN_PCT) % 1;

// The rail reads the lane the same way the overlay does: progress along the
// lane, not a bar filled to match the distance.
const seedPitTarget = (
  { laneLengthM, boxLanePct }: { laneLengthM: number; boxLanePct: number },
  args: StoryArgs
) => {
  // Further back than the entry line there is no lane left to stand on, so the
  // control is capped there instead of showing a distance the progress below
  // has already clamped away.
  const distM = Math.min(args.distToBoxM ?? 0, boxLanePct * laneLengthM);

  // Out of the box the sim counts down to the exit line instead, and the car is
  // already past the stall.
  if (args.leavingBox) {
    return mockPitTarget({
      distM,
      target: 'pitExit',
      laneProgressPct: 1 - distM / ((1 - boxLanePct) * laneLengthM),
    });
  }

  return mockPitTarget({
    distM,
    target: 'pitbox',
    laneProgressPct: boxLanePct - distM / laneLengthM,
  });
};

const meta: Meta<StoryArgs> = {
  title: 'Widgets/PitLineWidget',
  ...defineWidgetStories<StoryArgs>({
    widget: PitLineWidget,
    size: WIDGET_SIZE,
    seedSnapshot: true,
    seed: (store, args) => {
      const sessionInfo = store.session.sessionInfo;

      if (args.onPitRoad !== undefined) {
        store.player.updateCarStatus(
          mockCarStatus({
            ...store.player.carStatus,
            on_pit_road: args.onPitRoad,
          })
        );
      }

      // Patched rather than rebuilt: every story here has a scenario under it,
      // and what a knob states is a difference from the lap that scenario put
      // the car on, not a car of its own.
      const dynamics = store.player.carDynamics;

      if (dynamics) {
        store.player.updateCarDynamics({
          ...dynamics,
          speed: args.speedMs ?? dynamics.speed,
          long_accel: args.longAccelMs2 ?? dynamics.long_accel,
        });
      }

      if (sessionInfo && args.distToBoxM !== undefined) {
        const laneLengthM = LANE_SPAN_PCT * sessionInfo.trackLengthM;

        const boxLanePct =
          (((sessionInfo.driverPitTrkPct ?? 0) - SAMPLE_PIT_IN_PCT + 1) % 1) /
          LANE_SPAN_PCT;

        store.player.updatePitTarget(
          seedPitTarget({ laneLengthM, boxLanePct }, args)
        );
      }

      store.liveWidgets.updateUserSettings('pit-line', {
        ...store.liveWidgets.getSettings<PitLineWidgetSettings>('pit-line'),
        alwaysVisible: true,
      });
    },
    argTypes: {
      speedMs: { control: { type: 'range', min: 0, max: 30, step: 0.5 } },
      distToBoxM: { control: { type: 'range', min: 0, max: 350, step: 5 } },
    },
  }),
};

export default meta;
type Story = StoryObj<StoryArgs>;

// Just through the entry line with the limiter still off: the lane bar starts
// filling and the box is most of a lane away.
export const OnTheWayIn: Story = {
  parameters: previewScenario('pit-lane'),
};

export const OverPitLimit: Story = {
  parameters: previewScenario('pit-over-limit'),
};

// Closing on the stall under the limiter — the box countdown is inside the cue
// distance, which is when it turns green.
export const BrakeForBox: Story = {
  parameters: previewScenario('pit-limiter'),
};

export const LiftOffAhead: Story = {
  parameters: previewScenario('pit-lane'),
  args: { speedMs: 17, longAccelMs2: 4 },
};

// The stall is behind the car, so the column measures the leg that is left —
// box to pit exit — and the label reads the direction it runs in.
export const LeavingBox: Story = {
  parameters: previewScenario('pit-limiter'),
  args: { leavingBox: true, distToBoxM: 60 },
};

// Off pit road with the limiter released: the lane stops applying, the speed
// column says GO and the lane column becomes the arrows that go with it.
export const PitExitGo: Story = {
  parameters: previewScenario('pit-lane'),
  args: { onPitRoad: false },
};
