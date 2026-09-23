import type { Meta, StoryObj } from '@storybook/react-vite';

import type { UnitSystem } from '@/types';
import type { WheelToWheelWidgetSettings } from '@/types/widget-settings';
import { WheelToWheelWidget } from './WheelToWheelWidget';
import {
  defineWidgetStories,
  previewScenario,
} from '@/storybook/define-widget-stories';

interface StoryArgs {
  unitSystem: UnitSystem;
  dragMode: boolean;
}

/** Wide enough that the snapshot's nearest class rival is always inside. */
const STORY_GAP_THRESHOLD_S = 3;

const meta: Meta<StoryArgs> = {
  title: 'Widgets/WheelToWheelWidget',
  ...defineWidgetStories<StoryArgs>({
    widget: WheelToWheelWidget,
    size: { width: 620, height: 130, background: '#0e0f12' },
    seedSnapshot: true,
    seed: (store, args) => {
      const settings: Partial<WheelToWheelWidgetSettings> = {
        // The widget is normally armed only during a race and only for a close
        // rival; the stories want a fight on screen whatever the snapshot is.
        gapThreshold: STORY_GAP_THRESHOLD_S,
        raceOnly: false,
      };

      store.liveWidgets.updateUserSettings('wheel-to-wheel', settings);
      store.units.setSystem(args.unitSystem);
      store.appSettings.dragMode = args.dragMode;
    },
    args: {
      unitSystem: 'metric',
      dragMode: false,
    },
  }),
};

export default meta;
type Story = StoryObj<StoryArgs>;

export const InTheFight: Story = {
  parameters: previewScenario('field-close-pack'),
};

export const Imperial: Story = {
  parameters: previewScenario('field-close-pack'),
  args: { unitSystem: 'imperial' },
};
