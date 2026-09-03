import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { Button, Popconfirm, Select, Switch, Tooltip } from 'antd';
import {
  ArrowDown,
  ArrowDownLeft,
  ArrowDownRight,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowUpLeft,
  ArrowUpRight,
  BringToFront,
  Copy,
  Maximize2,
  SendToBack,
  Trash2,
} from 'lucide-react';

import { useWidgetSettingsStore } from '@store/root-store-context';
import { getWidgetLabel } from '@ui/app/widget-i18n';
import { WidgetSettings } from '../WidgetSettings/WidgetSettings';
import { Card } from '../WidgetSettings/panels/Card';
import { SettingRow } from '../WidgetSettings/panels/SettingRow';
import type { SnapPosition } from './snap-position';
import styles from './WidgetInspector.module.scss';

const ICON_SIZE = 14;

interface WidgetInspectorProps {
  selectedWidgetId: string | null;
  isRatioLocked: boolean;
  onToggleRatioLock: () => void;
  moveTargetOptions: { value: string; label: string }[];
  /** Selection follows what the tools do — a copy becomes the selection, a
   *  deleted copy leaves none. */
  onSelectWidget: (widgetId: string | null) => void;
  onSnap: (position: SnapPosition) => void;
}

const SNAP_BUTTONS: { position: SnapPosition; Icon: typeof ArrowUpLeft }[] = [
  { position: 'topLeft', Icon: ArrowUpLeft },
  { position: 'topCenter', Icon: ArrowUp },
  { position: 'topRight', Icon: ArrowUpRight },
  { position: 'midLeft', Icon: ArrowLeft },
  { position: 'center', Icon: Maximize2 },
  { position: 'midRight', Icon: ArrowRight },
  { position: 'bottomLeft', Icon: ArrowDownLeft },
  { position: 'bottomCenter', Icon: ArrowDown },
  { position: 'bottomRight', Icon: ArrowDownRight },
];

/**
 * Everything about the selected widget, in one column beside the canvas: what
 * the editor does to it, then its own settings.
 *
 * Where the editors people already know put it, and for the reasons they do —
 * the tools never cover the thing being edited, they have room for words
 * instead of a wall of icons, and there is one place to look for "where do I
 * change this" rather than two.
 *
 * The column keeps its width whether or not anything is selected, so the canvas
 * does not reflow and rescale on every click.
 */
export const WidgetInspector = observer(
  ({
    selectedWidgetId,
    isRatioLocked,
    onToggleRatioLock,
    moveTargetOptions,
    onSelectWidget,
    onSnap,
  }: WidgetInspectorProps) => {
    const widgetSettings = useWidgetSettingsStore();
    const { t } = useTranslation('main-app');

    const widget = selectedWidgetId
      ? widgetSettings.getWidget(selectedWidgetId)
      : undefined;

    if (!selectedWidgetId || !widget) {
      return (
        <div className={styles.empty}>
          {t('widgetSettings.selectToConfigure')}
        </div>
      );
    }

    const isCopy = widget.type !== undefined;
    const { ordinal, total } = widgetSettings.copyOrdinalOf(widget.id);

    return (
      <div className={styles.root}>
        <header className={styles.header}>
          <span className={styles.name}>{getWidgetLabel(t, widget)}</span>

          {total > 1 && (
            <Tooltip
              title={
                isCopy
                  ? t('layoutWidgetPanel.copyTooltip')
                  : t('layoutWidgetPanel.originalTooltip')
              }
            >
              <span className={styles.copyTag}>
                {isCopy && <Copy size={10} />}
                {ordinal}/{total}
              </span>
            </Tooltip>
          )}

          {/* Only a copy: deleting the original would have the next layout load
              put it straight back, which is what the enable switch is for. */}
          {isCopy && (
            <Popconfirm
              title={t('layoutWidgetPanel.deleteCopyConfirm')}
              okText={t('layoutWidgetPanel.deleteCopyOk')}
              cancelText={t('layoutEditor.cancel')}
              onConfirm={() => {
                widgetSettings.removeWidgetCopy(widget.id);
                onSelectWidget(null);
              }}
            >
              <Button
                size="small"
                type="text"
                danger
                icon={<Trash2 size={ICON_SIZE} />}
              />
            </Popconfirm>
          )}
        </header>

        <div className={styles.body}>
          <Card title={t('layoutEditor.inspectorActions')}>
            <SettingRow title={t('layoutEditor.lockAspectRatio')}>
              <Switch
                size="small"
                checked={isRatioLocked}
                onChange={onToggleRatioLock}
              />
            </SettingRow>

            {moveTargetOptions.length > 0 && (
              <SettingRow title={t('layoutEditor.moveToMonitor')}>
                <Select
                  size="small"
                  value={null}
                  placeholder={t('layoutEditor.moveToMonitorPlaceholder')}
                  onChange={(monitorName: string) =>
                    widgetSettings.moveWidgetToMonitor(widget.id, monitorName)
                  }
                  options={moveTargetOptions}
                  popupMatchSelectWidth={200}
                  className={styles.moveSelect}
                />
              </SettingRow>
            )}

            <SettingRow title={t('layoutEditor.layerOrder')}>
              <div className={styles.buttonPair}>
                <Tooltip title={t('layoutEditor.bringToFront')}>
                  <Button
                    size="small"
                    icon={<BringToFront size={ICON_SIZE} />}
                    onClick={() => widgetSettings.bringToFront(widget.id)}
                  />
                </Tooltip>

                <Tooltip title={t('layoutEditor.sendToBack')}>
                  <Button
                    size="small"
                    icon={<SendToBack size={ICON_SIZE} />}
                    onClick={() => widgetSettings.sendToBack(widget.id)}
                  />
                </Tooltip>
              </div>
            </SettingRow>

            <SettingRow title={t('layoutEditor.duplicateWidget')}>
              <Button
                size="small"
                icon={<Copy size={ICON_SIZE} />}
                onClick={() => {
                  const copyId = widgetSettings.duplicateWidget(widget.id);

                  // Selection follows the copy: it is offset from the widget it
                  // came from and on top, so it is the one about to be placed.
                  if (copyId !== null) {
                    onSelectWidget(copyId);
                  }
                }}
              >
                {t('layoutEditor.duplicate')}
              </Button>
            </SettingRow>

            <SettingRow
              title={t('layoutEditor.quickPlacement')}
              desc={t('layoutEditor.quickPlacementDesc')}
            >
              <div className={styles.snapGrid}>
                {SNAP_BUTTONS.map(({ position, Icon }) => (
                  <Button
                    key={position}
                    size="small"
                    type="text"
                    icon={<Icon size={ICON_SIZE} />}
                    onClick={() => onSnap(position)}
                  />
                ))}
              </div>
            </SettingRow>
          </Card>

          <WidgetSettings widgetId={selectedWidgetId} hideHeader />
        </div>
      </div>
    );
  }
);
