import { observer } from 'mobx-react-lite';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Popconfirm, Switch, Tooltip } from 'antd';
import {
  ChevronDown,
  ChevronRight,
  Copy,
  Monitor,
  TabletSmartphone,
  Trash2,
} from 'lucide-react';
import type {
  LayoutMonitor,
  WidgetDefaultConfig,
} from '@/types/widget-settings';
import type { MonitorWidgetRow } from '@store/settings/live-widgets.store';
import { isRemoteMonitor } from '@utils/remote-screen';
import {
  useLayoutsStore,
  useLiveWidgetsStore,
} from '@store/root-store-context';
import styles from './LayoutWidgetPanel.module.scss';

interface LayoutWidgetPanelProps {
  selectedWidgetId: string | null;
  onSelectWidget: (id: string) => void;
}

interface SelectionProps {
  selectedWidgetId: string | null;
  onSelectWidget: (id: string) => void;
}

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
 * One more instance of a widget on this monitor, below the widget's own row:
 * its own switch, its own selection, numbered so the user knows which one they
 * are about to hide.
 */
const InstanceRow = observer(
  ({
    widget,
    ordinal,
    total,
    available,
    selectedWidgetId,
    onSelectWidget,
  }: SelectionProps & {
    widget: WidgetDefaultConfig;
    ordinal: number;
    total: number;
    available: boolean;
  }) => {
    const liveWidgets = useLiveWidgetsStore();
    const { t } = useTranslation('main-app');
    const isSelected = selectedWidgetId === widget.id;
    const rowRef = useScrollIntoViewWhen(isSelected);

    return (
      <div
        ref={rowRef}
        className={`${styles.row} ${styles.instanceRow} ${
          isSelected ? styles.selected : ''
        } ${!available ? styles.disabled : ''}`}
      >
        <Switch
          size="small"
          checked={widget.userSettings.enabled && available}
          disabled={!available}
          onChange={(checked) =>
            liveWidgets.setWidgetEnabled(widget.id, checked)
          }
        />

        <button
          type="button"
          className={styles.label}
          aria-label={t('layoutWidgetPanel.copyTooltip')}
          onClick={() => onSelectWidget(widget.id)}
        >
          <Tooltip title={t('layoutWidgetPanel.copyTooltip')}>
            <span className={styles.copyTag}>
              <Copy size={10} />
              {ordinal}/{total}
            </span>
          </Tooltip>
        </button>

        <Popconfirm
          title={t('layoutWidgetPanel.deleteCopyConfirm')}
          okText={t('layoutWidgetPanel.deleteCopyOk')}
          okButtonProps={{ danger: true }}
          cancelText={t('layoutEditor.cancel')}
          onConfirm={() => {
            liveWidgets.removeWidgetCopy(widget.id);

            // An empty id clears the selection — the copy it named is gone.
            if (isSelected) {
              onSelectWidget('');
            }
          }}
        >
          <Button
            size="small"
            type="text"
            danger
            aria-label={t('layoutWidgetPanel.deleteCopyConfirm')}
            icon={<Trash2 size={12} />}
          />
        </Popconfirm>
      </div>
    );
  }
);

/**
 * A widget on one monitor's list. The switch speaks for this monitor only:
 * on puts the widget here — switching an instance already here back on, or
 * making one — and off takes every instance of it off this monitor.
 */
