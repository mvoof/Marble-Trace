import { observer } from 'mobx-react-lite';

import { widgetSettingsStore } from '../../../store/widget-settings.store';
import { WidgetPanel } from '../../shared/primitives/WidgetPanel/WidgetPanel';
import { InputBars } from './InputBars/InputBars';
import { CanvasTrace } from './CanvasTrace/CanvasTrace';

import styles from './InputTraceWidget.module.scss';

export const InputTraceWidget = observer(() => {
  const settings = widgetSettingsStore.getInputTraceSettings();

  const showBars = settings.barMode !== 'hidden';

  return (
    <WidgetPanel direction="row" gap={8} edgeInset>
      <div className={styles.chartArea}>
        <CanvasTrace />
      </div>

      {showBars && <InputBars />}
    </WidgetPanel>
  );
});
