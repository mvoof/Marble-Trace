import { useEffect, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { Segmented } from 'antd';

import { useAppSettingsStore } from '@entities/app-settings/app-settings-context';
import { useLayoutsStore } from '@entities/layout/layouts-context';
import { useLayoutEditorStore } from '@features/layout-editor/layout-editor-context';
import type { SavedLayout } from '@shared/contracts/widget-settings';

import { CreateLayoutButton } from './CreateLayoutButton';
import { LayoutCard } from './LayoutCard';
import { LayoutDetails } from './LayoutDetails';
import styles from './LayoutList.module.scss';

interface LayoutListProps {
  onOpenEditor: (id: string) => void;
}

/**
 * The Layouts tab before a layout is opened: every layout as a card, and the
 * selected one's details beside them. Which card is picked is this view's
 * own, and starts on the layout being edited each time the list is shown.
 */
export const LayoutList = observer(({ onOpenEditor }: LayoutListProps) => {
  const layouts = useLayoutsStore();
  const layoutEditor = useLayoutEditorStore();
  const appSettings = useAppSettingsStore();
  const { t } = useTranslation('main-app');
  const autoSwitchEnabled = appSettings.appSettings.autoSwitchLayouts;

  const [selectedId, setSelectedId] = useState<string | null>(
    layouts.editingLayoutId
  );
  const [renameValue, setRenameValue] = useState('');

  useEffect(() => {
    void layoutEditor.refreshOnlineMonitors();
  }, [layoutEditor]);

  // A deleted layout cannot stay selected; fall back to the one being edited.
  useEffect(() => {
    if (
      selectedId &&
      !layouts.layouts.some((layout) => layout.id === selectedId)
    ) {
      setSelectedId(layouts.editingLayoutId);
    }
  }, [selectedId, layouts.layouts, layouts.editingLayoutId]);

  const selectedLayout = layouts.layouts.find(
    (layout) => layout.id === selectedId
  );

  const handleSelectCard = (layout: SavedLayout) => {
    setSelectedId(layout.id);
    setRenameValue(layout.name);
  };

  const handleOpenCard = (layout: SavedLayout) => {
    setSelectedId(layout.id);
    onOpenEditor(layout.id);
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.headerInfo}>
          <span className={styles.moduleLabel}>
            {t('layoutList.moduleLabel')}
          </span>

          <h1 className={styles.title}>{t('layoutList.title')}</h1>
          <p className={styles.subtitle}>
            {autoSwitchEnabled
              ? t('layoutList.subtitleAutoSwitch')
              : t('layoutList.subtitleManual')}
          </p>
        </div>

        <div className={styles.headerActions}>
          <Segmented
            className={styles.modeSwitch}
            value={autoSwitchEnabled ? 'auto' : 'manual'}
            onChange={(value) =>
              appSettings.update({ autoSwitchLayouts: value === 'auto' })
            }
            options={[
              { label: t('layoutList.modeManual'), value: 'manual' },
              { label: t('layoutList.modeAuto'), value: 'auto' },
            ]}
            title={t('layoutList.toggleAutoSwitchTooltip')}
          />

          <CreateLayoutButton onCreated={setSelectedId} />
        </div>
      </header>

      <div className={styles.content}>
        <div className={styles.gridSection}>
          <div className={styles.layoutsGrid}>
            {layouts.layouts.map((layout) => (
              <LayoutCard
                key={layout.id}
                layout={layout}
                isSelected={layout.id === selectedId}
                onSelect={() => handleSelectCard(layout)}
                onOpenEditor={() => handleOpenCard(layout)}
              />
            ))}
          </div>
        </div>

        <LayoutDetails
          layout={selectedLayout}
          renameValue={renameValue}
          onRenameValueChange={setRenameValue}
          onSelect={setSelectedId}
          onOpenEditor={onOpenEditor}
        />
      </div>
    </div>
  );
});
