import { observer } from 'mobx-react-lite';
import { widgetSettingsStore } from '../../../store/widget-settings.store';
import { GMeterWidget } from './GMeterWidget';

export const GMeterWidgetContainer = observer(() => {
  const { displayMode, scale, colorMode } =
    widgetSettingsStore.getGMeterSettings();

  return (
    <GMeterWidget
      displayMode={displayMode}
      scale={scale}
      colorMode={colorMode}
    />
  );
});
