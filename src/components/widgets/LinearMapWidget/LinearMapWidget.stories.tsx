import type { Meta, StoryObj } from '@storybook/react-vite';

import { LinearMapWidget } from './LinearMapWidget';

import { computeDriverEntries } from '../../../storybook/compute-driver-entries';
import type { LinearMapWidgetSettings } from '../../../types/widget-settings';
import type { TelemetrySnapshot } from '../../../storybook/snapshot.types';
import snapshot from '../../../../test-data/iracing-1776008424511.json';

const realSnapshot = snapshot as TelemetrySnapshot;

interface LinearMapStoryArgs extends LinearMapWidgetSettings {
  snapshot: TelemetrySnapshot;
}

const makeStory = (
  snap: TelemetrySnapshot,
  settings: LinearMapWidgetSettings,
  containerWidth: number,
  containerHeight: number
) => {
  const entries = [
    ...computeDriverEntries(snap.carIdx, snap.sessionInfo?.DriverInfo ?? null),
  ].sort((a, b) => b.relativeLapDist - a.relativeLapDist);
  return (
    <div style={{ width: containerWidth, height: containerHeight }}>
      <div
        style={{
          width: '100%',
          height: '100%',
          background: '#1a1a1a',
          overflow: 'hidden',
        }}
      >
        <LinearMapWidget entries={entries} settings={settings} />
      </div>
    </div>
  );
};

const LinearMapWidgetStory = ({
  snapshot: snap,
  ...settings
}: LinearMapStoryArgs) => makeStory(snap, settings, 400, 40);

const meta: Meta<LinearMapStoryArgs> = {
  title: 'Widgets/LinearMapWidget',
  component: LinearMapWidgetStory,
  parameters: {
    layout: 'centered',
  },
  args: {
    orientation: 'horizontal',
    snapshot: realSnapshot,
  },
};

export default meta;

type Story = StoryObj<LinearMapStoryArgs>;

export const Horizontal: Story = {};

export const Vertical: Story = {
  args: { orientation: 'vertical' },
  render: ({ snapshot: snap, ...settings }) =>
    makeStory(snap, settings, 40, 400),
};

export const HorizontalWide: Story = {
  render: ({ snapshot: snap, ...settings }) =>
    makeStory(snap, settings, 700, 50),
};

export const NoData: Story = {
  args: {
    snapshot: {
      capturedAt: new Date().toISOString(),
      carIdx: null,
      sessionInfo: null,
      carDynamics: null,
      carInputs: null,
      carStatus: null,
      lapTiming: null,
      session: null,
      environment: null,
    } as unknown as TelemetrySnapshot,
  },
};
