import { observer } from 'mobx-react-lite';

import { WidgetPanel } from '@/components/shared/WidgetPanel/WidgetPanel';
import { useWidgetSettingsStore } from '@store/root-store-context';
import type { CoachWidgetSettings } from '@/types/widget-settings';

import { CallRow } from './CallRow/CallRow';
import { SpeedTrace } from './SpeedTrace/SpeedTrace';

import styles from './CoachWidget.module.scss';

/**
 * Driving coach: the advisory call on top, the speed trace against the stored
 * best lap underneath. With the trace switched off only the call row is
 * rendered and the widget collapses to it — the container is autoHeight, so
 * the plate follows the content instead of leaving an empty box hanging.
 */
export const CoachWidget = observer(() => {
  const widgetSettings = useWidgetSettingsStore();

  const settings = widgetSettings.getSettings<CoachWidgetSettings>('coach');

  return (
    <WidgetPanel gap={0} minWidth={0} className={styles.root}>
      <CallRow />

      {settings.showTrace ? <SpeedTrace /> : null}
    </WidgetPanel>
  );
});
