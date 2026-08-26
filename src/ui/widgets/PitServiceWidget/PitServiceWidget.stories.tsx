import type { Meta, StoryObj } from '@storybook/react-vite';

import type {
  CarEntry,
  ChassisFrame,
  PitServiceFrame,
  TrackShapePayload,
} from '@/types/bindings';
import type {
  PitApproachPlacement,
  PitServiceWidgetSettings,
} from '@/types/widget-settings';
import { PitServiceWidget } from './PitServiceWidget';
import { defineWidgetStories } from '@/storybook/define-widget-stories';

interface StoryArgs {
  speedMs: number;
  pitLimit: string;
  onPitRoad: boolean;
  inPitStall: boolean;
  towTimeS: number;
  fuelOrdered: number;
  fuelCalculated: number;
  repairLeftS: number;
  optRepairLeftS: number;
  changeFronts: boolean;
  changeRears: boolean;
  showFooter: boolean;
  distToBoxM: number;
  approachPlacement: PitApproachPlacement;
}

const STORY_FIELD_SIZE = 24;

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

const STORY_FIELD = Array.from(
  { length: STORY_FIELD_SIZE },
  (_unused, index) => ({
    carIdx: index,
  })
) as CarEntry[];

const CORNER_TEMPS: Record<string, [number, number, number]> = {
  lf: [104, 97, 89],
  rf: [91, 96, 101],
  lr: [95, 92, 87],
  rr: [88, 93, 99],
};

const CORNER_WEAR: Record<string, [number, number, number]> = {
  lf: [0.41, 0.58, 0.72],
  rf: [0.7, 0.61, 0.54],
  lr: [0.62, 0.74, 0.79],
  rr: [0.81, 0.76, 0.64],
};

const CORNER_PRESSURE: Record<string, number> = {
  lf: 152,
  rf: 158,
  lr: 149,
  rr: 154,
};

const buildChassis = (): ChassisFrame => {
  const frame: Record<string, number> = {};

  for (const corner of ['lf', 'rf', 'lr', 'rr']) {
    const [cl, cm, cr] = CORNER_TEMPS[corner];
    const [wl, wm, wr] = CORNER_WEAR[corner];

    frame[`${corner}_temp_cl`] = cl;
    frame[`${corner}_temp_cm`] = cm;
    frame[`${corner}_temp_cr`] = cr;
    frame[`${corner}_wear_l`] = wl;
    frame[`${corner}_wear_m`] = wm;
    frame[`${corner}_wear_r`] = wr;
    frame[`${corner}_pressure`] = CORNER_PRESSURE[corner];
  }

  return frame as unknown as ChassisFrame;
};

const buildPitService = (args: StoryArgs): PitServiceFrame =>
  ({
    flags: null,
    changeLf: args.changeFronts,
    changeRf: args.changeFronts,
    changeLr: args.changeRears,
    changeRr: args.changeRears,
    addFuel: args.fuelOrdered > 0,
    cleanWindshield: false,
    fastRepair: false,
    fuelAmount: args.fuelOrdered,
    lfPressure: 159,
    rfPressure: 163,
    lrPressure: 155,
    rrPressure: 159,
    tireCompound: null,
    repairLeftS: args.repairLeftS,
    optRepairLeftS: args.optRepairLeftS,
    towTimeS: args.towTimeS,
    fastRepairsAvailable: 1,
    fastRepairsUsed: 1,
    serviceStatus: null,
    inPitStall: args.inPitStall,
  }) as PitServiceFrame;

const meta: Meta<StoryArgs> = {
  title: 'Widgets/PitServiceWidget',
  ...defineWidgetStories<StoryArgs>({
    widget: PitServiceWidget,
    // The docked approach rail is drawn outside the panel, the way the overlay
    // container lets it through with `overflowVisible` in the manifest.
    size: { width: 235, height: 330, overflow: 'visible' },
    seed: (store, args) => {
      store.player.updateCarStatus({
        on_pit_road: args.onPitRoad,
        fuel_level: 78,
      } as Parameters<typeof store.player.updateCarStatus>[0]);

      store.player.updateCarDynamics({
        speed: args.speedMs,
      } as Parameters<typeof store.player.updateCarDynamics>[0]);

      store.player.updateLapTiming({
        player_car_position: 7,
      } as Parameters<typeof store.player.updateLapTiming>[0]);

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

      store.player.updatePitTarget(
        distToBoxM,
        'pitbox',
        boxLanePct - distToBoxM / STORY_LANE_LENGTH_M
      );

      store.player.updateChassis(buildChassis());
      store.player.updatePitService(buildPitService(args));

      // `cars` is always present on a real SessionInfo, and the footer's field
      // size reads it — a seed without it throws where the sim never would.
      store.session.updateSessionInfo({
        trackPitSpeedLimit: args.pitLimit,
        trackLengthM: STORY_TRACK_LENGTH_M,
        driverPitTrkPct: STORY_PIT_BOX_PCT,
        cars: STORY_FIELD,
      } as Parameters<typeof store.session.updateSessionInfo>[0]);

      store.backendComputed.updateFuel({
        fuelToAdd: args.fuelCalculated,
      } as Parameters<typeof store.backendComputed.updateFuel>[0]);

      store.widgetSettings.updateUserSettings('pit-service', {
        ...store.widgetSettings.getSettings<PitServiceWidgetSettings>(
          'pit-service'
        ),
        showFooter: args.showFooter,
        showPitApproach: true,
        pitApproachPlacement: args.approachPlacement,
        alwaysVisible: true,
      });
    },
    args: {
      speedMs: 18,
      pitLimit: '72 kph',
      onPitRoad: true,
      inPitStall: false,
      towTimeS: 0,
      fuelOrdered: 34.2,
      fuelCalculated: 34.2,
      repairLeftS: 0,
      optRepairLeftS: 0,
      changeFronts: true,
      changeRears: true,
      showFooter: true,
      distToBoxM: 180,
      approachPlacement: 'inline',
    },
    argTypes: {
      speedMs: { control: { type: 'range', min: 0, max: 30, step: 0.5 } },
      distToBoxM: { control: { type: 'range', min: 0, max: 350, step: 5 } },
      approachPlacement: {
        control: { type: 'inline-radio' },
        options: ['inline', 'side'],
      },
    },
  }),
};

export default meta;
type Story = StoryObj<StoryArgs>;

export const Armed: Story = {};

export const OverPitLimit: Story = {
  args: { speedMs: 22 },
};

export const Servicing: Story = {
  args: {
    inPitStall: true,
    speedMs: 0,
    repairLeftS: 12.4,
    optRepairLeftS: 8,
    changeRears: false,
  },
};

export const ManualFuelOrder: Story = {
  args: { fuelOrdered: 40, fuelCalculated: 34.2 },
};

export const Towing: Story = {
  args: { towTimeS: 42, onPitRoad: false },
};

export const FooterOff: Story = {
  args: { showFooter: false },
};

export const ApproachingBox: Story = {
  args: { distToBoxM: 60, speedMs: 18 },
};

export const BrakeForBox: Story = {
  args: { distToBoxM: 30, speedMs: 18 },
};

export const ApproachSideRail: Story = {
  args: { approachPlacement: 'side', distToBoxM: 90 },
};
