import { useWidgetSettings } from '@entities/layout/useWidgetSettings';
import { observer } from 'mobx-react-lite';

import { WidgetPanel } from '@shared/ui/WidgetPanel/WidgetPanel';
import { FlagList } from './FlagList/FlagList';

import styles from './FlatFlagsWidget.module.scss';
import type { FlagDisplaySettings } from '@shared/contracts/widget-settings';
import { useFlagsStore } from '@entities/flags/flags-context';

export const FlatFlagsWidget = observer(() => {
  const flags = useFlagsStore();

  const { alwaysShow } = useWidgetSettings<FlagDisplaySettings>('flat-flags');

  const hasContent = alwaysShow || flags.displayFlags.length > 0;

  if (!hasContent) {
    return null;
  }

  return (
    <WidgetPanel direction="column" gap={0} className={styles.widgetBackground}>
      <div className={styles.header}>FLAGS</div>

      <FlagList />
    </WidgetPanel>
  );
});
