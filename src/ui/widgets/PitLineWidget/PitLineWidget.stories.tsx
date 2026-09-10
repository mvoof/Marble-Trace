import type { Meta, StoryObj } from '@storybook/react-vite';

import type { TrackShapePayload } from '@/types/bindings';
import type { PitLineWidgetSettings } from '@/types/widget-settings';
import { PitLineWidget } from './PitLineWidget';
import { defineWidgetStories } from '@/storybook/define-widget-stories';

interface StoryArgs {
  speedMs: number;
  longAccelMs2: number;
  pitLimit: string;
  onPitRoad: boolean;
  distToBoxM: number;
  /** Which leg is being driven — into the box, or out of it towards the exit. */
  leavingBox: boolean;
}

// A 4 km track whose pit lane runs from 2% to 12% of the lap with the stall two
// thirds of the way down it — enough for the rail to have a real box patch.
const STORY_TRACK_LENGTH_M = 4000;
const STORY_PIT_IN_PCT = 0.02;
const STORY_PIT_EXIT_PCT = 0.12;
const STORY_PIT_BOX_PCT = 0.09;
const STORY_LANE_LENGTH_M =
  (STORY_PIT_EXIT_PCT - STORY_PIT_IN_PCT) * STORY_TRACK_LENGTH_M;

const STORY_TRACK_SHAPE: TrackShapePayload = {
  trackId: 1,
  svgPath: '',
  viewBox: '0 0 100 100',
  points: [],
  pitInPct: STORY_PIT_IN_PCT,
  pitExitPct: STORY_PIT_EXIT_PCT,
};

const WIDGET_SIZE = { width: 120, height: 150 };

const meta: Meta<StoryArgs> = {
  title: 'Widgets/PitLineWidget',
  ...defineWidgetStories<StoryArgs>({
    widget: PitLineWidget,
    size: WIDGET_SIZE,
    seed: (store, args) => {
      store.player.updateCarStatus({
        on_pit_road: args.onPitRoad,
      } as Parameters<typeof store.player.updateCarStatus>[0]);

      store.player.updateCarDynamics({
        speed: args.speedMs,
        long_accel: args.longAccelMs2,
      } as Parameters<typeof store.player.updateCarDynamics>[0]);

      store.trackMapWidget.onTrackShapeReceived(STORY_TRACK_SHAPE);

      // The rail reads the lane the same way the overlay does: progress along
      // the lane, not a bar filled to match the distance.
      const boxLanePct =
        (STORY_PIT_BOX_PCT - STORY_PIT_IN_PCT) /
        (STORY_PIT_EXIT_PCT - STORY_PIT_IN_PCT);

      // Further back than the entry line there is no lane left to stand on, so
      // the control is capped there instead of showing a distance the progress
      // below has already clamped away.
      const distToBoxM = Math.min(
        args.distToBoxM,
        boxLanePct * STORY_LANE_LENGTH_M
      );

      // Out of the box the sim counts down to the exit line instead, and the
      // car is already past the stall.
      store.player.updatePitTarget(
        args.leavingBox
          ? {
              distM: distToBoxM,
              target: 'pitExit',
              laneProgressPct:
                1 - distToBoxM / ((1 - boxLanePct) * STORY_LANE_LENGTH_M),
            }
          : {
              distM: distToBoxM,
              target: 'pitbox',
              laneProgressPct: boxLanePct - distToBoxM / STORY_LANE_LENGTH_M,
            }
      );

      store.session.updateSessionInfo({
        trackPitSpeedLimit: args.pitLimit,
        trackLengthM: STORY_TRACK_LENGTH_M,
        driverPitTrkPct: STORY_PIT_BOX_PCT,
      } as Parameters<typeof store.session.updateSessionInfo>[0]);

      store.liveWidgets.updateUserSettings('pit-line', {
        ...store.liveWidgets.getSettings<PitLineWidgetSettings>('pit-line'),
        alwaysVisible: true,
      });
    },
    args: {
      speedMs: 18,
      longAccelMs2: 0,
      pitLimit: '72 kph',
      onPitRoad: true,
      distToBoxM: 180,
      leavingBox: false,
    },
    argTypes: {
      speedMs: { control: { type: 'range', min: 0, max: 30, step: 0.5 } },
      distToBoxM: { control: { type: 'range', min: 0, max: 350, step: 5 } },
    },
  }),
};

export default meta;
type Story = StoryObj<StoryArgs>;

export const OnTheWayIn: Story = {};

export const OverPitLimit: Story = {
  args: { speedMs: 22 },
};

export const LiftOffAhead: Story = {
  args: { speedMs: 17, longAccelMs2: 4 },
};

export const BrakeForBox: Story = {
  args: { distToBoxM: 30 },
};

// The stall is behind the car, so the column measures the leg that is left —
// box to pit exit — and the label reads the direction it runs in.
export const LeavingBox: Story = {
  args: { leavingBox: true, distToBoxM: 60 },
};

// Off pit road with the limiter released: the lane stops applying, the speed
// column says GO and the lane column becomes the arrows that go with it.
export const PitExitGo: Story = {
  args: { onPitRoad: false },
};
