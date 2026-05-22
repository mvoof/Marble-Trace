import { observer } from 'mobx-react-lite';

import { useWidgetAutoHide } from '@hooks/common/useWidgetAutoHide';
import { WidgetPanel } from '@/components/shared/WidgetPanel/WidgetPanel';
import { useFlagBlink } from '@hooks/flags-hooks';
import { FlagList } from './FlagList/FlagList';

import styles from './FlatFlagsWidget.module.scss';
import {
  useFlagsStore,
  useWidgetSettingsStore,
} from '@store/root-store-context';

export const FlatFlagsWidget = observer(() => {
  const flags = useFlagsStore();
  const widgetSettings = useWidgetSettingsStore();

  const { alwaysShow } = widgetSettings.getFlagDisplaySettings('flat-flags');

  const blinkOn = useFlagBlink();
  const hasContent = alwaysShow || flags.displayFlags.length > 0;

  useWidgetAutoHide(hasContent);

  if (!hasContent) {
    return null;
  }

  return (
    <WidgetPanel direction="column" gap={0} className={styles.widgetBackground}>
      <div className={styles.header}>FLAGS</div>

      <FlagList blinkOn={blinkOn} />
    </WidgetPanel>
  );
});
