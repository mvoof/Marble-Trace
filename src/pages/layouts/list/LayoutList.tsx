import { useEffect } from 'react';
import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';

import { useLayoutsStore } from '@entities/layout/layouts-context';
import { useLayoutEditorStore } from '@features/layout-editor/layout-editor-context';

import { PageTitle } from '@shared/ui/PageTitle/PageTitle';

import { AutoSwitchBlock } from './AutoSwitchBlock';
import { CreateLayoutButton } from './CreateLayoutButton';
import { ImportLayoutButton } from './ImportLayoutButton';
import { LayoutCard } from './LayoutCard';
import styles from './LayoutList.module.scss';

interface LayoutListProps {
  onOpenEditor: (id: string) => void;
}

/**
 * The Layouts page before a layout is opened: the Auto-switch block, then
 * every layout as a card.
 */
export const LayoutList = observer(({ onOpenEditor }: LayoutListProps) => {
  const layouts = useLayoutsStore();
  const layoutEditor = useLayoutEditorStore();
  const { t } = useTranslation('main-app');

  useEffect(() => {
    void layoutEditor.refreshOnlineMonitors();
  }, [layoutEditor]);

  return (
    <div className={styles.page}>
      <PageTitle
        title={t('appHeader.sections.layouts')}
        subtitle={t('layoutList.layoutsCount', {
          count: layouts.layouts.length,
        })}
        actions={
          <>
            <ImportLayoutButton />

            <CreateLayoutButton />
          </>
        }
      />

      <AutoSwitchBlock />

      <div className={styles.grid}>
        {layouts.layouts.map((layout) => (
          <LayoutCard
            key={layout.id}
            layout={layout}
            onOpenEditor={() => onOpenEditor(layout.id)}
          />
        ))}
      </div>
    </div>
  );
});
