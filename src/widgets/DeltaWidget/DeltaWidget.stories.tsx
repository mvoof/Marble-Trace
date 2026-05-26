import { useLayoutEffect } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { runInAction } from 'mobx';

import type { LapDeltaFrame } from '@/types/bindings';
import type { BackendComputedStore } from '@store/iracing/computed.store';
import type { WidgetSettingsStore } from '@store/widget-settings.store';
import {
  useBackendComputedStore,
  useWidgetSettingsStore,
} from '@store/root-store-context';
import { LapFlash } from './LapFlash/LapFlash';
import { DeltaWidget } from './DeltaWidget';
import { widgetDecorator } from '@/storybook/widgetDecorator';
import { withStore } from '../../../.storybook/decorators';

interface StoryArgs {
  delta: number;
}

const applyArgs = (
  stores: {
    computed: BackendComputedStore;
    widgetSettings: WidgetSettingsStore;
  },
  args: StoryArgs
) => {
  runInAction(() => {
    stores.widgetSettings.updateUserSettings('delta', {
      reference: 'personal_best',
      showLapFlash: false,
    });

    stores.computed.updateLapDelta({
      sectorTimes: [],
      currentSectorIdx: 0,
      sectorDeltas: [],
    } as LapDeltaFrame);
  });
};

const StoryHost = (args: StoryArgs) => {
  const computed = useBackendComputedStore();
  const widgetSettings = useWidgetSettingsStore();

  useLayoutEffect(() => {
    applyArgs({ computed, widgetSettings }, args);
  }, [args, computed, widgetSettings]);

  return <DeltaWidget />;
};

const meta: Meta<typeof StoryHost> = {
  title: 'Widgets/DeltaWidget',
  component: StoryHost,
  parameters: { layout: 'centered' },
  decorators: [
    withStore(),
    widgetDecorator({ display: 'inline-block', minWidth: 200 }),
  ],
  args: {
    delta: -0.342,
  },
};

export default meta;
type Story = StoryObj<typeof StoryHost>;

export const Ahead: Story = {};

export const Behind: Story = {
  args: { delta: 0.812 },
};

export const Neutral: Story = {
  args: { delta: 0 },
};

export const FlashAhead: StoryObj = {
  name: 'Flash: Ahead',
  render: () => (
    <LapFlash lapNum={12} lapTime={89.342} delta={-0.521} isBest={false} />
  ),
};

export const FlashBehind: StoryObj = {
  name: 'Flash: Behind',
  render: () => (
    <LapFlash lapNum={12} lapTime={91.123} delta={0.812} isBest={false} />
  ),
};

export const FlashNewBest: StoryObj = {
  name: 'Flash: New Best',
  render: () => <LapFlash lapNum={12} lapTime={89.342} delta={-1.235} isBest />,
};
