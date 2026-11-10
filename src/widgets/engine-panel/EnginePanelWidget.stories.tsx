import type { Meta, StoryObj } from '@storybook/react-vite';

import type { CarStatusFrame } from '@shared/contracts/generated/bindings';
import type { UnitSystem } from '@shared/contracts/domain';
import {
  mockCarStatus,
  mockHybridCarStatus,
} from '@features/preview/mocks/engine';
import { mockCarInputs } from '@features/preview/mocks/inputs';
import { whenSet } from '@/storybook/story-overrides';
import { EnginePanelWidget } from './EnginePanelWidget';
import type { HorizontalRows } from './settings-schema';
import {
  defineWidgetStories,
  previewScenario,
} from '@/storybook/define-widget-stories';

interface StoryArgs {
  system: UnitSystem;
  /**
   * Which car is in the pit box. A GT3 declares four in-car adjustments, a
   * formula car eleven — and the panel carries exactly what the car declares,
   * so this knob is the one that shows the cell list reflowing.
   */
  car: 'gt3' | 'formula';
  /**
   * The gauges. Left undefined — which is what a story naming a scenario does —
   * the scenario's own reading is kept, so a knob states a difference rather
   * than replacing the frame.
   */
  oilTemp?: number;
  waterTemp?: number;
  oilPress?: number;
  absActive: boolean;

  showOilTemp: boolean;
  showWaterTemp: boolean;
  showOilPress: boolean;
  showVoltage: boolean;
  showAbs: boolean;
  showTc: boolean;
  showBrakeBias: boolean;
  showEngineMap: boolean;
  horizontal: boolean;
  horizontalRows: HorizontalRows;
}

const meta: Meta<StoryArgs> = {
  title: 'Widgets/EnginePanelWidget',
  ...defineWidgetStories<StoryArgs>({
    widget: EnginePanelWidget,
    // No height: the panel is autoHeight and sizes itself from its rows.
    size: { width: 480 },
    seedSnapshot: true,
    seed: (store, args, scenarioId) => {
      store.units.setSystem(args.system);

      store.player.updateCarInputs(
        mockCarInputs({ brake_abs_active: args.absActive })
      );

      const gauges: Partial<CarStatusFrame> = {
        ...whenSet(args.oilTemp, (oil_temp) => ({ oil_temp })),
        ...whenSet(args.waterTemp, (water_temp) => ({ water_temp })),
        ...whenSet(args.oilPress, (oil_press) => ({ oil_press })),
      };

      // The recorded snapshot was captured in the garage, with every
      // temperature, pressure and in-car adjustment still at zero. A story with
      // no scenario under it states the builder's warm engine instead of
      // patching that; one with a scenario leaves the scenario's own panel be.
      if (!scenarioId) {
        const build =
          args.car === 'formula' ? mockHybridCarStatus : mockCarStatus;
        store.player.updateCarStatus(build(gauges));
      }

      store.liveWidgets.updateUserSettings('engine-panel', {
        showOilTemp: args.showOilTemp,
        showWaterTemp: args.showWaterTemp,
        showOilPress: args.showOilPress,
        showVoltage: args.showVoltage,
        showAbs: args.showAbs,
        showTc: args.showTc,
        showBrakeBias: args.showBrakeBias,
        showEngineMap: args.showEngineMap,
        showTc2: true,
        showEngineBraking: true,
        showBrakeBiasFine: true,
        showPeakBrakeBias: true,
        showDiffEntry: true,
        showDiffMiddle: true,
        showDiffExit: true,
        highlightChanges: true,
        horizontal: args.horizontal,
        horizontalRows: args.horizontalRows,
      });
    },
    args: {
      system: 'metric',
      car: 'gt3',
      oilTemp: 110,
      waterTemp: 90,
      oilPress: 350,
      absActive: false,

      showOilTemp: true,
      showWaterTemp: true,
      showOilPress: true,
      showVoltage: true,
      showAbs: true,
      showTc: true,
      showBrakeBias: true,
      showEngineMap: true,
      horizontal: true,
      horizontalRows: 'auto',
    },
    argTypes: {
      horizontalRows: { control: 'inline-radio', options: ['auto', 1, 2, 3] },
    },
  }),
};

export default meta;
type Story = StoryObj<StoryArgs>;

export const Default: Story = {};

/** Every in-car adjustment a formula car exposes, on the same grid. */
export const FormulaCar: Story = {
  args: {
    car: 'formula',
  },
};

export const Imperial: Story = {
  args: {
    system: 'imperial',
  },
};

export const ABSActive: Story = {
  args: {
    absActive: true,
  },
};

// The two overheats are separate scenarios because a panel that reads well with
// one cell flashing can be unreadable with two.
export const OilOverheat: Story = {
  parameters: previewScenario('engine-oil-overheat'),
};

export const WaterOverheat: Story = {
  parameters: previewScenario('engine-water-overheat'),
};

export const Stalled: Story = {
  parameters: previewScenario('engine-stalled'),
};

export const MinimalLayout: Story = {
  args: {
    showOilPress: false,
    showVoltage: false,
    showEngineMap: false,
  },
};

/**
 * Brake bias, traction control and ABS alone: one strip, not a lone bias
 * stretched over the two below it.
 */
export const BiasTcAbs: Story = {
  args: {
    showOilTemp: false,
    showWaterTemp: false,
    showOilPress: false,
    showVoltage: false,
    showEngineMap: false,
  },
};

/** Variant A: one tier per system. */
export const Vertical: Story = {
  args: {
    horizontal: false,
  },
  parameters: { widgetFrame: { width: 300 } },
};

export const VerticalFormulaCar: Story = {
  args: {
    car: 'formula',
    horizontal: false,
  },
  parameters: { widgetFrame: { width: 360 } },
};

export const FormulaCarThreeRows: Story = {
  args: {
    car: 'formula',
    horizontalRows: 3,
  },
};
