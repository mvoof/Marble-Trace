import { observer } from 'mobx-react-lite';

import { WidgetPanel } from '@/components/shared/WidgetPanel/WidgetPanel';
import { WindCompass } from './WindCompass/WindCompass';
import { StatsGrid } from './StatsGrid/StatsGrid';
import { ForecastBlock } from './ForecastBlock/ForecastBlock';

export const WeatherWidget = observer(() => {
  return (
    <WidgetPanel direction="column" gap={0} minWidth={80}>
      <WindCompass />

      <StatsGrid />

      <ForecastBlock />
    </WidgetPanel>
  );
});
