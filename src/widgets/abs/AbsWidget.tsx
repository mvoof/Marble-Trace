import { observer } from 'mobx-react-lite';
import { WidgetPanel } from '@shared/ui/WidgetPanel/WidgetPanel';
import { FixedDigits } from '@shared/ui/FixedDigits/FixedDigits';
import { usePlayerStore } from '@entities/player/player-context';
import { useWidgetSettings } from '@entities/layout/useWidgetSettings';
import styles from './AbsWidget.module.scss';
import type { AbsWidgetSettings } from './settings-schema';

/** What the level reads on a car with no ABS adjustment, when kept on screen. */
const NO_LEVEL_LABEL = '--';

/**
 * The cockpit ABS setting beside a badge that lights while ABS is working.
 *
 * The light is read through `isAbsActive` rather than the 60 Hz inputs frame,
 * so the widget wakes when the light changes, not on every tick. Hiding on a
 * car without the adjustment is WidgetAutoHideStore's answer: the container
 * draws its plate around a body that renders nothing.
 */
export const AbsWidget = observer(() => {
  const { carStatus, isAbsActive } = usePlayerStore();
  const settings = useWidgetSettings<AbsWidgetSettings>('abs');

  const dcAbs = carStatus?.dc_abs ?? null;
  const levelText =
    dcAbs === null ? NO_LEVEL_LABEL : Math.round(dcAbs).toString();

  return (
    <WidgetPanel
      direction="row"
      gap={0}
      minWidth={0}
      className={`${styles.root} ${isAbsActive ? styles.rootActive : ''}`}
    >
      <div
        className={`${styles.badge} ${settings.showLevel ? '' : styles.badgeAlone}`}
      >
        ABS
      </div>

      {settings.showLevel ? (
        <div className={styles.level}>
          <FixedDigits text={levelText} />
        </div>
      ) : null}
    </WidgetPanel>
  );
});
