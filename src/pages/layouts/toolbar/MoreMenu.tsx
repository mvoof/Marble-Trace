import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { Ellipsis, Hash, Plus, Rows3 } from 'lucide-react';

import { useDisplaysStore } from '@entities/layout/displays-context';
import { useLayoutsStore } from '@entities/layout/layouts-context';
import { isRemoteMonitor } from '@shared/lib/remote-screen';

import { AddRemoteScreenButton } from './AddRemoteScreenButton';
import { BackgroundControls } from './BackgroundControls';
import { GridControls } from './GridControls';
import { ToolbarButton } from './ToolbarButton';
import { ToolbarMenuItem, ToolbarMenuSection } from './ToolbarMenuItem';
import { ToolbarPopover } from './ToolbarPopover';

/**
 * The bar's "…": what is set once and left — the grid, the background — and
 * the screens' housekeeping.
 */
export const MoreMenu = observer(() => {
  const layouts = useLayoutsStore();
  const displays = useDisplaysStore();
  const { t } = useTranslation('main-app');

  const hasRemoteScreens = (layouts.editingLayout?.monitors ?? []).some(
    isRemoteMonitor
  );

  return (
    <ToolbarPopover
      align="end"
      trigger={({ isOpen, toggle }) => (
        <ToolbarButton
          icon={Ellipsis}
          title={t('layoutEditor.moreTools')}
          isOn={isOpen}
          isExpanded={isOpen}
          onClick={toggle}
        />
      )}
    >
      {({ close }) => (
        <>
          <GridControls />

          <BackgroundControls onPicked={close} />

          <ToolbarMenuSection title={t('layoutEditor.screens')}>
            {hasRemoteScreens && (
              <ToolbarMenuItem
                icon={Rows3}
                label={t('layoutEditor.arrangeRemoteScreens')}
                onClick={() => {
                  layouts.arrangeRemoteScreens();
                  close();
                }}
              />
            )}

            <AddRemoteScreenButton
              renderTrigger={(open, isDisabled) => (
                <ToolbarMenuItem
                  icon={Plus}
                  label={t('layoutEditor.addRemoteScreen')}
                  isDisabled={isDisabled}
                  onClick={() => {
                    open();
                    close();
                  }}
                />
              )}
            />

            <ToolbarMenuItem
              icon={Hash}
              label={t('monitorMap.identify')}
              onClick={() => {
                displays.identify();
                close();
              }}
            />
          </ToolbarMenuSection>
        </>
      )}
    </ToolbarPopover>
  );
});
