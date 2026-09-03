import { useWidgetSettings } from '@ui/hooks/useWidgetSettings';
import { observer } from 'mobx-react-lite';

import { WidgetPanel } from '@ui/shared/WidgetPanel/WidgetPanel';
import type { CoachWidgetSettings } from '@/types/widget-settings';

import { CallRow } from './CallRow/CallRow';
import { InfoRow } from './InfoRow/InfoRow';
import { SpeedTrace } from './SpeedTrace/SpeedTrace';

import styles from './CoachWidget.module.scss';

/**
 * Driving coach: the advisory call on top, the speed trace against the stored
 * reference lap underneath, and an optional row of readouts below it. Every section
 * can be switched off and the widget collapses to what is left — the container
 * is autoHeight, so the plate follows the content instead of leaving an empty
 * box hanging.
 */
export const CoachWidget = observer(() => {
  const settings = useWidgetSettings<CoachWidgetSettings>('coach');

  return (
    <WidgetPanel gap={0} minWidth={0} className={styles.root}>
      {settings.showCallRow ? <CallRow /> : null}

      {settings.showTrace ? <SpeedTrace /> : null}

      <InfoRow />
    </WidgetPanel>
  );
});
