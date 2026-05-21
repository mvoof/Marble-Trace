import { observer } from 'mobx-react-lite';

import { computedStore } from '@store/iracing/computed.store';
import { widgetSettingsStore } from '@store/widget-settings.store';
import {
  formatDelta,
  getDeltaState,
  type DeltaState,
} from '@utils/widget/lap-delta-utils';

import styles from './DeltaDisplay.module.scss';

const DELTA_STATE_CLASS: Record<DeltaState, string> = {
  ahead: styles.deltaAhead,
  behind: styles.deltaBehind,
  neutral: styles.deltaNeutral,
};

export const DeltaDisplay = observer(() => {
  const { reference, layout } = widgetSettingsStore.getLapDeltaSettings();
  const isHorizontal = layout === 'horizontal';
  const isSession = reference === 'session_best';

  const delta = isSession
    ? (computedStore.lapDelta?.sessionBestTotal ?? 0)
    : (computedStore.lapDelta?.personalBestTotal ?? 0);

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
