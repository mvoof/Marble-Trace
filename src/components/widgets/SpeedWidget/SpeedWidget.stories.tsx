import { useEffect, useRef } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { SpeedWidget } from './SpeedWidget';
import { telemetryStore } from '../../../store/iracing';
import { widgetSettingsStore } from '../../../store/widget-settings.store';
import type { SpeedWidgetSettings } from '../../../store/widget-settings.store';
import type { TelemetrySnapshot } from '../../../storybook/snapshot.types';
import snapshot from '../../../../test-data/iracing-1776008424511.json';
import { DEFAULT_WIDGETS } from '../../../store/widget-settings.store';
import { runInAction } from 'mobx';

const DESIGN_WIDTH = 290;
const DESIGN_HEIGHT = 80;

const realSnapshot = snapshot as TelemetrySnapshot;

interface SpeedWidgetStoryArgs extends SpeedWidgetSettings {
  snapshot: TelemetrySnapshot;
}

const SpeedWidgetStory = ({
  snapshot: snap,
  ...settings
}: SpeedWidgetStoryArgs) => {
  const containerRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const updateScale = () => {
      const { width, height } = el.getBoundingClientRect();
      const scale = Math.min(width / DESIGN_WIDTH, height / DESIGN_HEIGHT);
      document.documentElement.style.fontSize = `${scale * 16}px`;
    };

    const observer = new ResizeObserver(updateScale);
    observer.observe(el);
    updateScale();

    return () => {
      observer.disconnect();
      document.documentElement.style.fontSize = '';
    };
  }, []);

  return (
    <div
      ref={containerRef}
      style={{
        width: DESIGN_WIDTH,
        height: DESIGN_HEIGHT,
        background: 'radial-gradient(circle, #1a1a1a 0%, #0a0a0a 100%)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <SpeedWidget />
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
  args: {
    focusMode: 'gear',
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
    snapshot: { capturedAt: new Date().toISOString() },
  },
};
