import { useEffect, useLayoutEffect } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { runInAction } from 'mobx';

import type { DrivingAdvisory } from '@store/widgets/driving-coach-utils';
import type { ReferenceLapData } from '@/types/bindings';
import type { RaceDashWidgetSettings } from '@/types/widget-settings';
import { PIT_LIMITER_BIT } from '@widgets/SpeedWidget/hooks/usePitState';
import { useStore } from '@store/root-store-context';
import { RaceDashWidget } from './RaceDashWidget';
import { defineWidgetStories } from '@/storybook/define-widget-stories';
import { seedFromSnapshot } from '@/storybook/seed-from-snapshot';

interface StoryArgs {
  advisory: DrivingAdvisory;
  referenceKmh: number;
  speedKmh: number;
  rpm: number;
  gear: number;
  pitMode: 'none' | 'limiter' | 'pit-lane';
  boxDistM: number;
}

const REFERENCE_BUCKET_COUNT = 1000;

const buildReferenceLap = (referenceMps: number): ReferenceLapData => ({
  trackId: 0,
  carScreenName: 'Preview Car',
  lapTime: 90,
  samples: Array.from({ length: REFERENCE_BUCKET_COUNT }, () => ({
    speed: referenceMps,
    throttle: 1,
    brake: 0,
  })),
});

const meta: Meta<StoryArgs> = {
  title: 'Widgets/RaceDashWidget',
  ...defineWidgetStories<StoryArgs>({
    widget: RaceDashWidget,
    seedSnapshot: true,
    size: {
      width: 430,
      height: 104,
      background: 'transparent',
      widgetBg: 'rgba(21, 22, 26, 0.8)',
      borderRadius: '52px 14px 14px 52px',
      overflow: 'visible',
      border: 'none',
    },
    seed: (store, args) => {
      store.drivingCoachWidget.displayedAdvisory = args.advisory;

      if (args.referenceKmh > 0) {
        store.referenceLap.updateReferenceLap(
          buildReferenceLap(args.referenceKmh / 3.6)
        );
      }

      const lapTiming = store.player.lapTiming;

      if (lapTiming) {
        store.player.updateLapTiming({ ...lapTiming, lap_dist_pct: 0.5 });
      }

      const carDynamics = store.player.carDynamics;

      if (carDynamics) {
        store.player.updateCarDynamics({
          ...carDynamics,
          speed: args.speedKmh / 3.6,
          rpm: args.rpm,
          gear: args.gear,
        });
      }

      const carStatus = store.player.carStatus;

      if (carStatus && args.pitMode !== 'none') {
        store.player.updateCarStatus({
          ...carStatus,
          on_pit_road: true,
          engine_warnings:
            args.pitMode === 'limiter'
              ? carStatus.engine_warnings | PIT_LIMITER_BIT
              : carStatus.engine_warnings & ~PIT_LIMITER_BIT,
        });
      }

      if (args.pitMode !== 'none' && args.boxDistM > 0) {
        store.player.updatePitTarget(args.boxDistM, 'pitbox', 0.4);
      } else {
        store.player.updatePitTarget(null, null, null);
      }
    },
    args: {
      advisory: 'neutral',
      referenceKmh: 185,
      speedKmh: 184,
      rpm: 6400,
      gear: 4,
      pitMode: 'none',
      boxDistM: 0,
    },
    argTypes: {
      advisory: { control: 'radio', options: ['neutral', 'brake', 'gas'] },
      referenceKmh: { control: { type: 'number' } },
      speedKmh: { control: { type: 'number' } },
      rpm: { control: { type: 'number' } },
      gear: { control: { type: 'number' } },
      pitMode: { control: 'radio', options: ['none', 'limiter', 'pit-lane'] },
      boxDistM: { control: { type: 'number' } },
    },
  }),
};

export default meta;
type Story = StoryObj<StoryArgs>;

const RPM_SWEEP_LOW = 1500;
const RPM_SWEEP_MS = 3000;

// Sweeps RPM from idle to redline on a loop so the ring's zone coloring,
// shift/blink thresholds, and rim-glow alert can be previewed without a live
// game connection.
const RpmSweepPreview = ({ showRpmFill }: { showRpmFill: boolean }) => {
  const store = useStore();

  useLayoutEffect(() => {
    runInAction(() => {
      store.sim.isConnected = true;
      seedFromSnapshot(store);
      store.widgetSettings.updateUserSettings('race-dash', {
        ...store.widgetSettings.getSettings<RaceDashWidgetSettings>(
          'race-dash'
        ),
        showRpmFill,
      });
    });
  }, [store, showRpmFill]);

  useEffect(() => {
    let animationFrame = 0;
    const startTime = performance.now();

    const tick = (now: number) => {
      const elapsedMs = (now - startTime) % RPM_SWEEP_MS;
      const sweepPct = elapsedMs / RPM_SWEEP_MS;
      const redLine = store.session.sessionInfo?.driverCarRedLine ?? 9500;
      const rpm = RPM_SWEEP_LOW + sweepPct * (redLine - RPM_SWEEP_LOW);

      runInAction(() => {
        const carDynamics = store.player.carDynamics;

        if (carDynamics) {
          store.player.updateCarDynamics({
            ...carDynamics,
            rpm,
            gear: 4,
            speed: 60,
          });
        }
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
  render: () => <RpmSweepPreview showRpmFill />,
};

export const RpmSweepAnimationHiddenRing: Story = {
  render: () => <RpmSweepPreview showRpmFill={false} />,
};

export const OnPace: Story = {};

export const Brake: Story = {
  args: { advisory: 'brake', referenceKmh: 231, speedKmh: 243, gear: 5 },
};

export const Gas: Story = {
  args: {
    advisory: 'gas',
    referenceKmh: 137,
    speedKmh: 128,
    rpm: 4200,
    gear: 3,
  },
};

export const ShiftBlink: Story = {
  args: { rpm: 9200, speedKmh: 96, gear: 2 },
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

export const NoReferenceLap: Story = {
  args: { referenceKmh: 0, speedKmh: 172 },
};
