import { observer } from 'mobx-react-lite';
import { useEffect, useRef } from 'react';
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
}

const ICON_SIZE = 14;

const WidgetRow = observer(
  ({
    widget,
    isSelected,
    onSelectWidget,
    onEditWidget,
  }: {
    widget: WidgetDefaultConfig;
    isSelected: boolean;
    onSelectWidget: (id: string) => void;
    onEditWidget: (id: string) => void;
  }) => {
    const widgetSettings = useWidgetSettingsStore();
    const { t } = useTranslation('main-app');
    const isAvailable = widgetSettings.availableWidgetIds.includes(widget.id);
    const rowRef = useRef<HTMLDivElement>(null);

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
        ref={rowRef}
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

// Master-detail widget panel for the layout editor. The list shows every widget
// (presence toggle = visibility in the active layout). Clicking the gear opens
// that widget's settings inline with a back affordance, keeping the canvas live.
export const LayoutWidgetPanel = observer(
  ({
    selectedWidgetId,
    editingWidgetId,
    onSelectWidget,
    onEditWidget,
  }: LayoutWidgetPanelProps) => {
    const widgetSettings = useWidgetSettingsStore();
    const { t } = useTranslation('main-app');

    if (editingWidgetId) {
      return (
        <div className={styles.detail}>
          <Button
            type="text"
            size="small"
            icon={<ArrowLeft size={14} />}
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
      <div className={styles.list}>
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
              />
            ))}
          </div>
        ))}
      </div>
    );
  }
);
