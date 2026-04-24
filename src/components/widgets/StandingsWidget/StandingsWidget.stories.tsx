import type { Meta, StoryObj } from '@storybook/react-vite';

import { StandingsWidget } from './StandingsWidget';
import { WidgetScaler } from '../../WidgetScaler';
import { computeClassSof } from './standings-utils';
import { computeDriverEntries } from '../../../storybook/compute-driver-entries';
import type { StandingsWidgetSettings } from '../../../types/widget-settings';
import type { TelemetrySnapshot } from '../../../storybook/snapshot.types';
import snapshot from '../../../../test-data/iracing-1776008424511.json';

const DESIGN_WIDTH = 750;
const DESIGN_HEIGHT = 400;

const realSnapshot = snapshot as TelemetrySnapshot;

const DEFAULT_SETTINGS: StandingsWidgetSettings = {
  filterMode: 'all',
  groupByClass: true,
  showPosChange: true,
  showColumnHeaders: true,
  showSessionHeader: true,
  showWeather: true,
  showSOF: true,
  showTotalDrivers: true,
  showBrand: true,
  showTire: true,
  showIrChange: false,
  showPitStops: true,
};

interface StandingsStoryArgs extends StandingsWidgetSettings {
  snapshot: TelemetrySnapshot;
}

const StandingsWidgetStory = ({
  snapshot: snap,
  ...settings
}: StandingsStoryArgs) => {
  const driverEntries = computeDriverEntries(
    snap.carIdx,
    snap.sessionInfo?.DriverInfo ?? null
  );
  const overallSof = computeClassSof(driverEntries);
  const irDeltaMap = new Map<number, number>();

  return (
    <div style={{ width: DESIGN_WIDTH, height: DESIGN_HEIGHT }}>
      <WidgetScaler
        designWidth={DESIGN_WIDTH}
        designHeight={DESIGN_HEIGHT}
        background="radial-gradient(circle, #0a0a0f 0%, #050508 100%)"
        adaptive
      >
        <StandingsWidget
          driverEntries={driverEntries}
          settings={settings}
          irDeltaMap={irDeltaMap}
          playerPitStops={0}
          sessionInfo={snap.sessionInfo}
          weekendInfo={snap.sessionInfo?.WeekendInfo ?? null}
          overallSof={overallSof}
        />
      </WidgetScaler>
    </div>
  );
};

const meta: Meta<StandingsStoryArgs> = {
  title: 'Widgets/StandingsWidget',
  component: StandingsWidgetStory,
  parameters: {
    layout: 'centered',
  },
  args: {
    ...DEFAULT_SETTINGS,
    snapshot: realSnapshot,
  },
};

export default meta;

type Story = StoryObj<StandingsStoryArgs>;

export const Default: Story = {};

export const NoGrouping: Story = {
  args: { groupByClass: false },
};

export const FullFeatures: Story = {
  args: { showIrChange: true },
};

export const Minimal: Story = {
  args: {
    showSessionHeader: false,
    showWeather: false,
    showSOF: false,
    showTotalDrivers: false,
    showBrand: false,
    showTire: false,
    showPitStops: false,
    showIrChange: false,
    showPosChange: false,
  },
};

export const NoData: Story = {
  args: {
    snapshot: {
      capturedAt: new Date().toISOString(),
      carDynamics: null,
      carIdx: null,
      carInputs: null,
      carStatus: null,
      environment: null,
      lapTiming: null,
      session: null,
      sessionInfo: null,
    },
  },
};
