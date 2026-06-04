import { useLayoutEffect } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { runInAction } from 'mobx';

import type { LapDeltaFrame } from '@/types/bindings';
import type { BackendComputedStore } from '@store/iracing/computed.store';
import type { LapStore } from '@store/iracing/lap.store';
import type { TelemetryStore } from '@store/iracing/telemetry.store';
import type { WidgetSettingsStore } from '@store/widget-settings.store';
import {
  useBackendComputedStore,
  useLapStore,
  useTelemetryStore,
  useWidgetSettingsStore,
} from '@store/root-store-context';
import { LapFlash } from './LapFlash/LapFlash';
import { DeltaWidget } from './DeltaWidget';
import { widgetDecorator } from '@/storybook/widgetDecorator';
import { withStore } from '../../../.storybook/decorators';

const applyStores = (stores: {
  computed: BackendComputedStore;
  widgetSettings: WidgetSettingsStore;
}) => {
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

const StoryHost = () => {
  const computed = useBackendComputedStore();
  const widgetSettings = useWidgetSettingsStore();

  useLayoutEffect(() => {
    applyStores({ computed, widgetSettings });
  }, [computed, widgetSettings]);

  return <DeltaWidget />;
};

const applyBestLapStores = (stores: {
  computed: BackendComputedStore;
  widgetSettings: WidgetSettingsStore;
  lap: LapStore;
  telemetry: TelemetryStore;
}) => {
  runInAction(() => {
    stores.widgetSettings.updateUserSettings('delta', {
      reference: 'personal_best',
      showLapFlash: true,
      flashDuration: 999,
    });

    stores.computed.updateLapDelta({
      sectorTimes: [],
      currentSectorIdx: 0,
      sectorDeltas: [],
    } as LapDeltaFrame);

    stores.lap.lastCompletedLap = { lapNum: 5, delta: -1.235 };
    stores.lap.history = [
      {
        lapNum: 5,
        lapTime: 89.342,
        delta: -1.235,
        isBest: true,
      },
    ];

    stores.telemetry.lapTiming = {
      ...(stores.telemetry.lapTiming ?? {}),
      lap_last_lap_time: 89.342,
      lap_best_lap_time: 89.342,
    } as typeof stores.telemetry.lapTiming;
  });
};

const BestLapHost = () => {
  const computed = useBackendComputedStore();
  const widgetSettings = useWidgetSettingsStore();
  const lap = useLapStore();
  const telemetry = useTelemetryStore();

  useLayoutEffect(() => {
    applyBestLapStores({ computed, widgetSettings, lap, telemetry });
  }, [computed, widgetSettings, lap, telemetry]);

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
};

export default meta;
type Story = StoryObj<typeof StoryHost>;

export const Default: Story = {};

export const BestLap: StoryObj = {
  name: 'Best Lap Flash',
  render: () => <BestLapHost />,
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
