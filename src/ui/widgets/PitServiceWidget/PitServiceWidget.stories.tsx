import type { Meta, StoryObj } from '@storybook/react-vite';

import type { PitServiceFrame } from '@/types/bindings';
import type { PitServiceWidgetSettings } from '@/types/widget-settings';
import { mockFuel } from '@store/preview/mocks/fuel';
import {
  mockChassis,
  mockPitService,
  mockPitTarget,
} from '@store/preview/mocks/pit';
import { whenSet } from '@/storybook/story-overrides';
import { PitServiceWidget } from './PitServiceWidget';
import {
  defineWidgetStories,
  previewScenario,
} from '@/storybook/define-widget-stories';

interface StoryArgs {
  /**
   * The stop. Left undefined — which is what a story naming a scenario does —
   * the scenario's own order is kept, so a knob states a difference rather than
   * replacing the frame.
   */
  towTimeS?: number;
  fuelOrdered?: number;
  fuelCalculated?: number;
  repairLeftS?: number;
  optRepairLeftS?: number;
  changeFronts?: boolean;
  changeRears?: boolean;
  inPitStall?: boolean;
  distToBoxM?: number;

  showFooter: boolean;
}

// Only the knobs a story actually turned reach the frame; everything else is
// left to the scenario or the snapshot underneath.
const serviceOverrides = (args: StoryArgs): Partial<PitServiceFrame> => ({
  ...whenSet(args.changeFronts, (change) => ({
    changeLf: change,
    changeRf: change,
  })),
  ...whenSet(args.changeRears, (change) => ({
    changeLr: change,
    changeRr: change,
  })),
  ...whenSet(args.fuelOrdered, (fuel) => ({
    addFuel: fuel > 0,
    fuelAmount: fuel,
  })),
  ...whenSet(args.repairLeftS, (repairLeftS) => ({ repairLeftS })),
  ...whenSet(args.optRepairLeftS, (optRepairLeftS) => ({ optRepairLeftS })),
  ...whenSet(args.towTimeS, (towTimeS) => ({ towTimeS })),
  // Standing in the box is what puts the crew to work, so the two move together.
  ...whenSet(args.inPitStall, (inPitStall) => ({
    inPitStall,
    serviceActive: inPitStall,
  })),
});

const meta: Meta<StoryArgs> = {
  title: 'Widgets/PitServiceWidget',
  ...defineWidgetStories<StoryArgs>({
    widget: PitServiceWidget,
    size: { width: 235, height: 280 },
    seedSnapshot: true,
    seed: (store, args) => {
      // A stint's worth of wear, so the tire block is sized against the spread
      // it carries at the end of a run rather than the near-new baseline.
      store.player.updateChassis(mockChassis());

      const service = serviceOverrides(args);

      if (Object.keys(service).length > 0) {
        store.player.updatePitService(
          mockPitService({ ...store.player.pitService, ...service })
        );
      }

      if (args.distToBoxM !== undefined) {
        store.player.updatePitTarget(mockPitTarget({ distM: args.distToBoxM }));
      }

      if (args.fuelCalculated !== undefined) {
        store.backendComputed.updateFuel(
          mockFuel({
            ...store.backendComputed.fuel,
            fuelToAdd: args.fuelCalculated,
          })
        );
      }

      store.liveWidgets.updateUserSettings('pit-service', {
        ...store.liveWidgets.getSettings<PitServiceWidgetSettings>(
          'pit-service'
        ),
        showFooter: args.showFooter,
        alwaysVisible: true,
      });
    },
    args: {
      showFooter: true,
    },
    argTypes: {
      distToBoxM: { control: { type: 'range', min: 0, max: 350, step: 5 } },
    },
  }),
};

export default meta;
type Story = StoryObj<StoryArgs>;

// Rolling down the lane with the stop already ordered and nothing happening yet.
export const Armed: Story = {
  parameters: previewScenario('pit-limiter'),
};

// Stopped in the box with every corner ordered and the fuel going in — the only
// state that lights the whole panel at once.
export const Servicing: Story = {
  parameters: previewScenario('pit-service'),
};

export const RepairsUnderWay: Story = {
  parameters: previewScenario('pit-service'),
  args: { repairLeftS: 12.4, optRepairLeftS: 8, changeRears: false },
};

// A fill the driver typed in rather than the one the calculation asked for, so
// the two numbers disagree on screen.
export const ManualFuelOrder: Story = {
  parameters: previewScenario('pit-service'),
  args: { fuelOrdered: 40, fuelCalculated: 34.2 },
};

// On the hook with both repair clocks still running: the three countdowns the
// box can carry at once, which is the tallest it ever gets.
export const Towing: Story = {
  parameters: previewScenario('pit-tow'),
};

export const FooterOff: Story = {
  parameters: previewScenario('pit-service'),
  args: { showFooter: false },
};
