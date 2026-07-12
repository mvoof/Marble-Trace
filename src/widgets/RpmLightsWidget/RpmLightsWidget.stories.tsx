import { useEffect, useRef } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { runInAction } from 'mobx';

import type { LapTimingFrame, SessionSnapshot } from '@/types/bindings';
import type { PlayerStore } from '@store/data/player.store';
import { useStore } from '@store/root-store-context';
import { RpmLightsWidget } from './RpmLightsWidget';
import { defineWidgetStories } from '@/storybook/define-widget-stories';

const RED_LINE = 8500;
const SHIFT_RPM = 8000;
const BLINK_RPM = 8200;

const BASE_SESSION_INFO = {
  driverCarRedLine: RED_LINE,
  driverCarSlShiftRpm: SHIFT_RPM,
  driverCarSlBlinkRpm: BLINK_RPM,
  trackPitSpeedLimit: '55 kph',
} as SessionSnapshot;

const setDynamics = (player: PlayerStore, rpm: number, gear: number) =>
  player.updateCarDynamics({
    speed: rpm / 140,
    rpm,
    gear,
  } as Parameters<typeof player.updateCarDynamics>[0]);

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
      store.session.updateSessionInfo(BASE_SESSION_INFO);
      setDynamics(store.player, args.rpm, 4);
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

const RpmAnimatedRenderer = () => {
  const store = useStore();
  const rpmRef = useRef(800);
  const dirRef = useRef(1);

  useEffect(() => {
    runInAction(() => {
      store.session.updateSessionInfo(BASE_SESSION_INFO);
    });

    const intervalId = setInterval(() => {
      rpmRef.current += dirRef.current * 120;

      if (rpmRef.current >= RED_LINE) {
        dirRef.current = -1;
      } else if (rpmRef.current <= 800) {
        dirRef.current = 1;
      }

      runInAction(() => {
        setDynamics(
          store.player,
          rpmRef.current,
          Math.max(1, Math.ceil(rpmRef.current / 1500))
        );
      });
    }, 50);

    return () => clearInterval(intervalId);
  }, [store]);

  return <RpmLightsWidget />;
};

export const RpmAnimated: StoryObj = {
  render: RpmAnimatedRenderer,
};

// ── Pit LED animations (animated) ────────────────────────────

const PitLedsRenderer = () => {
  const store = useStore();
  const phaseRef = useRef<'pit-lane' | 'limiter' | 'over-limit'>('pit-lane');
  const phaseTickRef = useRef(0);

  useEffect(() => {
    runInAction(() => {
      store.session.updateSessionInfo(BASE_SESSION_INFO);
      store.player.updateLapTiming({
        lap: 3,
        player_car_position: 5,
      } as LapTimingFrame);
    });

    const intervalId = setInterval(() => {
      phaseTickRef.current += 1;

      if (phaseTickRef.current > 30) {
        phaseTickRef.current = 0;
        phaseRef.current =
          phaseRef.current === 'pit-lane'
            ? 'limiter'
            : phaseRef.current === 'limiter'
              ? 'over-limit'
              : 'pit-lane';
      }

      runInAction(() => {
        const phase = phaseRef.current;
        store.player.updateCarStatus({
          on_pit_road: true,
          engine_warnings: phase === 'pit-lane' ? 0 : 0x10,
        } as Parameters<typeof store.player.updateCarStatus>[0]);
        store.player.updateCarDynamics({
          speed: phase === 'over-limit' ? 70 / 3.6 : 48 / 3.6,
          rpm: 3000,
          gear: 2,
        } as Parameters<typeof store.player.updateCarDynamics>[0]);
      });
    }, 500);

    return () => clearInterval(intervalId);
  }, [store]);

  return <RpmLightsWidget />;
};

export const PitLedsAnimated: StoryObj = {
  render: PitLedsRenderer,
};
