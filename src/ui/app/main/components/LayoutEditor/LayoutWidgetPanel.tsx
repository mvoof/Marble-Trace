import { observer } from 'mobx-react-lite';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Switch, Button, Popconfirm, Tooltip } from 'antd';
import {
  Settings2,
  ArrowLeft,
  Copy,
  Monitor,
  TabletSmartphone,
  Trash2,
} from 'lucide-react';
import type {
  LayoutMonitor,
  WidgetDefaultConfig,
} from '@/types/widget-settings';
import { isRemoteMonitor } from '@utils/remote-screen';
import { WidgetSettings } from '../WidgetSettings/WidgetSettings';
import { useWidgetSettingsStore } from '@store/root-store-context';
import { getWidgetLabel } from '@ui/app/widget-i18n';
import styles from './LayoutWidgetPanel.module.scss';

interface LayoutWidgetPanelProps {
  selectedWidgetId: string | null;
  editingWidgetId: string | null;
  onSelectWidget: (id: string) => void;
  onEditWidget: (id: string | null) => void;
  /** Tools for the selected widget, floated beside its row. */
  widgetTools?: ReactNode;
}

const ICON_SIZE = 14;

const WidgetRow = observer(
  ({
    widget,
    isSelected,
    onSelectWidget,
    onEditWidget,
    onAnchor,
  }: {
    widget: WidgetDefaultConfig;
    isSelected: boolean;
    onSelectWidget: (id: string) => void;
    onEditWidget: (id: string | null) => void;
    /** Reports the row element, so the settings card can line itself up with
     *  the row it belongs to. */
    onAnchor: (widgetId: string, row: HTMLDivElement | null) => void;
  }) => {
    const widgetSettings = useWidgetSettingsStore();
    const { t } = useTranslation('main-app');
    const isAvailable = widgetSettings.availableWidgetIds.includes(widget.id);
    const rowRef = useRef<HTMLDivElement | null>(null);

    // A copy is a record of its own everywhere — its own settings, its own
    // place, its own enabled flag — so the row has to say which one it is
    // before the user hides or deletes the wrong one.
    const isCopy = widget.type !== undefined;
    const { ordinal, total } = widgetSettings.copyOrdinalOf(widget.id);

    const handleToggle = (checked: boolean) => {
      if (isAvailable) {
        widgetSettings.setWidgetEnabled(widget.id, checked);
      }
    };

    useEffect(() => {
      if (isSelected) {
        rowRef.current?.scrollIntoView({
          block: 'nearest',
          behavior: 'smooth',
        });
      }
    }, [isSelected]);

    return (
      <div
        ref={(node) => {
          rowRef.current = node;
          onAnchor(widget.id, node);
        }}
        className={`${styles.row} ${isSelected ? styles.selected : ''} ${
          !isAvailable ? styles.disabled : ''
        }`}
      >
        <Switch
          size="small"
          checked={widget.userSettings.enabled && isAvailable}
          disabled={!isAvailable}
          onChange={handleToggle}
        />

        <button
          type="button"
          className={styles.label}
          onClick={() => onSelectWidget(widget.id)}
        >
          {getWidgetLabel(t, widget)}
        </button>

        {total > 1 && (
          <Tooltip
            title={
              isCopy
                ? t('layoutWidgetPanel.copyTooltip')
                : t('layoutWidgetPanel.originalTooltip')
            }
          >
            <span className={isCopy ? styles.copyTag : styles.originalTag}>
              {isCopy && <Copy size={10} />}
              {ordinal}/{total}
            </span>
          </Tooltip>
        )}

        <Button
          size="small"
          type="text"
          icon={<Settings2 size={ICON_SIZE} />}
          onClick={() => onEditWidget(widget.id)}
        />

        {/* Only a copy: deleting the original would have the next layout load
            put it straight back, which is what the enable switch is for. */}
        {isCopy && (
          <Popconfirm
            title={t('layoutWidgetPanel.deleteCopyConfirm')}
            okText={t('layoutWidgetPanel.deleteCopyOk')}
            cancelText={t('layoutEditor.cancel')}
            onConfirm={() => widgetSettings.removeWidgetCopy(widget.id)}
          >
            <Button
              size="small"
              type="text"
              danger
              icon={<Trash2 size={ICON_SIZE} />}
            />
          </Popconfirm>
        )}
      </div>
    );
  }
);

