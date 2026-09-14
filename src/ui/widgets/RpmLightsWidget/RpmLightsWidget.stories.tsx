import { useEffect, useRef } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { runInAction } from 'mobx';

import type { RootStore } from '@store/root-store';
import { useStore } from '@store/root-store-context';
import { MPS_PER_KMH, mockCarDynamics } from '@store/preview/mocks/dynamics';
import { mockPitCarStatus } from '@store/preview/mocks/pit';
import { RpmLightsWidget } from './RpmLightsWidget';
import { defineWidgetStories } from '@/storybook/define-widget-stories';
import { seedFromSnapshot } from '@/storybook/seed-from-snapshot';

const RED_LINE = 8500;
const SHIFT_RPM = 8000;
const BLINK_RPM = 8200;
const IDLE_RPM = 800;

/** The engine the lights are laid out against, on top of the recorded session. */
const seedEngineLimits = (store: RootStore) => {
  const sessionInfo = store.session.sessionInfo;

  if (!sessionInfo) {
    return;
  }

  store.session.updateSessionInfo({
    ...sessionInfo,
    driverCarRedLine: RED_LINE,
    driverCarSlShiftRpm: SHIFT_RPM,
    driverCarSlBlinkRpm: BLINK_RPM,
    trackPitSpeedLimit: '55 kph',
  });
};

/** The gear the car would plausibly be in at a given rpm, so the readout agrees. */
const gearAtRpm = (rpm: number): number => Math.max(1, Math.ceil(rpm / 1500));

const seedDynamics = (store: RootStore, rpm: number, gear: number) =>
  store.player.updateCarDynamics(
    mockCarDynamics({ speed: rpm / 140, rpm, gear })
  );

interface StoryArgs {
  rpm: number;
}

const meta: Meta<StoryArgs> = {
  title: 'Widgets/RpmLightsWidget',
  ...defineWidgetStories<StoryArgs>({
    widget: RpmLightsWidget,
    size: { width: 360, height: 36, background: 'rgba(21, 22, 26, 0.8)' },
    seedSnapshot: true,
    seed: (store, args) => {
      seedEngineLimits(store);
      seedDynamics(store, args.rpm, 4);
    },
    args: { rpm: 5400 },
    argTypes: {
      rpm: { control: { type: 'number', step: 100, min: 0, max: RED_LINE } },
    },
  }),
};

export default meta;
type Story = StoryObj<StoryArgs>;

export const LowRpm: Story = { args: { rpm: 3200 } };
export const MidRpm: Story = { args: { rpm: 5400 } };
export const ShiftLight: Story = { args: { rpm: 8050 } };
export const BlinkLight: Story = { args: { rpm: 8300 } };

// ── Sweeping RPM (animated shift lights) ─────────────────────

const RPM_SWEEP_STEP = 120;
const RPM_SWEEP_INTERVAL_MS = 50;

const RpmAnimatedRenderer = () => {
  const store = useStore();
  const rpmRef = useRef(IDLE_RPM);
  const dirRef = useRef(1);

  useEffect(() => {
    runInAction(() => {
      // A custom `render` replaces the helper's own, and with it the snapshot
      // baseline it lays down — so this one lays it down itself.
      store.sim.isConnected = true;
      seedFromSnapshot(store);
      seedEngineLimits(store);
    });

    const intervalId = setInterval(() => {
      rpmRef.current += dirRef.current * RPM_SWEEP_STEP;

      if (rpmRef.current >= RED_LINE) {
        dirRef.current = -1;
      } else if (rpmRef.current <= IDLE_RPM) {
        dirRef.current = 1;
      }

      runInAction(() => {
        seedDynamics(store, rpmRef.current, gearAtRpm(rpmRef.current));
      });
    }, RPM_SWEEP_INTERVAL_MS);

    return () => clearInterval(intervalId);
  }, [store]);

  return <RpmLightsWidget />;
};

export const RpmAnimated: StoryObj = {
  render: RpmAnimatedRenderer,
};

// ── Pit LED animations (animated) ────────────────────────────

const PIT_PHASE_TICKS = 30;
const PIT_PHASE_INTERVAL_MS = 500;
const PIT_LANE_RPM = 3000;
const PIT_LANE_GEAR = 2;
const PIT_LANE_SPEED_KMH = 48;
const PIT_OVER_LIMIT_SPEED_KMH = 70;

type PitPhase = 'pit-lane' | 'limiter' | 'over-limit';

const NEXT_PIT_PHASE: Record<PitPhase, PitPhase> = {
  'pit-lane': 'limiter',
  limiter: 'over-limit',
  'over-limit': 'pit-lane',
};

const PitLedsRenderer = () => {
  const store = useStore();
  const phaseRef = useRef<PitPhase>('pit-lane');
  const phaseTickRef = useRef(0);

  useEffect(() => {
    runInAction(() => {
      // A custom `render` replaces the helper's own, and with it the snapshot
      // baseline it lays down — so this one lays it down itself.
      store.sim.isConnected = true;
      seedFromSnapshot(store);
      seedEngineLimits(store);
    });

    const intervalId = setInterval(() => {
      phaseTickRef.current += 1;

      if (phaseTickRef.current > PIT_PHASE_TICKS) {
        phaseTickRef.current = 0;
        phaseRef.current = NEXT_PIT_PHASE[phaseRef.current];
      }

      runInAction(() => {
        const phase = phaseRef.current;
        const speedKmh =
          phase === 'over-limit'
            ? PIT_OVER_LIMIT_SPEED_KMH
            : PIT_LANE_SPEED_KMH;

        store.player.updateCarStatus(
          mockPitCarStatus({ limiterOn: phase !== 'pit-lane' })
        );
        store.player.updateCarDynamics(
          mockCarDynamics({
            speed: speedKmh / MPS_PER_KMH,
            rpm: PIT_LANE_RPM,
            gear: PIT_LANE_GEAR,
          })
        );
      });
    }, PIT_PHASE_INTERVAL_MS);

    return () => clearInterval(intervalId);
  }, [store]);

  return <RpmLightsWidget />;
};

export const PitLedsAnimated: StoryObj = {
  render: PitLedsRenderer,
};
