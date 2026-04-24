import type { Meta, StoryObj } from '@storybook/react-vite';

import { LinearMapWidget } from './LinearMapWidget';
import { WidgetScaler } from '../../WidgetScaler';
import { computeDriverEntries } from '../../../storybook/compute-driver-entries';
import type { LinearMapWidgetSettings } from '../../../store/widget-settings.store';
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
  const isHorizontal = settings.orientation === 'horizontal';
  const designWidth = isHorizontal ? 400 : 40;
  const designHeight = isHorizontal ? 40 : 400;

  return (
    <div style={{ width: containerWidth, height: containerHeight }}>
      <WidgetScaler
        designWidth={designWidth}
        designHeight={designHeight}
        adaptive
        background="#1a1a1a"
      >
        <LinearMapWidget entries={entries} settings={settings} />
      </WidgetScaler>
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
