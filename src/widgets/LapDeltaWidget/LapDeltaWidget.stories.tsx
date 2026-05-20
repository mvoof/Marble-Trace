import { useEffect } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { runInAction } from 'mobx';

import { computedStore } from '../../store/iracing/computed.store';
import { widgetSettingsStore } from '../../store/widget-settings.store';
import type { LapDeltaFrame } from '../../types/bindings';
import { LapDeltaWidget } from './LapDeltaWidget';
import { widgetDecorator } from '../../storybook/widgetDecorator';

interface StoryArgs {
  delta: number;
  layout: 'vertical' | 'horizontal';
  showSectorTimes: boolean;
  sectorTimes: (number | null)[];
  sectorDeltas: (number | null)[];
}

const applyArgs = (args: StoryArgs) => {
  runInAction(() => {
    widgetSettingsStore.updateUserSettings('lap-delta', {
      layout: args.layout,
      showSectorTimes: args.showSectorTimes,
      reference: 'session_best',
    });

    computedStore.updateLapDelta({
      sectorTimes: args.sectorTimes,
      currentSectorIdx: 0,
      sessionBestTotal: args.delta,
      sessionBestSectors: args.sectorDeltas,
      personalBestTotal: args.delta,
      personalBestSectors: args.sectorDeltas,
    } as LapDeltaFrame);
  });
};

const StoryHost = (args: StoryArgs) => {
  useEffect(() => {
    applyArgs(args);
  }, [args]);
  return <LapDeltaWidget />;
};

const meta: Meta<typeof StoryHost> = {
  title: 'Widgets/LapDeltaWidget',
  component: StoryHost,
  parameters: { layout: 'centered' },
  decorators: [widgetDecorator({ display: 'inline-block', minWidth: 150 })],
  args: {
    delta: -0.342,
    layout: 'vertical',
    showSectorTimes: false,
    sectorTimes: [],
    sectorDeltas: [],
  },
};

export default meta;
type Story = StoryObj<typeof StoryHost>;

export const AheadVertical: Story = {};

export const BehindVertical: Story = {
  args: { delta: 0.812 },
};

export const Neutral: Story = {
  args: { delta: 0 },
};

export const Horizontal: Story = {
  args: {
    delta: -0.342,
    layout: 'horizontal',
    showSectorTimes: true,
    sectorTimes: [22.1, 31.4, null],
    sectorDeltas: [-0.12, 0.08, null],
  },
};

export const WithSectorData: Story = {
  args: {
    delta: -0.215,
    showSectorTimes: true,
    sectorTimes: [22.1, 31.4, 18.7],
    sectorDeltas: [-0.12, 0.08, -0.24],
  },
};
