import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { Grid3x3, Magnet } from 'lucide-react';

import { useAppSettingsStore } from '@entities/app-settings/app-settings-context';
import { cx } from '@shared/lib/class-names';

import { ToolbarMenuItem, ToolbarMenuSection } from './ToolbarMenuItem';
import styles from './GridControls.module.scss';

const GRID_SIZES = [10, 15, 20, 30, 40];

/**
 * The alignment grid, in the "…" menu: shown or not, its pitch, and whether
 * moves snap to it.
 */
export const GridControls = observer(() => {
  const appSettings = useAppSettingsStore();
  const { t } = useTranslation('main-app');
  const {
    editorShowGrid: showGrid,
    editorSnapToGrid: snapToGrid,
    editorGridSize: gridSize,
  } = appSettings.appSettings;

  return (
    <ToolbarMenuSection title={t('layoutEditor.grid')}>
      <ToolbarMenuItem
        icon={Grid3x3}
        label={t('layoutEditor.toggleGridTooltip')}
        isChecked={showGrid}
        onClick={() => appSettings.update({ editorShowGrid: !showGrid })}
      />

      <div className={styles.sizes} title={t('layoutEditor.gridSizeTooltip')}>
        {GRID_SIZES.map((size) => (
          <button
            key={size}
            type="button"
            aria-pressed={size === gridSize}
            className={cx(styles.size, size === gridSize && styles.sizeOn)}
            onClick={() => appSettings.update({ editorGridSize: size })}
          >
            {size}
          </button>
        ))}
      </div>

      <ToolbarMenuItem
        icon={Magnet}
        label={t('layoutEditor.snapToGridTooltip')}
        isChecked={snapToGrid}
        onClick={() => appSettings.update({ editorSnapToGrid: !snapToGrid })}
      />
    </ToolbarMenuSection>
  );
});
