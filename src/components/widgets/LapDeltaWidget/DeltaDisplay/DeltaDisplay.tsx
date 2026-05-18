import { observer } from 'mobx-react-lite';

import { computedStore } from '../../../../store/iracing/computed.store';
import { widgetSettingsStore } from '../../../../store/widget-settings.store';
import {
  formatDelta,
  getDeltaState,
  type DeltaState,
} from '../lap-delta-utils';

import styles from './DeltaDisplay.module.scss';

const DELTA_STATE_CLASS: Record<DeltaState, string> = {
  ahead: styles.deltaAhead,
  behind: styles.deltaBehind,
  neutral: styles.deltaNeutral,
};

interface DeltaDisplayProps {
  isHorizontal: boolean;
}

export const DeltaDisplay = observer(({ isHorizontal }: DeltaDisplayProps) => {
  const { reference } = widgetSettingsStore.getLapDeltaSettings();
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