const WidgetTypeRow = observer(
  ({
    row,
    monitorName,
    selectedWidgetId,
    onSelectWidget,
  }: SelectionProps & { row: MonitorWidgetRow; monitorName: string }) => {
    const liveWidgets = useLiveWidgetsStore();
    const { instances, available } = row;
    const [first] = instances;
    const isOn = instances.some((widget) => widget.userSettings.enabled);
    const isSelected = first !== undefined && selectedWidgetId === first.id;
    const rowRef = useScrollIntoViewWhen(isSelected);

    const handleToggle = (checked: boolean) => {
      const switchedOn = liveWidgets.setTypeEnabledOnMonitor(
        row.type,
        monitorName,
        checked
      );

      if (switchedOn !== null) {
        onSelectWidget(switchedOn);
      }
    };

    return (
      <>
        <div
          ref={rowRef}
          className={`${styles.row} ${isSelected ? styles.selected : ''} ${
            !available ? styles.disabled : ''
          }`}
        >
          <Switch
            size="small"
            checked={isOn && available}
            disabled={!available}
            onChange={handleToggle}
          />

          <button
            type="button"
            className={styles.label}
            disabled={first === undefined}
            onClick={() => first && onSelectWidget(first.id)}
          >
            {row.label}
          </button>
        </div>

        {instances.length > 1 &&
          instances
            .slice(1)
            .map((widget, index) => (
              <InstanceRow
                key={widget.id}
                widget={widget}
                ordinal={index + 2}
                total={instances.length}
                available={available}
                selectedWidgetId={selectedWidgetId}
                onSelectWidget={onSelectWidget}
              />
            ))}
      </>
    );
  }
);

const ScreenHeading = observer(
  ({
    monitor,
    isCollapsed,
    onToggle,
  }: {
    monitor: LayoutMonitor;
    isCollapsed: boolean;
    onToggle: () => void;
  }) => {
    const liveWidgets = useLiveWidgetsStore();
    const Icon = isRemoteMonitor(monitor) ? TabletSmartphone : Monitor;
    const Chevron = isCollapsed ? ChevronRight : ChevronDown;
    const switchedOn = liveWidgets.widgetsOnMonitorNamed(monitor.name).length;

    return (
      <button
        type="button"
        className={styles.screenHeading}
        aria-expanded={!isCollapsed}
        onClick={onToggle}
      >
        <Chevron size={12} />

        <Icon size={12} />

        <span className={styles.screenName}>{monitor.name}</span>

        <span className={styles.screenSize}>
          {monitor.bounds.width}×{monitor.bounds.height}
        </span>

        {/* What a folded screen still has to say: how much is on it. */}
        <span className={styles.screenCount}>{switchedOn}</span>
      </button>
    );
  }
);

const ScreenGroup = observer(
  ({ monitor, ...selection }: SelectionProps & { monitor: LayoutMonitor }) => {
    const liveWidgets = useLiveWidgetsStore();
    const [isCollapsed, setIsCollapsed] = useState(false);

    return (
      <div className={styles.screenGroup}>
        <ScreenHeading
          monitor={monitor}
          isCollapsed={isCollapsed}
          onToggle={() => setIsCollapsed((collapsed) => !collapsed)}
        />

        {!isCollapsed &&
          liveWidgets
            .monitorWidgetRows(monitor.name)
            .map((row) => (
              <WidgetTypeRow
                key={row.type}
                row={row}
                monitorName={monitor.name}
                {...selection}
              />
            ))}
      </div>
    );
  }
);

/**
 * The layout editor's widget list: one list per screen of the layout, each
 * naming every widget the app ships with a switch of its own. Every screen owns
 * its own set — switching a widget on here puts it on this screen, nowhere
 * else.
 *
 * The list only says what there is and what is selected. Everything that acts
 * on a widget, its settings included, lives in the inspector on the other side
 * of the canvas.
 */
export const LayoutWidgetPanel = observer(
  ({ selectedWidgetId, onSelectWidget }: LayoutWidgetPanelProps) => {
    const layouts = useLayoutsStore();
    const monitors = layouts.editingLayout?.monitors ?? [];

    return (
      <div className={styles.list}>
        {monitors.map((monitor) => (
          <ScreenGroup
            key={monitor.name}
            monitor={monitor}
            selectedWidgetId={selectedWidgetId}
            onSelectWidget={onSelectWidget}
          />
        ))}
      </div>
    );
  }
);