const ScreenHeading = observer(
  ({ monitor }: { monitor: LayoutMonitor | null }) => {
    const { t } = useTranslation('main-app');

    if (!monitor) {
      return (
        <div className={styles.screenHeading}>
          <span className={styles.screenName}>
            {t('layoutWidgetPanel.offScreen')}
          </span>
        </div>
      );
    }

    const Icon = isRemoteMonitor(monitor) ? TabletSmartphone : Monitor;

    return (
      <div className={styles.screenHeading}>
        <Icon size={12} />

        <span className={styles.screenName}>{monitor.name}</span>

        <span className={styles.screenSize}>
          {monitor.bounds.width}×{monitor.bounds.height}
        </span>
      </div>
    );
  }
);

/**
 * The layout editor's widget list: every widget of the layout, grouped by the
 * screen it stands on, with its presence toggle and its copies named.
 *
 * The gear opens that widget's settings in place of the list, with a way back.
 * The tools for the selected widget arrive as `widgetTools` and are floated
 * beside the row they act on, so the editor's own toolbar stays about the
 * layout and the tools stay next to the widget they belong to.
 */
export const LayoutWidgetPanel = observer(
  ({
    selectedWidgetId,
    editingWidgetId,
    onSelectWidget,
    onEditWidget,
    widgetTools,
  }: LayoutWidgetPanelProps) => {
    const widgetSettings = useWidgetSettingsStore();
    const { t } = useTranslation('main-app');

    const rootRef = useRef<HTMLDivElement>(null);
    const listRef = useRef<HTMLDivElement>(null);
    const toolsRef = useRef<HTMLDivElement>(null);
    const rowsRef = useRef(new Map<string, HTMLDivElement>());
    const [toolsTop, setToolsTop] = useState(0);

    const handleAnchor = useCallback(
      (widgetId: string, row: HTMLDivElement | null) => {
        if (row) {
          rowsRef.current.set(widgetId, row);
        } else {
          rowsRef.current.delete(widgetId);
        }
      },
      []
    );

    // Followed rather than measured once: the list scrolls under the plaque,
    // and the plaque has to stay level with its row while it does.
    useLayoutEffect(() => {
      const list = listRef.current;
      const root = rootRef.current;

      if (!selectedWidgetId || !widgetTools || !list || !root) {
        return;
      }

      const place = () => {
        const row = rowsRef.current.get(selectedWidgetId);

        if (!row) return;

        const offset =
          row.getBoundingClientRect().top - root.getBoundingClientRect().top;
        const height = toolsRef.current?.offsetHeight ?? 0;
        const room = root.clientHeight - height;

        setToolsTop(Math.max(0, room > 0 ? Math.min(offset, room) : 0));
      };

      place();

      const observer = new ResizeObserver(place);

      observer.observe(root);

      if (toolsRef.current) {
        observer.observe(toolsRef.current);
      }

      list.addEventListener('scroll', place);

      return () => {
        observer.disconnect();
        list.removeEventListener('scroll', place);
      };
    }, [selectedWidgetId, widgetTools]);

    if (editingWidgetId) {
      return (
        <div className={styles.detail}>
          <Button
            type="text"
            size="small"
            icon={<ArrowLeft size={ICON_SIZE} />}
            className={styles.backButton}
            onClick={() => onEditWidget(null)}
          >
            {t('layoutWidgetPanel.back')}
          </Button>

          <div className={styles.detailBody}>
            <WidgetSettings widgetId={editingWidgetId} />
          </div>
        </div>
      );
    }

    return (
      <div className={styles.root} ref={rootRef}>
        <div className={styles.list} ref={listRef}>
          {widgetSettings.widgetsByScreen.map((group) => (
            <div
              className={styles.screenGroup}
              key={group.monitor?.name ?? 'off-screen'}
            >
              <ScreenHeading monitor={group.monitor} />

              {group.widgets.map((widget) => (
                <WidgetRow
                  key={widget.id}
                  widget={widget}
                  isSelected={selectedWidgetId === widget.id}
                  onSelectWidget={onSelectWidget}
                  onEditWidget={onEditWidget}
                  onAnchor={handleAnchor}
                />
              ))}
            </div>
          ))}
        </div>

        {selectedWidgetId && widgetTools && (
          <div
            ref={toolsRef}
            className={styles.toolsPlaque}
            // Data-driven placement: the plaque sits level with its own row.
            style={{ top: toolsTop }}
          >
            {widgetTools}
          </div>
        )}
      </div>
    );
  }
);
