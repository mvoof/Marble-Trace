import type { Meta, StoryObj } from '@storybook/react-vite';

import { SpeedWidget } from './SpeedWidget';

import type { SpeedWidgetSettings } from '../../../types/widget-settings';
import type { TelemetrySnapshot } from '../../../storybook/snapshot.types';
import snapshot from '../../../../test-data/iracing-1776008424511.json';

const DESIGN_WIDTH = 360;
const DESIGN_HEIGHT = 110;

const realSnapshot = snapshot as TelemetrySnapshot;

const DEFAULT_SETTINGS: SpeedWidgetSettings = {
  focusMode: 'speed',
  rpmColorTheme: 'custom',
  rpmColorLow: '#22c55e',
  rpmColorMid: '#eab308',
  rpmColorHigh: '#ef4444',
  rpmColorLimit: '#ff4d00',
};

interface SpeedWidgetStoryArgs extends SpeedWidgetSettings {
  snapshot: TelemetrySnapshot;
}

const SpeedWidgetStory = ({
  snapshot: snap,
  ...settings
}: SpeedWidgetStoryArgs) => {
  const frame = snap.carDynamics;
  const driverInfo = snap.sessionInfo?.DriverInfo;
  const speed = frame ? `${Math.round(frame.speed * 3.6)}` : '0';
  const rpm = frame ? Math.round(frame.rpm) : 0;
  const gear = frame?.gear ?? 0;
  const shiftIndicatorPct = frame?.shift_indicator_pct ?? 0;
  const maxShiftRpm =
    driverInfo?.DriverCarSLShiftRPM || driverInfo?.DriverCarRedLine || 10000;

  return (
    <div style={{ width: DESIGN_WIDTH, height: DESIGN_HEIGHT }}>
      <div
        style={{
          width: '100%',
          height: '100%',
          background: 'radial-gradient(circle, #1a1a1a 0%, #0a0a0a 100%)',
          overflow: 'hidden',
        }}
      >
        <SpeedWidget
          speed={speed}
          speedUnit="km/h"
          rpm={rpm}
          gear={gear}
          shiftIndicatorPct={shiftIndicatorPct}
          maxShiftRpm={maxShiftRpm}
          settings={settings}
        />
      </div>
    </div>
  );
};

const meta: Meta<SpeedWidgetStoryArgs> = {
  title: 'Widgets/SpeedWidget',
  component: SpeedWidgetStory,
  parameters: {
    layout: 'centered',
  },
  args: {
    ...DEFAULT_SETTINGS,
    snapshot: realSnapshot,
  },
};

export default meta;

type Story = StoryObj<SpeedWidgetStoryArgs>;

export const Default: Story = {};

export const GearFocus: Story = {
  args: { focusMode: 'gear' },
};

export const GradientTheme: Story = {
  args: { rpmColorTheme: 'gradient' },
};

export const ClassicTheme: Story = {
  args: { rpmColorTheme: 'classic' },
};

export const Scaled2x: Story = {
  args: { focusMode: 'gear' },
  render: ({ snapshot: snap, ...settings }) => {
    const frame = snap.carDynamics;
    const driverInfo = snap.sessionInfo?.DriverInfo;
    const speed = frame ? `${Math.round(frame.speed * 3.6)}` : '0';
    const rpm = frame ? Math.round(frame.rpm) : 0;
    const gear = frame?.gear ?? 0;
    const shiftIndicatorPct = frame?.shift_indicator_pct ?? 0;
    const maxShiftRpm =
      driverInfo?.DriverCarSLShiftRPM || driverInfo?.DriverCarRedLine || 10000;

    return (
      <div style={{ width: DESIGN_WIDTH * 2, height: DESIGN_HEIGHT * 2 }}>
        <div
          style={{
            width: '100%',
            height: '100%',
            background: 'radial-gradient(circle, #1a1a1a 0%, #0a0a0a 100%)',
            overflow: 'hidden',
          }}
        >
          <SpeedWidget
            speed={speed}
            speedUnit="km/h"
            rpm={rpm}
            gear={gear}
            shiftIndicatorPct={shiftIndicatorPct}
            maxShiftRpm={maxShiftRpm}
            settings={settings}
          />
        </div>
      </div>
    );
  },
};

export const Redline: Story = {
  args: {
    focusMode: 'gear',
    snapshot: {
      ...realSnapshot,
      carDynamics: {
        ...realSnapshot.carDynamics!,
        rpm: 7400,
        shift_indicator_pct: 1.0,
        gear: 3,
        speed: 62.0,
      },
    },
  },
};

export const SpeedFocusHighSpeed: Story = {
  args: {
    focusMode: 'speed',
    snapshot: {
      ...realSnapshot,
      carDynamics: {
        ...realSnapshot.carDynamics!,
        speed: 83.3,
        rpm: 6500,
        gear: 5,
        shift_indicator_pct: 0.72,
      },
    },
  },
};

export const NoData: Story = {
  args: {
    snapshot: {
      capturedAt: new Date().toISOString(),
      carDynamics: null,
      carIdx: null,
      carInputs: null,
      carStatus: null,
      environment: null,
      lapTiming: null,
      session: null,
      sessionInfo: null,
    },
  },
};
