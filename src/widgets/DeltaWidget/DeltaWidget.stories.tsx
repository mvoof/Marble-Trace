import { useLayoutEffect } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { runInAction } from 'mobx';

import type { LapDeltaFrame } from '@/types/bindings';
import type { BackendComputedStore } from '@store/iracing/computed.store';
import type { WidgetSettingsStore } from '@store/widget-settings.store';
import type { LapTimePosition } from '@/types/widget-settings';
import {
  useBackendComputedStore,
  useWidgetSettingsStore,
} from '@store/root-store-context';
import { DeltaLive } from './DeltaLive/DeltaLive';
import { LapFlash } from './LapFlash/LapFlash';
import { DeltaWidget } from './DeltaWidget';
import { widgetDecorator } from '@/storybook/widgetDecorator';
import { withStore } from '../../../.storybook/decorators';
import stylesModule from './DeltaWidget.module.scss';

const styles = stylesModule as Record<string, string>;

interface StoryArgs {
  delta: number;
  lapTimePosition: LapTimePosition;
}

const applyArgs = (
  stores: {
    computed: BackendComputedStore;
    widgetSettings: WidgetSettingsStore;
  },
  args: StoryArgs
) => {
  runInAction(() => {
    stores.widgetSettings.updateUserSettings('delta', {
      reference: 'personal_best',
      lapTimePosition: args.lapTimePosition,
    });

    stores.computed.updateLapDelta({
      sectorTimes: [],
      currentSectorIdx: 0,
      sectorDeltas: [],
    } as LapDeltaFrame);
  });
};

const StoryHost = (args: StoryArgs) => {
  const computed = useBackendComputedStore();
  const widgetSettings = useWidgetSettingsStore();

  useLayoutEffect(() => {
    applyArgs({ computed, widgetSettings }, args);
  }, [args, computed, widgetSettings]);

  return <DeltaWidget />;
};

const POSITION_CLASS: Record<LapTimePosition, string> = {
  none: '',
  top: styles.flashTop,
  bottom: styles.flashBottom,
  left: styles.flashLeft,
  right: styles.flashRight,
};

// Shows delta + flash card together in the chosen position
const FlashPreview = ({
  delta,
  position,
  isBest = false,
}: {
  delta: number;
  position: LapTimePosition;
  isBest?: boolean;
}) => {
  const computed = useBackendComputedStore();
  const widgetSettings = useWidgetSettingsStore();

  useLayoutEffect(() => {
    runInAction(() => {
      widgetSettings.updateUserSettings('delta', {
        reference: 'personal_best',
        lapTimePosition: position,
      });
      computed.updateLapDelta({
        sectorTimes: [],
        currentSectorIdx: 0,
        sectorDeltas: [],
      } as LapDeltaFrame);
    });
  }, [delta, position, computed, widgetSettings]);

  return (
    <div className={styles.root}>
      <div className={`${styles.flash} ${POSITION_CLASS[position]}`}>
        <LapFlash lapNum={12} lapTime={89.342} delta={delta} isBest={isBest} />
      </div>
      <DeltaLive />
    </div>
  );
};

const meta: Meta<typeof StoryHost> = {
  title: 'Widgets/DeltaWidget',
  component: StoryHost,
  parameters: { layout: 'centered' },
  decorators: [
    withStore(),
    widgetDecorator({ display: 'inline-block', minWidth: 200 }),
  ],
  args: {
    delta: -0.342,
    lapTimePosition: 'none',
  },
  argTypes: {
    lapTimePosition: {
      control: 'select',
      options: ['none', 'top', 'bottom', 'left', 'right'],
    },
  },
};

export default meta;
type Story = StoryObj<typeof StoryHost>;

export const Ahead: Story = {};

export const Behind: Story = {
  args: { delta: 0.812 },
};

export const Neutral: Story = {
  args: { delta: 0 },
};

export const FlashBottom: StoryObj = {
  name: 'Flash: Bottom',
  render: () => <FlashPreview delta={-0.521} position="bottom" />,
};

export const FlashTop: StoryObj = {
  name: 'Flash: Top',
  render: () => <FlashPreview delta={-0.521} position="top" />,
};

export const FlashLeft: StoryObj = {
  name: 'Flash: Left',
  render: () => <FlashPreview delta={0.812} position="left" />,
};

export const FlashRight: StoryObj = {
  name: 'Flash: Right',
  render: () => <FlashPreview delta={-0.521} position="right" />,
};

export const FlashNewBest: StoryObj = {
  name: 'Flash: New Best (Bottom)',
  render: () => <FlashPreview delta={-1.235} position="bottom" isBest />,
};
