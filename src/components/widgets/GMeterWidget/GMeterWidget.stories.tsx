import { useEffect } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { runInAction } from 'mobx';

import { widgetSettingsStore } from '../../../store/widget-settings.store';
import type {
  GMeterColorMode,
  GMeterDisplayMode,
} from '../../../types/widget-settings';
import { GMeterWidget } from './GMeterWidget';
import { widgetDecorator } from '../../../stories/widgetDecorator';

interface StoryArgs {
  displayMode: GMeterDisplayMode;
  scale: 2 | 3 | 4 | 5;
  colorMode: GMeterColorMode;
}

const StoryHost = (args: StoryArgs) => {
  useEffect(() => {
    runInAction(() => {
      widgetSettingsStore.updateUserSettings('g-meter', {
        displayMode: args.displayMode,
        scale: args.scale,
        colorMode: args.colorMode,
      });
    });
  }, [args]);

  return <GMeterWidget />;
};

const meta: Meta<typeof StoryHost> = {
  title: 'Widgets/GMeter',
  component: StoryHost,
  parameters: { layout: 'centered' },
  decorators: [
    widgetDecorator({
      width: 240,
      height: 280,
      background: 'radial-gradient(circle, #252525 0%, #14141b 100%)',
    }),
  ],
  args: {
    displayMode: 'fading',
    scale: 4,
    colorMode: 'advanced',
  },
};

export default meta;
type Story = StoryObj<typeof StoryHost>;

export const Default: Story = {};

export const TrailMono: Story = {
  args: { displayMode: 'trail', scale: 3, colorMode: 'mono' },
};

export const PeakSimple: Story = {
  args: { displayMode: 'peak', scale: 2, colorMode: 'simple' },
};
