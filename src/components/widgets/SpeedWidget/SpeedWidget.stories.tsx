import { useEffect } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { runInAction } from 'mobx';
import { SpeedWidget } from './SpeedWidget';
import { WidgetScaler } from '../../WidgetScaler';
import { telemetryStore } from '../../../store/iracing';
import {
  widgetSettingsStore,
  DEFAULT_WIDGETS,
} from '../../../store/widget-settings.store';
import type { SpeedWidgetSettings } from '../../../store/widget-settings.store';
import type { TelemetrySnapshot } from '../../../storybook/snapshot.types';
import snapshot from '../../../../test-data/iracing-1776008424511.json';

const DESIGN_WIDTH = 290;
const DESIGN_HEIGHT = 80;

const realSnapshot = snapshot as TelemetrySnapshot;

interface SpeedWidgetStoryArgs extends SpeedWidgetSettings {
  snapshot: TelemetrySnapshot;
  containerWidth: number;
  containerHeight: number;
}

const SpeedWidgetStory = ({
  snapshot: snap,
  containerWidth,
  containerHeight,
  ...settings
}: SpeedWidgetStoryArgs) => {
  useEffect(() => {
    if (widgetSettingsStore.widgets.length === 0) {
      runInAction(() => {
        widgetSettingsStore.widgets = [...DEFAULT_WIDGETS];
      });
    }
    widgetSettingsStore.updateCustomSettings('speed', { speed: settings });
  }, [settings]);

  useEffect(() => {
    if (snap.carDynamics) telemetryStore.updateCarDynamics(snap.carDynamics);
    if (snap.carInputs) telemetryStore.updateCarInputs(snap.carInputs);
    if (snap.carStatus) telemetryStore.updateCarStatus(snap.carStatus);
    if (snap.environment) telemetryStore.updateEnvironment(snap.environment);
    if (snap.lapTiming) telemetryStore.updateLapTiming(snap.lapTiming);
    if (snap.session) telemetryStore.updateSession(snap.session);
    if (snap.sessionInfo) telemetryStore.updateSessionInfo(snap.sessionInfo);
    if (snap.carIdx) telemetryStore.updateCarIdx(snap.carIdx);

    return () => telemetryStore.reset();
  }, [snap]);

  return (
    <div style={{ width: containerWidth, height: containerHeight }}>
      <WidgetScaler
        designWidth={DESIGN_WIDTH}
        designHeight={DESIGN_HEIGHT}
        background="radial-gradient(circle, #1a1a1a 0%, #0a0a0a 100%)"
      >
        <SpeedWidget />
      </WidgetScaler>
    </div>
  );
};

const meta: Meta<SpeedWidgetStoryArgs> = {
  title: 'Widgets/SpeedWidget',
  component: SpeedWidgetStory,
  parameters: {
    layout: 'centered',
  },
  argTypes: {
    containerWidth: {
      control: { type: 'range', min: 100, max: 800, step: 10 },
      description: 'Container width (px)',
      table: { category: 'Container' },
    },
    containerHeight: {
      control: { type: 'range', min: 40, max: 400, step: 10 },
      description: 'Container height (px)',
      table: { category: 'Container' },
    },
    focusMode: {
      control: 'radio',
      options: ['speed', 'gear'],
      description: 'Which value is displayed in the centre ring',
      table: { category: 'Widget Settings' },
    },
    rpmColorTheme: {
      control: 'radio',
      options: ['custom', 'gradient', 'classic'],
      description: 'RPM bar colour mode',
      table: { category: 'Widget Settings' },
    },
    rpmColorLow: {
      control: 'color',
      description: 'RPM colour — low zone (custom theme only)',
      table: { category: 'Widget Settings' },
    },
    rpmColorMid: {
      control: 'color',
      description: 'RPM colour — mid zone (custom theme only)',
      table: { category: 'Widget Settings' },
    },
    rpmColorHigh: {
      control: 'color',
      description: 'RPM colour — high zone (custom theme only)',
      table: { category: 'Widget Settings' },
    },
    rpmColorLimit: {
      control: 'color',
      description: 'RPM colour — redline / shift indicator',
      table: { category: 'Widget Settings' },
    },
    snapshot: {
      table: { disable: true },
    },
  },
  args: {
    containerWidth: DESIGN_WIDTH,
    containerHeight: DESIGN_HEIGHT,
    focusMode: 'speed',
    rpmColorTheme: 'custom',
    rpmColorLow: '#22c55e',
    rpmColorMid: '#eab308',
    rpmColorHigh: '#ef4444',
    rpmColorLimit: '#ff4d00',
    snapshot: realSnapshot,
  },
};

export default meta;

type Story = StoryObj<SpeedWidgetStoryArgs>;

export const Default: Story = {
  args: { focusMode: 'gear' },
};

export const Scaled2x: Story = {
  args: {
    focusMode: 'gear',
    containerWidth: DESIGN_WIDTH * 2,
    containerHeight: DESIGN_HEIGHT * 2,
  },
};

export const Redline: Story = {
  args: {
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
    focusMode: 'gear',
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
