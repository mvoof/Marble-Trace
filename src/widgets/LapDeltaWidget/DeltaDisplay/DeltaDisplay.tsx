import { observer } from 'mobx-react-lite';

import {
  formatDelta,
  getDeltaState,
  type DeltaState,
} from '@utils/widget/lap-delta-utils';

import type { LapDeltaWidgetSettings } from '@/types/widget-settings';
import styles from './DeltaDisplay.module.scss';
import {
  useComputedStore,
  useWidgetSettingsStore,
} from '@store/root-store-context';

const DELTA_STATE_CLASS: Record<DeltaState, string> = {
  ahead: styles.deltaAhead,
  behind: styles.deltaBehind,
  neutral: styles.deltaNeutral,
};

export const DeltaDisplay = observer(() => {
  const computed = useComputedStore();
  const widgetSettings = useWidgetSettingsStore();

  const { reference, layout } =
    widgetSettings.getSettings<LapDeltaWidgetSettings>('lap-delta');
  const isHorizontal = layout === 'horizontal';
  const isSession = reference === 'session_best';

  const delta = isSession
    ? (computed.lapDelta?.sessionBestTotal ?? 0)
    : (computed.lapDelta?.personalBestTotal ?? 0);

  const state = getDeltaState(delta);

  const className = [
    styles.delta,
    DELTA_STATE_CLASS[state],
    isHorizontal ? styles.deltaHorizontal : '',
  ]
    .filter(Boolean)
    .join(' ');

  return <div className={className}>{formatDelta(delta)}</div>;
});
