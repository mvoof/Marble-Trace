import { observer } from 'mobx-react-lite';

import { WidgetPanel } from '@/components/shared/WidgetPanel/WidgetPanel';
import { WindCompass } from './WindCompass/WindCompass';
import { WeatherHeader } from './WeatherHeader/WeatherHeader';
import { StatsGrid } from './StatsGrid/StatsGrid';
import { ForecastBlock } from './ForecastBlock/ForecastBlock';

export const WeatherWidget = observer(() => {
  return (
    <WidgetPanel direction="column" gap={0} minWidth={80}>
      <WindCompass />

      <WeatherHeader />

      <StatsGrid />

      <ForecastBlock />
    </WidgetPanel>
  );
});
