import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { Button } from 'antd';
import { X } from 'lucide-react';
import { WidgetPicker } from '@ui/app/overlay/components/WidgetPicker/WidgetPicker';
import { useAppSettingsStore } from '@store/settings/app-settings-context';

/**
 * The controls drag mode puts at the top of the overlay. Loaded lazily by
 * `OverlayCanvas`, so antd reaches the overlay only once drag mode is first
 * switched on — a race spent without it never parses the library.
 */
export const DragModeBar = observer(() => {
  const appSettings = useAppSettingsStore();
  const { t } = useTranslation('main-app');

  const handleExitDragMode = () => {
    appSettings.setDragMode(false);
  };

  return (
    <>
      <WidgetPicker />

      <Button
        type="primary"
        danger
        icon={<X size={16} />}
        onClick={handleExitDragMode}
        size="large"
      >
        {t('overlayCanvas.exitEditMode')}
      </Button>
    </>
  );
});
