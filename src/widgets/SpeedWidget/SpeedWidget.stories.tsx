import { useEffect } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { runInAction } from 'mobx';

import type {
  LapTimingFrame,
  SessionSnapshot,
  TrackShapePayload,
} from '@/types/bindings';
import { useStore } from '@store/root-store-context';
import { SpeedWidget } from './SpeedWidget';
import { defineWidgetStories } from '@/storybook/define-widget-stories';

const RED_LINE = 8500;
const SHIFT_RPM = 8000;
const BLINK_RPM = 8200;
const TRACK_LENGTH_M = 5300;

const BASE_SESSION_INFO = {
  driverCarRedLine: RED_LINE,
  driverCarSlShiftRpm: SHIFT_RPM,
  driverCarSlBlinkRpm: BLINK_RPM,
  trackPitSpeedLimit: '55 kph',
  trackLengthM: TRACK_LENGTH_M,
} as SessionSnapshot;

// pit_in ≈ 0.88, pit_exit ≈ 0.02 — crosses S/F line
const SAMPLE_TRACK_SHAPE: TrackShapePayload = {
  trackId: 1,
  svgPath: '',
  viewBox: '0 0 100 100',
  points: [],
  pitInPct: 0.88,
  pitExitPct: 0.02,
};

interface StoryArgs {
  speedKmh: number;
  rpm: number;
  gear: number;
  lap: number;
  position: number;
  onPitRoad: boolean;
  engineWarnings: number;
  units: 'metric' | 'imperial';
}

const meta: Meta<StoryArgs> = {
  title: 'Widgets/SpeedWidget',
  ...defineWidgetStories<StoryArgs>({
    widget: SpeedWidget,
    size: { width: 500, height: 96, background: 'rgba(21, 22, 26, 0.8)' },
    seedSnapshot: true,
    seed: (store, args) => {
      store.session.updateSessionInfo(BASE_SESSION_INFO);

      store.player.updateCarDynamics({
        speed: args.speedKmh / 3.6,
        rpm: args.rpm,
        gear: args.gear,
      } as Parameters<typeof store.player.updateCarDynamics>[0]);

      store.player.updateCarStatus({
        on_pit_road: args.onPitRoad,
        engine_warnings: args.engineWarnings,
      } as Parameters<typeof store.player.updateCarStatus>[0]);

      store.player.updateLapTiming({
        lap: args.lap,
        player_car_position: args.position,
      } as LapTimingFrame);

      store.units.setSystem(args.units);
    },
    args: {
      speedKmh: 120,
      rpm: 5400,
      gear: 3,
      lap: 12,
      position: 3,
      onPitRoad: false,
      engineWarnings: 0,
      units: 'metric',
    },
    argTypes: {
      speedKmh: { control: { type: 'number', step: 1 }, name: 'speed (km/h)' },
      rpm: { control: { type: 'number', step: 100 } },
      gear: { control: { type: 'number', min: -1, max: 8, step: 1 } },
      lap: { control: { type: 'number', min: 1 } },
      position: { control: { type: 'number', min: 1 } },
      onPitRoad: { control: 'boolean' },
      engineWarnings: { control: { type: 'number' } },
      units: { control: 'radio', options: ['metric', 'imperial'] },
    },
  }),
};

export default meta;
type Story = StoryObj<StoryArgs>;

// ── Normal states ─────────────────────────────────────────────

export const Default: Story = {};

export const HighSpeed: Story = {
  args: { speedKmh: 267, rpm: 7800, gear: 6 },
};

export const Imperial: Story = {
  args: { speedKmh: 200, rpm: 7200, gear: 5, units: 'imperial' },
};

export const Reverse: Story = {
  args: { speedKmh: 8, rpm: 1800, gear: -1 },
};

export const Neutral: Story = {
  args: { speedKmh: 0, rpm: 900, gear: 0 },
};

// ── Pit states ────────────────────────────────────────────────

export const PitLaneNoLimiter: Story = {
  args: {
    speedKmh: 40,
    rpm: 2800,
    gear: 2,
    onPitRoad: true,
    engineWarnings: 0,
  },
};

export const PitLimiterActive: Story = {
  args: {
    speedKmh: 51,
    rpm: 3100,
    gear: 3,
    onPitRoad: true,
    engineWarnings: 0x10,
  },
};

export const OverPitLimit: Story = {
  args: {
    speedKmh: 67,
    rpm: 3400,
    gear: 3,
    onPitRoad: true,
    engineWarnings: 0x10,
  },
};

// ── Pit overlay states (full overlay with progress bar) ───────

const makePitOverlayRenderer = (
  speedKmh: number,
  engineWarnings: number,
  lapDistPct: number
) => {
  const Renderer = () => {
    const store = useStore();

    useEffect(() => {
      runInAction(() => {
        store.session.updateSessionInfo(BASE_SESSION_INFO);
        store.trackMapWidget.onTrackShapeReceived(SAMPLE_TRACK_SHAPE);
        store.player.updateCarStatus({
          on_pit_road: true,
          engine_warnings: engineWarnings,
        } as Parameters<typeof store.player.updateCarStatus>[0]);
        store.player.updateCarDynamics({
          speed: speedKmh / 3.6,
          rpm: 3000,
          gear: 2,
        } as Parameters<typeof store.player.updateCarDynamics>[0]);
        store.player.updateLapTiming({
          lap: 5,
          player_car_position: 3,
          lap_dist_pct: lapDistPct,
        } as LapTimingFrame);
      });
    }, [store]);

    return <SpeedWidget />;
  };

  Renderer.displayName = 'PitOverlayRenderer';

  return Renderer;
};

export const PitOverlayEntry: StoryObj = {
  render: makePitOverlayRenderer(40, 0, 0.91),
};

export const PitOverlayLimiter: StoryObj = {
  render: makePitOverlayRenderer(52, 0x10, 0.94),
};

export const PitOverlayOverLimit: StoryObj = {
  render: makePitOverlayRenderer(70, 0x10, 0.96),
};

// Pit lane with progress bar + BOX cue visible + limiter-near-exit indicators.
const PitLaneWithBoxRenderer = () => {
  const store = useStore();

  useEffect(() => {
    runInAction(() => {
      store.session.updateSessionInfo({
        ...BASE_SESSION_INFO,
        driverPitTrkPct: 0.935,
      } as SessionSnapshot);
      store.trackMapWidget.onTrackShapeReceived(SAMPLE_TRACK_SHAPE);
      store.player.updateCarStatus({
        on_pit_road: true,
        engine_warnings: 0x10,
      } as Parameters<typeof store.player.updateCarStatus>[0]);
      store.player.updateCarDynamics({
        speed: 49 / 3.6,
        rpm: 3000,
        gear: 2,
      } as Parameters<typeof store.player.updateCarDynamics>[0]);
      store.player.updateLapTiming({
        lap: 5,
        player_car_position: 3,
        lap_dist_pct: 0.955,
      } as LapTimingFrame);
      store.player.updatePitTarget(8, 'pitbox', 0.85);
    });
  }, [store]);

  return <SpeedWidget />;
};

PitLaneWithBoxRenderer.displayName = 'PitLaneWithBoxRenderer';

export const PitLaneWithBox: StoryObj = {
  render: PitLaneWithBoxRenderer,
};
