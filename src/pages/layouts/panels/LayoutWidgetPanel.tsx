import { observer } from 'mobx-react-lite';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ChevronDown,
  ChevronRight,
  Copy,
  Eye,
  EyeOff,
  Keyboard,
  Monitor,
  Plus,
  Search,
  TabletSmartphone,
  Trash2,
  type LucideIcon,
} from 'lucide-react';
import type {
  LayoutMonitor,
  WidgetDefaultConfig,
} from '@shared/contracts/widget-settings';
import type { MonitorWidgetRow } from '@entities/layout/live-widgets.store';
import { isRemoteMonitor } from '@shared/lib/remote-screen';
import { cx } from '@shared/lib/class-names';
import { useLayoutsStore } from '@entities/layout/layouts-context';
import { useMainLiveWidgetsStore } from '@entities/layout/main-live-widgets-context';
import { useLayoutEditorUiStore } from '@features/layout-editor/layout-editor-ui-context';

import { AddWidgetPanel } from '../toolbar/AddWidgetMenu';
import { ToolbarPopover } from '../toolbar/ToolbarPopover';
import {
  isPanelSearchShown,
  panelLineCountOf,
  placedWidgetRowsOf,
  rowsMatching,
} from './placed-widget-rows';
import styles from './LayoutWidgetPanel.module.scss';

const ROW_ICON_SIZE = 13;
const HEADING_ICON_SIZE = 12;

const RowIconButton = ({
  icon: Icon,
  title,
  isOn,
  isDanger = false,
  isDisabled = false,
  isHoverOnly = false,
  onClick,
}: {
  icon: LucideIcon;
  title: string;
  isOn?: boolean;
  isDanger?: boolean;
  isDisabled?: boolean;
  /** Shown on the row's hover, focus or selection only. */
  isHoverOnly?: boolean;
  onClick: () => void;
}) => (
  <button
    type="button"
    className={cx(
      styles.rowButton,
      isOn && styles.rowButtonOn,
      isDanger && styles.rowButtonDanger,
      isHoverOnly && styles.rowButtonHoverOnly
    )}
    title={title}
    aria-label={title}
    aria-pressed={isOn}
    disabled={isDisabled}
    onClick={(event) => {
      event.stopPropagation();
      onClick();
    }}
  >
    <Icon size={ROW_ICON_SIZE} />
  </button>
);

/** Whether the widget's hotkeys act on this instance, and a click to change it. */
const HotkeyToggle = observer(({ widgetId }: { widgetId: string }) => {
  const liveWidgets = useMainLiveWidgetsStore();
  const { t } = useTranslation('main-app');
  const isOn = liveWidgets.hotkeysActOnWidget(widgetId);

  return (
    <RowIconButton
      icon={Keyboard}
      title={
        isOn
          ? t('layoutWidgetPanel.hotkeysOn')
          : t('layoutWidgetPanel.hotkeysOff')
      }
      isOn={isOn}
      isHoverOnly
      onClick={() => liveWidgets.setHotkeysActOn(widgetId, !isOn)}
    />
  );
});

/**
 * One instance's eye. Hiding keeps the row in the list until the editor
 * closes, so the same eye brings it back.
 */
const EyeToggle = observer(
  ({
    widget,
    monitorName,
    available,
  }: {
    widget: WidgetDefaultConfig;
    monitorName: string;
    available: boolean;
  }) => {
    const liveWidgets = useMainLiveWidgetsStore();
    const editorUi = useLayoutEditorUiStore();
    const { t } = useTranslation('main-app');
    const isShown = widget.userSettings.enabled && available;

    return (
      <RowIconButton
        icon={isShown ? Eye : EyeOff}
        title={
          isShown ? t('layoutWidgetPanel.hide') : t('layoutWidgetPanel.show')
        }
        isOn={isShown}
        isDisabled={!available}
        onClick={() => {
          if (isShown) {
            editorUi.keepInWidgetList(monitorName, widget.type);
          }

          liveWidgets.setWidgetEnabled(widget.id, !isShown);
        }}
      />
    );
  }
);

const useScrollIntoViewWhen = (isSelected: boolean) => {
  const rowRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (isSelected) {
      rowRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [isSelected]);

  return rowRef;
};

