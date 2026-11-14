import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { Plus, Search } from 'lucide-react';

import { useLayoutsStore } from '@entities/layout/layouts-context';
import { useMainLiveWidgetsStore } from '@entities/layout/main-live-widgets-context';
import { WIDGET_BY_ID } from '@entities/widget/widget-catalog';
import { useLayoutEditorUiStore } from '@features/layout-editor/layout-editor-ui-context';
import { cx } from '@shared/lib/class-names';

import {
  addWidgetMenuSections,
  addWidgetTargetOf,
  type AddWidgetEntry,
} from './add-widget-menu';
import { ToolbarButton } from './ToolbarButton';
import { ToolbarPopover } from './ToolbarPopover';
import styles from './AddWidgetMenu.module.scss';

const SEARCH_ICON_SIZE = 14;

const isCore = (type: string): boolean =>
  WIDGET_BY_ID.get(type)?.tier === 'core';

/**
 * What the open menu holds: the search, the target monitor when none is in
 * focus, and the widgets. Mounted on each opening, so the search starts empty
 * and the target starts at its default.
 */
const AddWidgetPanel = observer(({ onAdded }: { onAdded: () => void }) => {
  const layouts = useLayoutsStore();
  const liveWidgets = useMainLiveWidgetsStore();
  const editorUi = useLayoutEditorUiStore();
  const { t } = useTranslation('main-app');
  const searchRef = useRef<HTMLInputElement | null>(null);
  const [query, setQuery] = useState('');
  const [chosenTarget, setChosenTarget] = useState<string | null>(null);

  const monitors = layouts.editingLayout?.monitors ?? [];
  const focused = editorUi.focusedMonitorName;
  const selectedWidget = editorUi.selectedWidgetId
    ? liveWidgets.getWidget(editorUi.selectedWidgetId)
    : undefined;
  const target = addWidgetTargetOf({
    focusedMonitorName: focused ?? chosenTarget,
    selectedWidgetMonitor: selectedWidget?.monitor,
    monitors,
  });
  const sections = addWidgetMenuSections(
    target ? liveWidgets.monitorWidgetRows(target) : [],
    query,
    isCore
  );

  useEffect(() => {
    searchRef.current?.focus();
  }, []);

  // The inspector is left as it was: adding is not configuring.
  const addEntry = (entry: AddWidgetEntry | undefined) => {
    if (!entry || !target) {
      return;
    }

    const addedId = liveWidgets.addWidgetAtCentre(entry.type, target);

    if (addedId) {
      editorUi.selectWidget(addedId);
    }

    onAdded();
  };

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
      addEntry(sections.topEntry);
    }
  };

  const renderRows = (title: string, entries: AddWidgetEntry[]) =>
    entries.length > 0 && (
      <div className={styles.section}>
        <div className={styles.sectionTitle}>{title}</div>

        {entries.map((entry) => (
          <button
            key={entry.type}
            type="button"
            className={cx(
              styles.row,
              entry === sections.topEntry && query.trim() && styles.rowFirst
            )}
            onClick={() => addEntry(entry)}
          >
            <span className={styles.rowLabel}>{entry.label}</span>

            {entry.isOnScreen && (
              <span className={styles.onScreen}>
                {t('layoutEditor.addWidgetOnScreen')}
              </span>
            )}
          </button>
        ))}
      </div>
    );

  return (
    <>
      <div className={styles.search}>
        <Search size={SEARCH_ICON_SIZE} />

        <input
          ref={searchRef}
          className={styles.searchInput}
          placeholder={t('layoutEditor.addWidgetSearch')}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={handleKeyDown}
        />
      </div>

      {focused === null && monitors.length > 1 && (
        <div className={styles.targets}>
          <span className={styles.targetsLabel}>
            {t('layoutEditor.addWidgetTarget')}
          </span>

          {monitors.map((monitor) => (
            <button
              key={monitor.name}
              type="button"
              className={cx(
                styles.target,
                monitor.name === target && styles.targetOn
              )}
              aria-pressed={monitor.name === target}
              onClick={() => {
                setChosenTarget(monitor.name);
                searchRef.current?.focus();
              }}
            >
              {monitor.name}
            </button>
          ))}
        </div>
      )}

      <div className={styles.list}>
        {renderRows(t('layoutEditor.addWidgetCore'), sections.core)}
        {renderRows(t('layoutEditor.addWidgetAll'), sections.all)}

        {!sections.topEntry && (
          <div className={styles.empty}>{t('layoutEditor.addWidgetEmpty')}</div>
        )}
      </div>
    </>
  );
});

/**
 * "+ Widget": a searchable menu of the widgets, core first. A pick lands in
 * the middle of the target monitor, selected; one already there gets a copy.
 */
export const AddWidgetMenu = observer(() => {
  const layouts = useLayoutsStore();
  const { t } = useTranslation('main-app');

  return (
    <ToolbarPopover
      isWide
      trigger={({ isOpen, toggle }) => (
        <ToolbarButton
          icon={Plus}
          label={t('layoutEditor.addWidget')}
          isLabelCollapsible
          title={t('layoutEditor.addWidgetTooltip')}
          tone="accent"
          isExpanded={isOpen}
          isDisabled={!layouts.editingLayout}
          onClick={toggle}
        />
      )}
    >
      {({ isOpen, close }) => isOpen && <AddWidgetPanel onAdded={close} />}
    </ToolbarPopover>
  );
});
