import { observer } from 'mobx-react-lite';

import { useWidgetSettings } from '@entities/layout/useWidgetSettings';
import { CornerSpeedColumn } from '@entities/corner-speeds/CornerSpeedColumn';

import styles from './CornerSpeeds.module.scss';
import type { InputTraceSettings } from '../settings-schema';

/** The corner speeds beside the speed and gear, in this widget's sizes. */
export const CornerSpeeds = observer(() => {
  const settings = useWidgetSettings<InputTraceSettings>('input-trace');

  if (!settings.showCornerSpeeds) {
    return null;
  }

  return (
    <CornerSpeedColumn
      entryColor={settings.entrySpeedColor}
      apexColor={settings.apexSpeedColor}
      exitColor={settings.exitSpeedColor}
      className={styles.corners}
      valueClassName={styles.cornerValue}
      pendingClassName={styles.cornerValuePending}
    />
  );
});