/**
 * One line of the list: an instance with its eye, its name or copy number,
 * and on hover its hotkeys and delete.
 */
const InstanceLine = observer(
  ({
    widget,
    monitorName,
    available,
    isCopy,
    children,
    deleteTitle,
    onDelete,
  }: {
    widget: WidgetDefaultConfig;
    monitorName: string;
    available: boolean;
    isCopy: boolean;
    children: ReactNode;
    deleteTitle: string;
    onDelete: () => void;
  }) => {
    const editorUi = useLayoutEditorUiStore();
    const isSelected = editorUi.selectedWidgetId === widget.id;
    const rowRef = useScrollIntoViewWhen(isSelected);

    return (
      <div
        ref={rowRef}
        className={cx(
          styles.row,
          isCopy && styles.copyRow,
          isSelected && styles.selected,
          !available && styles.disabled,
          !widget.userSettings.enabled && styles.hidden
        )}
      >
        <EyeToggle
          widget={widget}
          monitorName={monitorName}
          available={available}
        />

        <button
          type="button"
          className={styles.label}
          onClick={() => editorUi.selectWidget(widget.id)}
        >
          {children}
        </button>

        <HotkeyToggle widgetId={widget.id} />

        <RowIconButton
          icon={Trash2}
          title={deleteTitle}
          isDanger
          isHoverOnly
          onClick={onDelete}
        />
      </div>
    );
  }
);

/** A widget on one monitor's list, its copies there nested under it. */
const WidgetTypeRow = observer(
  ({ row, monitorName }: { row: MonitorWidgetRow; monitorName: string }) => {
    const liveWidgets = useMainLiveWidgetsStore();
    const editorUi = useLayoutEditorUiStore();
    const { t } = useTranslation('main-app');
    const { instances, available } = row;
    const [first, ...copies] = instances;

    if (!first) {
      return null;
    }

    const handleRemoveType = () => {
      const selectedId = editorUi.selectedWidgetId;

      liveWidgets.removeTypeFromMonitor(row.type, monitorName);
      editorUi.forgetInWidgetList(monitorName, row.type);

      // A copy the selection named is gone; the first instance is hidden.
      if (instances.some((widget) => widget.id === selectedId)) {
        editorUi.selectWidget(null);
      }
    };

    const handleRemoveCopy = (copyId: string) => {
      liveWidgets.removeWidgetCopy(copyId);

      if (editorUi.selectedWidgetId === copyId) {
        editorUi.selectWidget(null);
      }
    };

    return (
      <>
        <InstanceLine
          widget={first}
          monitorName={monitorName}
          available={available}
          isCopy={false}
          deleteTitle={t('layoutWidgetPanel.removeWidget')}
          onDelete={handleRemoveType}
        >
          <span className={styles.name}>{row.label}</span>
        </InstanceLine>

        {copies.map((copy, index) => (
          <InstanceLine
            key={copy.id}
            widget={copy}
            monitorName={monitorName}
            available={available}
            isCopy
            deleteTitle={t('layoutWidgetPanel.deleteCopy')}
            onDelete={() => handleRemoveCopy(copy.id)}
          >
            <span
              className={styles.copyTag}
              title={t('layoutWidgetPanel.copyTooltip')}
            >
              <Copy size={10} />
              {index + 2}/{instances.length}
            </span>
          </InstanceLine>
        ))}
      </>
    );
  }
);

/** "+" or "+ Widget": the widget menu aimed at one monitor. */
const AddToMonitor = observer(
  ({ monitorName, label }: { monitorName: string; label?: string }) => {
    const { t } = useTranslation('main-app');
    const title = t('layoutWidgetPanel.addTo', { monitor: monitorName });

    return (
      <ToolbarPopover
        isWide
        isDetached
        trigger={({ isOpen, toggle }) => (
          <button
            type="button"
            className={cx(
              label ? styles.addButton : styles.addIcon,
              isOpen && styles.addOpen
            )}
            title={title}
            aria-label={title}
            aria-expanded={isOpen}
            onClick={toggle}
          >
            <Plus size={HEADING_ICON_SIZE} />
            {label}
          </button>
        )}
      >
        {({ isOpen, close }) =>
          isOpen && (
            <AddWidgetPanel targetMonitorName={monitorName} onAdded={close} />
          )
        }
      </ToolbarPopover>
    );
  }
);

