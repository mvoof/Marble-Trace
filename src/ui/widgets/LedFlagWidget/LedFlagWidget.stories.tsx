import type { Meta, StoryObj } from '@storybook/react-vite';

import type { FlagDisplaySettings } from '@/types/widget-settings';
import type { PreviewScenarioId } from '@/types/preview-scenarios';
import { LedFlagWidget } from './LedFlagWidget';
import {
  defineWidgetStories,
  previewScenario,
} from '@/storybook/define-widget-stories';

const DESIGN_SIZE = 300;

const SINGLE_LED_FRAME = { width: 200, height: 200 };
const SPLIT_FRAME = { width: 900, height: 300 };
const MEDIUM_FRAME = { width: 350, height: 350 };
const LARGE_FRAME = { width: 600, height: 600 };

// The matrix is laid out from the frame it is given, so a story states a flag
// and the box it has to fill together.
const flagAt = (
  flag: PreviewScenarioId,
  widgetFrame: { width: number; height: number }
) => ({ ...previewScenario(flag), widgetFrame });

interface StoryArgs {
  split: boolean;
  animate: boolean;
  forceSingleLed: boolean;
}

const meta: Meta<StoryArgs> = {
  title: 'Widgets/LedFlagWidget',
  ...defineWidgetStories<StoryArgs>({
    widget: LedFlagWidget,
    size: { width: DESIGN_SIZE, height: DESIGN_SIZE, background: '#111' },
    seed: (store, args) => {
      store.liveWidgets.updateUserSettings('led-flags', {
        ...store.liveWidgets.getSettings<FlagDisplaySettings>('led-flags'),
        split: args.split,
        animate: args.animate,
        forceSingleLed: args.forceSingleLed,
      });
    },
    args: { split: false, animate: true, forceSingleLed: false },
  }),
};

export default meta;
type Story = StoryObj<StoryArgs>;

// The panel with every bit down — what it shows for most of a race.
export const NoFlag: Story = {};

export const GreenFlag: Story = { parameters: previewScenario('green-flag') };
export const YellowFlag: Story = { parameters: previewScenario('yellow-flag') };
export const RedFlag: Story = { parameters: previewScenario('red-flag') };
export const BlueFlag: Story = { parameters: previewScenario('blue-flag') };
export const WhiteFlag: Story = { parameters: previewScenario('white-flag') };
export const CheckeredFlag: Story = {
  parameters: previewScenario('checkered-flag'),
};
export const BlackFlag: Story = { parameters: previewScenario('black-flag') };
export const MeatballFlag: Story = {
  parameters: previewScenario('meatball-flag'),
};
export const DebrisFlag: Story = { parameters: previewScenario('debris-flag') };
export const SafetyCar: Story = { parameters: previewScenario('safety-car') };
export const DqFlag: Story = { parameters: previewScenario('dq-flag') };

export const SafetyCarSingleLed: Story = {
  parameters: flagAt('safety-car', SINGLE_LED_FRAME),
  args: { forceSingleLed: true },
};

export const SafetyCarSplit: Story = {
  parameters: flagAt('safety-car', SPLIT_FRAME),
  args: { split: true },
};

export const DqFlagSplit: Story = {
  parameters: flagAt('dq-flag', SPLIT_FRAME),
  args: { split: true },
};

export const DqFlagSingleLed: Story = {
  parameters: flagAt('dq-flag', SINGLE_LED_FRAME),
  args: { forceSingleLed: true },
};

export const SplitAnimated: Story = {
  parameters: flagAt('yellow-flag', SPLIT_FRAME),
  args: { split: true },
};

export const SplitRedFlagAnimated: Story = {
  parameters: flagAt('red-flag', SPLIT_FRAME),
  args: { split: true },
};

// The same red flag at three sizes: the matrix is laid out from the frame, so
// what a driver has to see is how few LEDs are left at the small end.
export const SmallRedFlagAnimated: Story = {
  parameters: flagAt('red-flag', SINGLE_LED_FRAME),
};

export const MediumRedFlagAnimated: Story = {
  parameters: flagAt('red-flag', MEDIUM_FRAME),
};

export const LargeMatrixRedFlag: Story = {
  parameters: flagAt('red-flag', LARGE_FRAME),
};

export const SingleLedMax: Story = {
  parameters: flagAt('red-flag', LARGE_FRAME),
  args: { forceSingleLed: true },
};
