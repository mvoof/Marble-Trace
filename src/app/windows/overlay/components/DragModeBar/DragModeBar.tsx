import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { Check, Grid3x3, Layers, Magnet } from 'lucide-react';
import { WidgetPicker } from '@app/windows/overlay/components/WidgetPicker/WidgetPicker';
import { useOverlayRoot } from '@app/roots/overlay-root-context';
import { useAppSettingsStore } from '@entities/app-settings/app-settings-context';
import { useLayoutsStore } from '@entities/layout/layouts-context';
import { ToolbarButton } from '@shared/ui/Toolbar/ToolbarButton';
import { ToolbarMenuItem } from '@shared/ui/Toolbar/ToolbarMenuItem';
import { ToolbarPopover } from '@shared/ui/Toolbar/ToolbarPopover';
import styles from './DragModeBar.module.scss';

/**
 * The floating controls each overlay shows during F9 editing.
 */
export const DragModeBar = observer(() => {
  const appSettings = useAppSettingsStore();
  const { liveLayout } = useLayoutsStore();
  const { settingsClient } = useOverlayRoot();
  const { t } = useTranslation('main-app');
  const { editorShowGrid, editorSnapToGrid } = appSettings.appSettings;
  const switchLayout = t('overlayCanvas.switchLayout');
  const finishEditing = t('overlayCanvas.finishEditing');

  return (
    <header className={styles.bar}>
      <ToolbarPopover
        align="center"
        trigger={({ isOpen, toggle }) => (
          <ToolbarButton
            icon={Layers}
            label={liveLayout?.name}
            title={
              liveLayout ? `${switchLayout} — ${liveLayout.name}` : switchLayout
            }
            isSelect
            isExpanded={isOpen}
            isDisabled={!liveLayout}
            onClick={toggle}
          />
        )}
      >
        {({ close }) => (
          <div role="menu" aria-label={switchLayout}>
            {settingsClient.layoutChoices.map(({ id, name }) => (
              <ToolbarMenuItem
                key={id}
                label={name}
                isChecked={id === liveLayout?.id}
                onClick={() => {
                  settingsClient.switchLayout(id);
                  close();
                }}
              />
            ))}
          </div>
        )}
      </ToolbarPopover>

      <span className={styles.separator} aria-hidden="true" />

      <WidgetPicker />

      <ToolbarPopover
        align="center"
        trigger={({ isOpen, toggle }) => (
          <ToolbarButton
            icon={Grid3x3}
            title={t('layoutEditor.grid')}
            isSelect
            isExpanded={isOpen}
            isDisabled={!liveLayout}
            onClick={toggle}
          />
        )}
      >
        {() => (
          <div role="menu" aria-label={t('layoutEditor.grid')}>
            <ToolbarMenuItem
              icon={Grid3x3}
              label={t('layoutEditor.toggleGridTooltip')}
              isChecked={editorShowGrid}
              onClick={() => settingsClient.setGridVisibility(!editorShowGrid)}
            />

            <ToolbarMenuItem
              icon={Magnet}
              label={t('layoutEditor.snapToGridTooltip')}
              isChecked={editorSnapToGrid}
              onClick={() => settingsClient.setGridSnapping(!editorSnapToGrid)}
            />
          </div>
        )}
      </ToolbarPopover>

      <span className={styles.separator} aria-hidden="true" />

      <ToolbarButton
        icon={Check}
        label={finishEditing}
        title={finishEditing}
        isLabelCollapsible
        tone="accent"
        onClick={() => appSettings.setDragMode(false)}
      />
    </header>
  );
});
