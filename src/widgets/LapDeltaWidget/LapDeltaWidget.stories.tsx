import { useLayoutEffect } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { runInAction } from 'mobx';

import type { LapDeltaFrame } from '@/types/bindings';
import type { ComputedStore } from '@store/iracing/computed.store';
import type { WidgetSettingsStore } from '@store/widget-settings.store';
import {
  useComputedStore,
  useWidgetSettingsStore,
} from '@store/root-store-context';
import { LapDeltaWidget } from './LapDeltaWidget';
import { widgetDecorator } from '@/storybook/widgetDecorator';
import { withStore } from '../../../.storybook/decorators';

interface StoryArgs {
  delta: number;
  layout: 'vertical' | 'horizontal';
  showSectorTimes: boolean;
  sectorTimes: (number | null)[];
  sectorDeltas: (number | null)[];
}

const applyArgs = (
  stores: { computed: ComputedStore; widgetSettings: WidgetSettingsStore },
  args: StoryArgs
) => {
  runInAction(() => {
    stores.widgetSettings.updateUserSettings('lap-delta', {
      layout: args.layout,
      showSectorTimes: args.showSectorTimes,
      reference: 'session_best',
    });

    stores.computed.updateLapDelta({
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
  const computed = useComputedStore();
  const widgetSettings = useWidgetSettingsStore();

  useLayoutEffect(() => {
    applyArgs({ computed, widgetSettings }, args);
  }, [args, computed, widgetSettings]);

  return <LapDeltaWidget />;
};

const meta: Meta<typeof StoryHost> = {
  title: 'Widgets/LapDeltaWidget',
  component: StoryHost,
  parameters: { layout: 'centered' },
  decorators: [
    withStore(),
    widgetDecorator({ display: 'inline-block', minWidth: 150 }),
  ],
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

export const SectorInProgress: Story = {
  args: {
    delta: 0.042,
    showSectorTimes: true,
    sectorTimes: [22.4, null, null],
    sectorDeltas: [0.18, null, null],
  },
};

export const NoData: Story = {
  args: {
    delta: 0,
    sectorTimes: [],
    sectorDeltas: [],
  },
};
