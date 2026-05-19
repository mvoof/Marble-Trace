import { observer } from 'mobx-react-lite';

import { widgetSettingsStore } from '../../../store/widget-settings.store';
import { WidgetPanel } from '../../shared/primitives/WidgetPanel/WidgetPanel';
import { InputBars } from './InputBars/InputBars';
import { CanvasTrace } from './CanvasTrace/CanvasTrace';

import styles from './InputTraceWidget.module.scss';

export const InputTraceWidget = observer(() => {
  const settings = widgetSettingsStore.getInputTraceSettings();

  const showBars = settings.barMode !== 'hidden';
  const isVertical = settings.barMode === 'vertical';

  return (
    <WidgetPanel direction={isVertical ? 'row' : 'column'} gap={8} edgeInset>
      {isVertical ? (
        <>
          <div className={styles.chartArea}>
            <CanvasTrace />
          </div>

          {showBars && <InputBars isVertical />}
        </>
      ) : (
        <>
          {showBars && <InputBars isVertical={false} />}

          <div className={styles.chartArea}>
            <CanvasTrace />
          </div>
        </>
      )}
    </WidgetPanel>
  );
});
