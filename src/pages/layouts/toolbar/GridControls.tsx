import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { Button, Select, Tooltip } from 'antd';
import { Grid3x3, Magnet } from 'lucide-react';

import { useAppSettingsStore } from '@entities/app-settings/app-settings-context';

const GRID_SIZE_OPTIONS = [10, 15, 20, 30, 40].map((size) => ({
  value: size,
  label: `${size}px`,
}));

const GRID_SELECT_MIN_WIDTH_PX = 72;

/** The alignment grid: shown or not, its pitch, and whether moves snap to it. */
export const GridControls = observer(() => {
  const appSettings = useAppSettingsStore();
  const { t } = useTranslation('main-app');
  const {
    editorShowGrid: showGrid,
    editorSnapToGrid: snapToGrid,
    editorGridSize: gridSize,
  } = appSettings.appSettings;

  return (
    <>
      <Tooltip title={t('layoutEditor.toggleGridTooltip')}>
        <Button
          size="small"
          type={showGrid ? 'primary' : 'text'}
          icon={<Grid3x3 size={14} />}
          onClick={() => appSettings.update({ editorShowGrid: !showGrid })}
        />
      </Tooltip>

      {showGrid && (
        <Tooltip title={t('layoutEditor.gridSizeTooltip')}>
          <Select
            size="small"
            value={gridSize}
            onChange={(value) => appSettings.update({ editorGridSize: value })}
            options={GRID_SIZE_OPTIONS}
            style={{ minWidth: GRID_SELECT_MIN_WIDTH_PX }}
          />
        </Tooltip>
      )}

      <Tooltip title={t('layoutEditor.snapToGridTooltip')}>
        <Button
          size="small"
          type={snapToGrid ? 'primary' : 'text'}
          icon={<Magnet size={14} />}
          onClick={() => appSettings.update({ editorSnapToGrid: !snapToGrid })}
        />
      </Tooltip>
    </>
  );
});
