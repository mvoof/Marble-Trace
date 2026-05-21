import { observer } from 'mobx-react-lite';

import { flagsStore } from '@store/flags.store';
import { widgetSettingsStore } from '@store/widget-settings.store';
import { WidgetPanel } from '@/components/shared/primitives/WidgetPanel/WidgetPanel';
import { useFlagBlink } from '@hooks/flags-hooks';
import { FlagList } from './FlagList/FlagList';

import styles from './FlatFlagsWidget.module.scss';

export const FlatFlagsWidget = observer(() => {
  const { alwaysShow } =
    widgetSettingsStore.getFlagDisplaySettings('flat-flags');

  const blinkOn = useFlagBlink();

  if (!alwaysShow && flagsStore.displayFlags.length === 0) {
    return null;
  }

  return (
    <WidgetPanel direction="column" gap={0} className={styles.widgetBackground}>
      <div className={styles.header}>FLAGS</div>

      <FlagList blinkOn={blinkOn} />
    </WidgetPanel>
  );
});
