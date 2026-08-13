import { observer } from 'mobx-react-lite';

import { WidgetPanel } from '@/components/WidgetPanel/WidgetPanel';
import { usePitState } from '@hooks/usePitState';

import { PitBlock } from './PitBlock/PitBlock';
import { RingBadge } from './RingBadge/RingBadge';
import { StatsStrip } from './StatsStrip/StatsStrip';

import styles from './RaceDashWidget.module.scss';

export const RaceDashWidget = observer(() => {
  const { pitState, showPitAssist } = usePitState();

  const isPitMode = showPitAssist && pitState !== 'normal';

  return (
    <WidgetPanel gap={0} minWidth={0} direction="row" className={styles.plate}>
      <RingBadge />

      {isPitMode ? <PitBlock /> : <StatsStrip />}
    </WidgetPanel>
  );
});
