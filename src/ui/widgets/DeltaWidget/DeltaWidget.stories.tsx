import type { Meta, StoryObj } from '@storybook/react-vite';

import type {
  DeltaWidgetSettings,
  LapDeltaReference,
} from '@/types/widget-settings';
import { LapFlash } from './LapFlash/LapFlash';
import { DeltaWidget } from './DeltaWidget';
import {
  defineWidgetStories,
  previewScenario,
} from '@/storybook/define-widget-stories';

/** Long enough that the flash is still up while the story is being looked at. */
const HELD_FLASH_S = 999;

interface StoryArgs {
  reference: LapDeltaReference;
  showLapFlash: boolean;
}

const meta: Meta<StoryArgs> = {
  title: 'Widgets/DeltaWidget',
  ...defineWidgetStories<StoryArgs>({
    widget: DeltaWidget,
    size: { width: 200, height: 100 },
    seed: (store, args) => {
      store.liveWidgets.updateUserSettings('delta', {
        ...store.liveWidgets.getSettings<DeltaWidgetSettings>('delta'),
        reference: args.reference,
        showLapFlash: args.showLapFlash,
        flashDuration: HELD_FLASH_S,
      });
    },
    args: { reference: 'personal_best', showLapFlash: false },
    argTypes: {
      reference: {
        control: 'select',
        options: [
          'personal_best',
          'personal_optimal',
          'session_best',
          'session_optimal',
          'session_last',
        ] satisfies LapDeltaReference[],
      },
    },
  }),
};

export default meta;
type Story = StoryObj<StoryArgs>;

export const Default: Story = {
  parameters: previewScenario('delta-ahead'),
};

export const Behind: Story = {
  parameters: previewScenario('delta-behind'),
};

// The lap has just been banked as a best, which is the only state the flash is
// raised in — the widget swaps the live number for it.
export const BestLap: Story = {
  name: 'Best Lap Flash',
  parameters: previewScenario('delta-personal-best'),
  args: { showLapFlash: true },
};

// The flash on its own, at each of the four shapes it draws. It takes what it
// prints as props, so these stories need no store behind them.
export const FlashCloseToBest: Story = {
  name: 'Flash: Close To Best',
  render: () => (
    <LapFlash lapTime={89.526} personalDelta={0.184} isBest={false} preview />
  ),
};

export const FlashBehind: Story = {
  name: 'Flash: Behind',
  render: () => (
    <LapFlash lapTime={91.123} personalDelta={1.965} isBest={false} preview />
  ),
};

export const FlashNewBest: Story = {
  name: 'Flash: New Best',
  render: () => (
    <LapFlash lapTime={89.342} personalDelta={-0.341} isBest preview />
  ),
};

export const FlashFirstLap: Story = {
  name: 'Flash: First Lap (no reference)',
  render: () => (
    <LapFlash lapTime={92.014} personalDelta={null} isBest preview />
  ),
};
