import { useLayoutEffect } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { runInAction } from 'mobx';

import type { ProximityFrame, RadarDistances } from '@/types/bindings';
import type { BackendComputedStore } from '@store/iracing/computed.store';
import type { WidgetSettingsStore } from '@store/widget-settings.store';
import type { AppSettingsStore } from '@store/app-settings.store';
import {
  useAppSettingsStore,
  useBackendComputedStore,
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
}

const applyArgs = (
  stores: {
    computed: BackendComputedStore;
    widgetSettings: WidgetSettingsStore;
    appSettings: AppSettingsStore;
  },
  args: StoryArgs
) => {
  runInAction(() => {
    stores.appSettings.dragMode = true;

    stores.widgetSettings.updateUserSettings('radar-bar', {
      proximityThreshold: 3,
      hideDelay: 2,
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
  const computed = useBackendComputedStore();
  const widgetSettings = useWidgetSettingsStore();
  const appSettings = useAppSettingsStore();

  useLayoutEffect(() => {
    applyArgs({ computed, widgetSettings, appSettings }, args);
  }, [args, computed, widgetSettings, appSettings]);

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
