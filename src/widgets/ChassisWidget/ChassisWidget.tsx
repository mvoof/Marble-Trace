import { observer } from 'mobx-react-lite';

import { widgetSettingsStore } from '@store/widget-settings.store';
import { WidgetPanel } from '@/components/shared/primitives/WidgetPanel/WidgetPanel';
import { CornerModule } from '@widgets/ChassisWidget/CornerModule/CornerModule';
import { CenterLabels } from './CenterLabels/CenterLabels';
import { StaleNotice } from './StaleNotice/StaleNotice';

import styles from './ChassisWidget.module.scss';

export const ChassisWidget = observer(() => {
  const { showSuspensionAndBrakes } = widgetSettingsStore.getChassisSettings();

  return (
    <WidgetPanel direction="column" gap={0}>
      <div
        className={`${styles.carGrid} ${showSuspensionAndBrakes ? styles.carGridSuspensionAndBrakes : ''}`}
      >
        <CornerModule position="lf" isRight={false} />

        <CenterLabels />

        <CornerModule position="rf" isRight={true} />

        <CornerModule position="lr" isRight={false} />

        <CenterLabels />

        <CornerModule position="rr" isRight={true} />
      </div>

      <StaleNotice />
    </WidgetPanel>
  );
});
