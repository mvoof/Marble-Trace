import { observer } from 'mobx-react-lite';

import { WidgetPanel } from '@/components/shared/WidgetPanel/WidgetPanel';
import { CornerModule } from '@widgets/ChassisWidget/CornerModule/CornerModule';
import { CenterLabels } from './CenterLabels/CenterLabels';
import { StaleNotice } from './StaleNotice/StaleNotice';

import styles from './ChassisWidget.module.scss';
import { useWidgetSettingsStore } from '@store/root-store-context';

export const ChassisWidget = observer(() => {
  const widgetSettings = useWidgetSettingsStore();

  const { showSuspensionAndBrakes } = widgetSettings.getChassisSettings();

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
