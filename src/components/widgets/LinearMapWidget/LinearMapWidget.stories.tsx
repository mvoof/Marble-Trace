import type { Meta, StoryObj } from '@storybook/react-vite';

import { LinearMapWidget } from './LinearMapWidget';
import { WidgetScaler } from '../../WidgetScaler';
import { computeDriverEntries, sortByRelativeLapDist } from '../widget-utils';
import type { LinearMapWidgetSettings } from '../../../store/widget-settings.store';
import type { TelemetrySnapshot } from '../../../storybook/snapshot.types';
import snapshot from '../../../../test-data/iracing-1776008424511.json';

const realSnapshot = snapshot as TelemetrySnapshot;

interface LinearMapStoryArgs extends LinearMapWidgetSettings {
  snapshot: TelemetrySnapshot;
  containerWidth: number;
  containerHeight: number;
}

const LinearMapWidgetStory = ({
  snapshot: snap,
  containerWidth,
  containerHeight,
  ...settings
}: LinearMapStoryArgs) => {
  const playerCarIdx = snap.sessionInfo?.DriverInfo?.DriverCarIdx ?? -1;
  const entries = sortByRelativeLapDist(
    computeDriverEntries(snap.carIdx, snap.sessionInfo?.DriverInfo ?? null),
    playerCarIdx
  );
  const isHorizontal = settings.orientation === 'horizontal';
  const designWidth = isHorizontal ? 400 : 40;
  const designHeight = isHorizontal ? 40 : 400;

  return (
    <div style={{ width: containerWidth, height: containerHeight }}>
      <WidgetScaler
        designWidth={designWidth}
        designHeight={designHeight}
        background="#1a1a1a"
      >
        <LinearMapWidget entries={entries} settings={settings} />
      </WidgetScaler>
    </div>
  );
};

const meta: Meta<LinearMapStoryArgs> = {
  title: 'Widgets/LinearMapWidget',
  component: LinearMapWidgetStory,
  parameters: {
    layout: 'centered',
  },
  argTypes: {
    containerWidth: {
      control: { type: 'range', min: 40, max: 800, step: 10 },
      description: 'Container width (px)',
      table: { category: 'Container' },
    },
    containerHeight: {
      control: { type: 'range', min: 40, max: 800, step: 10 },
      description: 'Container height (px)',
      table: { category: 'Container' },
    },
    orientation: {
      control: 'radio',
      options: ['horizontal', 'vertical'],
      table: { category: 'Widget Settings' },
    },
    snapshot: {
      table: { disable: true },
    },
  },
  args: {
    containerWidth: 400,
    containerHeight: 40,
    orientation: 'horizontal',
    snapshot: realSnapshot,
  },
};

export default meta;

type Story = StoryObj<LinearMapStoryArgs>;

export const Horizontal: Story = {};

export const Vertical: Story = {
  args: {
    orientation: 'vertical',
    containerWidth: 40,
    containerHeight: 400,
  },
};

export const HorizontalWide: Story = {
  args: {
    containerWidth: 700,
    containerHeight: 50,
  },
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
