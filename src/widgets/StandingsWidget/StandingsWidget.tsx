import { observer } from 'mobx-react-lite';

import { WidgetPanel } from '@/components/shared/WidgetPanel/WidgetPanel';
import { StandingsContent } from './StandingsContent/StandingsContent';

import styles from './StandingsWidget.module.scss';

export const StandingsWidget = observer(() => (
  <WidgetPanel className={styles.standings} gap={0}>
    <StandingsContent />
  </WidgetPanel>
));
