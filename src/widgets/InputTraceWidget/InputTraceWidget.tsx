import { observer } from 'mobx-react-lite';

import { WidgetPanel } from '@/components/shared/WidgetPanel/WidgetPanel';
import { InputBars } from './InputBars/InputBars';
import { CanvasTrace } from './CanvasTrace/CanvasTrace';

import styles from './InputTraceWidget.module.scss';

export const InputTraceWidget = observer(() => (
  <WidgetPanel direction="row" gap={8} edgeInset>
    <div className={styles.chartArea}>
      <CanvasTrace />
    </div>

    <InputBars />
  </WidgetPanel>
));
