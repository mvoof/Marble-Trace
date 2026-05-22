import { useLayoutEffect } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { runInAction } from 'mobx';

import type { ProximityFrame, RadarDistances } from '@/types/bindings';
import type { RadarSettings } from '@/types/widget-settings';
import type { ComputedStore } from '@store/iracing/computed.store';
import type { WidgetSettingsStore } from '@store/widget-settings.store';
import {
  useComputedStore,
  useWidgetSettingsStore,
} from '@store/root-store-context';
import { RadarBarWidget } from './RadarBarWidget';
import { widgetDecorator } from '@/storybook/widgetDecorator';
import { withStore } from '../../../.storybook/decorators';

const DESIGN_WIDTH = 800;
const DESIGN_HEIGHT = 380;

interface StoryArgs {
  radarDistances: RadarDistances;
  spotterLeft: boolean;
  spotterRight: boolean;
  barDisplayMode: RadarSettings['barDisplayMode'];
}

const applyArgs = (
  stores: { computed: ComputedStore; widgetSettings: WidgetSettingsStore },
  args: StoryArgs
) => {
  runInAction(() => {
    stores.widgetSettings.updateUserSettings('radar-bar', {
      visibilityMode: 'always',
      proximityThreshold: 3,
      hideDelay: 2,
      barDisplayMode: args.barDisplayMode,
    });

    stores.computed.updateProximity({
      radarDistances: args.radarDistances,
      spotterLeft: args.spotterLeft,
      spotterRight: args.spotterRight,
      nearbyCars: [],
    } as unknown as ProximityFrame);
  });
};

const StoryHost = (args: StoryArgs) => {
  const computed = useComputedStore();
  const widgetSettings = useWidgetSettingsStore();

  useLayoutEffect(() => {
    applyArgs({ computed, widgetSettings }, args);
  }, [args, computed, widgetSettings]);

  return <RadarBarWidget />;
};

const meta: Meta<typeof StoryHost> = {
  title: 'Widgets/RadarBarWidget',
  component: StoryHost,
  parameters: { layout: 'centered' },
  decorators: [
    withStore(),
    widgetDecorator({ width: DESIGN_WIDTH, height: DESIGN_HEIGHT }),
  ],
  args: {
    radarDistances: {
      frontDist: 999,
      rearDist: 999,
      leftDist: null,
      rightDist: null,
    },
    spotterLeft: false,
    spotterRight: false,
    barDisplayMode: 'both',
  },
};

export default meta;
type Story = StoryObj<typeof StoryHost>;

export const Default: Story = {};

export const CarLeft: Story = {
  args: {
    radarDistances: {
      frontDist: 999,
      rearDist: 999,
      leftDist: 1.2,
      rightDist: null,
    },
    spotterLeft: true,
  },
};

export const CarRight: Story = {
  args: {
    radarDistances: {
      frontDist: 999,
      rearDist: 999,
      leftDist: null,
      rightDist: 0.8,
    },
    spotterRight: true,
  },
};

export const ActiveOnly: Story = {
  args: {
    radarDistances: {
      frontDist: 999,
      rearDist: 999,
      leftDist: 1.0,
      rightDist: null,
    },
    spotterLeft: true,
    barDisplayMode: 'active-only',
  },
};

export const BothSides: Story = {
  args: {
    radarDistances: {
      frontDist: 999,
      rearDist: 999,
      leftDist: 1.5,
      rightDist: 0.8,
    },
    spotterLeft: true,
    spotterRight: true,
  },
};

export const VeryClose: Story = {
  args: {
    radarDistances: {
      frontDist: 999,
      rearDist: 999,
      leftDist: 0.3,
      rightDist: null,
    },
    spotterLeft: true,
  },
};
