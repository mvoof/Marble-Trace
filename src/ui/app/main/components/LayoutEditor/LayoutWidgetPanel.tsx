import { observer } from 'mobx-react-lite';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Switch, Tooltip } from 'antd';
import { Copy, Monitor, TabletSmartphone } from 'lucide-react';
import type {
  LayoutMonitor,
  WidgetDefaultConfig,
} from '@/types/widget-settings';
import { isRemoteMonitor } from '@utils/remote-screen';
import { useWidgetSettingsStore } from '@store/root-store-context';
import { getWidgetLabel } from '@ui/app/widget-i18n';
import styles from './LayoutWidgetPanel.module.scss';

interface LayoutWidgetPanelProps {
  selectedWidgetId: string | null;
  onSelectWidget: (id: string) => void;
}

const WidgetRow = observer(
  ({
    widget,
    isSelected,
    onSelectWidget,
  }: {
    widget: WidgetDefaultConfig;
    isSelected: boolean;
    onSelectWidget: (id: string) => void;
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
 * The list only says what there is and what is selected. Everything that acts
 * on a widget, its settings included, lives in the inspector on the other side
 * of the canvas.
 */
export const LayoutWidgetPanel = observer(
  ({ selectedWidgetId, onSelectWidget }: LayoutWidgetPanelProps) => {
    const widgetSettings = useWidgetSettingsStore();

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
              />
            ))}
          </div>
        ))}
      </div>
    );
  }
);
