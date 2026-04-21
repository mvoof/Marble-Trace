import type { Meta, StoryObj } from '@storybook/react-vite';

import { RelativeWidget } from './RelativeWidget';
import { WidgetScaler } from '../../WidgetScaler';
import { computeDriverEntries, sortByRelativeLapDist } from '../widget-utils';
import type { DriverEntry } from '../widget-utils';
import type { RelativeWidgetSettings } from '../../../store/widget-settings.store';
import type { TelemetrySnapshot } from '../../../storybook/snapshot.types';
import snapshot from '../../../../test-data/iracing-1776008424511.json';

const DESIGN_WIDTH = 420;
const DESIGN_HEIGHT = 400;

const realSnapshot = snapshot as TelemetrySnapshot;

const DEFAULT_SETTINGS: RelativeWidgetSettings = {
  showIRatingBadge: true,
  showClassBadge: true,
  showPitIndicator: true,
};

interface RelativeStoryArgs extends RelativeWidgetSettings {
  snapshot: TelemetrySnapshot;
}

const RelativeWidgetStory = ({
  snapshot: snap,
  ...settings
}: RelativeStoryArgs) => {
  const playerCarIdx = snap.sessionInfo?.DriverInfo?.DriverCarIdx ?? -1;
  const entries: DriverEntry[] = sortByRelativeLapDist(
    computeDriverEntries(snap.carIdx, snap.sessionInfo?.DriverInfo ?? null),
    playerCarIdx
  );

  return (
    <div style={{ width: DESIGN_WIDTH, height: DESIGN_HEIGHT }}>
      <WidgetScaler
        designWidth={DESIGN_WIDTH}
        designHeight={DESIGN_HEIGHT}
        background="radial-gradient(circle, #0a0a0f 0%, #050508 100%)"
        adaptive
      >
        <RelativeWidget entries={entries} settings={settings} />
      </WidgetScaler>
    </div>
  );
};

const meta: Meta<RelativeStoryArgs> = {
  title: 'Widgets/RelativeWidget',
  component: RelativeWidgetStory,
  parameters: {
    layout: 'centered',
  },
  args: {
    snapshot: realSnapshot,
    ...DEFAULT_SETTINGS,
  },
};

export default meta;

type Story = StoryObj<RelativeStoryArgs>;

export const Default: Story = {};

export const NoBadges: Story = {
  args: {
    showClassBadge: false,
    showIRatingBadge: false,
  },
};

export const NoPitIndicator: Story = {
  args: { showPitIndicator: false },
};

export const Minimal: Story = {
  args: {
    showClassBadge: false,
    showIRatingBadge: false,
    showPitIndicator: false,
  },
};

export const NoData: Story = {
  args: {
    snapshot: {
      carIdx: null,
      sessionInfo: null,
      carDynamics: null,
      carInputs: null,
      carStatus: null,
      lapTiming: null,
      session: null,
      environment: null,
    } as unknown as TelemetrySnapshot,
  },
};