const ScreenGroup = observer(
  ({
    monitor,
    rows,
    query,
  }: {
    monitor: LayoutMonitor;
    rows: MonitorWidgetRow[];
    query: string;
  }) => {
    const { t } = useTranslation('main-app');
    const [isCollapsed, setIsCollapsed] = useState(false);
    const Icon = isRemoteMonitor(monitor) ? TabletSmartphone : Monitor;
    const Chevron = isCollapsed ? ChevronRight : ChevronDown;
    const shownRows = rowsMatching(rows, query);

    return (
      <div className={styles.screenGroup}>
        <div className={styles.screenHeading}>
          <button
            type="button"
            className={styles.screenToggle}
            aria-expanded={!isCollapsed}
            onClick={() => setIsCollapsed((collapsed) => !collapsed)}
          >
            <Chevron size={HEADING_ICON_SIZE} />

            <Icon size={HEADING_ICON_SIZE} />

            <span className={styles.screenName}>{monitor.name}</span>

            <span className={styles.screenSize}>
              {monitor.bounds.width}×{monitor.bounds.height}
            </span>

            {/* What a folded screen still has to say: how much is on it. */}
            <span className={styles.screenCount}>{panelLineCountOf(rows)}</span>
          </button>

          <AddToMonitor monitorName={monitor.name} />
        </div>

        {!isCollapsed && rows.length === 0 && (
          <div className={styles.empty}>
            <span>{t('layoutWidgetPanel.empty')}</span>

            <AddToMonitor
              monitorName={monitor.name}
              label={t('layoutEditor.addWidget')}
            />
          </div>
        )}

        {!isCollapsed &&
          shownRows.map((row) => (
            <WidgetTypeRow
              key={row.type}
              row={row}
              monitorName={monitor.name}
            />
          ))}
      </div>
    );
  }
);

/**
 * The layout editor's widget list: the widgets placed on each screen of the
 * layout — on the screen in focus alone in full size. Adding goes through
 * the widget menu, from the bar or from a screen's own "+".
 *
 * The list only says what there is and what is selected. Everything that acts
 * on a widget, its settings included, lives in the inspector on the other side
 * of the canvas.
 */
export const LayoutWidgetPanel = observer(() => {
  const layouts = useLayoutsStore();
  const liveWidgets = useMainLiveWidgetsStore();
  const editorUi = useLayoutEditorUiStore();
  const { t } = useTranslation('main-app');
  const [query, setQuery] = useState('');
  const allMonitors = layouts.editingLayout?.monitors ?? [];
  const focused = editorUi.focusedMonitorName;
  const monitors =
    focused === null
      ? allMonitors
      : allMonitors.filter((monitor) => monitor.name === focused);
  const groups = monitors.map((monitor) => ({
    monitor,
    rows: placedWidgetRowsOf(
      liveWidgets.monitorWidgetRows(monitor.name),
      (type) => editorUi.isKeptInWidgetList(monitor.name, type)
    ),
  }));
  const lineCount = groups.reduce(
    (total, group) => total + panelLineCountOf(group.rows),
    0
  );
  const isSearchShown = isPanelSearchShown(lineCount);
  const activeQuery = isSearchShown ? query : '';
  const hasMatch =
    activeQuery.trim() === '' ||
    groups.some((group) => rowsMatching(group.rows, activeQuery).length > 0);

  // What was hidden from the list is shown in it only while the editor is open.
  useEffect(() => () => editorUi.forgetWidgetListKeeps(), [editorUi]);

  return (
    <div className={styles.root}>
      {isSearchShown && (
        <div className={styles.search}>
          <Search size={HEADING_ICON_SIZE} />

          <input
            className={styles.searchInput}
            placeholder={t('layoutWidgetPanel.search')}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
      )}

      <div className={styles.list}>
        {groups.map(({ monitor, rows }) => (
          <ScreenGroup
            key={monitor.name}
            monitor={monitor}
            rows={rows}
            query={activeQuery}
          />
        ))}

        {!hasMatch && (
          <div className={styles.noMatch}>{t('layoutWidgetPanel.noMatch')}</div>
        )}
      </div>
    </div>
  );
});
