import { observer } from 'mobx-react-lite';
import { useTranslation } from 'react-i18next';
import { Button, InputNumber, Popover, Select, Tooltip } from 'antd';
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
  LayoutGrid,
  Lock,
  Maximize2,
  MonitorUp,
  SendToBack,
  Trash2,
  Unlock,
} from 'lucide-react';

import { useWidgetSettingsStore } from '@store/root-store-context';
import { getWidgetLabel } from '@ui/app/widget-i18n';
import type { WidgetDefaultConfig } from '@/types/widget-settings';
import type { SnapPosition } from './snap-position';
import styles from './WidgetToolbar.module.scss';

interface WidgetToolbarProps {
  widget: WidgetDefaultConfig;
  isRatioLocked: boolean;
  onToggleRatioLock: () => void;
  moveTargetOptions: { value: string; label: string }[];
  /** Selection follows what the tools do — a copy becomes the selection, a
   *  deleted copy leaves none. */
  onSelectWidget: (widgetId: string | null) => void;
  onSnap: (position: SnapPosition) => void;
  popupContainer: () => HTMLElement;
  fullscreen: boolean;
}

/**
 * Everything that acts on the selected widget: its box, its order, its copies.
 *
 * A bar of its own rather than a section of the editor toolbar above. The two
 * answer different questions — that one is about the layout being edited, this
 * one about the one widget in hand — and together they were more tools than a
 * window that is not maximised can show at once, which cost the user the copy
 * button entirely.
 */
export const WidgetToolbar = observer(
  ({
    widget,
    isRatioLocked,
    onToggleRatioLock,
    moveTargetOptions,
    onSelectWidget,
    onSnap,
    popupContainer,
    fullscreen,
  }: WidgetToolbarProps) => {
    const widgetSettings = useWidgetSettingsStore();
    const { t } = useTranslation('main-app');

    return (
      <div
        className={`${styles.bar} ${fullscreen ? `${styles.barWide} ${styles.barFullscreen}` : ''}`}
      >
        <span className={styles.widgetName}>{getWidgetLabel(t, widget)}</span>

        <div className={styles.coordGrid}>
          <span className={styles.coordLabel}>X</span>
          <InputNumber
            size="small"
            className={styles.coordInput}
            value={widget.userSettings.x}
            onFocus={() => widgetSettings.pushUndo()}
            onChange={(value) => {
              if (typeof value === 'number') {
                widgetSettings.updatePosition(
                  widget.id,
                  value,
                  widget.userSettings.y
                );
              }
            }}
          />
          <span className={styles.coordLabel}>Y</span>
          <InputNumber
            size="small"
            className={styles.coordInput}
            value={widget.userSettings.y}
            onFocus={() => widgetSettings.pushUndo()}
            onChange={(value) => {
              if (typeof value === 'number') {
                widgetSettings.updatePosition(
                  widget.id,
                  widget.userSettings.x,
                  value
                );
              }
            }}
          />
          <span className={styles.coordLabel}>W</span>
          <InputNumber
            size="small"
            className={styles.coordInput}
            min={10}
            value={widget.userSettings.currentWidth}
            onFocus={() => widgetSettings.pushUndo()}
            onChange={(value) => {
              if (typeof value === 'number') {
                if (isRatioLocked && widget.userSettings.currentHeight > 0) {
                  const ratio =
                    widget.userSettings.currentWidth /
                    widget.userSettings.currentHeight;
                  const newHeight = Math.max(10, Math.round(value / ratio));

                  widgetSettings.updateSize(widget.id, value, newHeight);
                } else {
                  widgetSettings.updateSize(
                    widget.id,
                    value,
                    widget.userSettings.currentHeight
                  );
                }
              }
            }}
          />
          <span className={styles.coordLabel}>H</span>
          <InputNumber
            size="small"
            className={styles.coordInput}
            min={10}
            value={widget.userSettings.currentHeight}
            onFocus={() => widgetSettings.pushUndo()}
            onChange={(value) => {
              if (typeof value === 'number') {
                if (isRatioLocked && widget.userSettings.currentWidth > 0) {
                  const ratio =
                    widget.userSettings.currentWidth /
                    widget.userSettings.currentHeight;
                  const newWidth = Math.max(10, Math.round(value * ratio));

                  widgetSettings.updateSize(widget.id, newWidth, value);
                } else {
                  widgetSettings.updateSize(
                    widget.id,
                    widget.userSettings.currentWidth,
                    value
                  );
                }
              }
            }}
          />
        </div>

        <div className={styles.actions}>
          <Tooltip
            title={
              isRatioLocked
                ? t('layoutEditor.unlockAspectRatio')
                : t('layoutEditor.lockAspectRatio')
            }
          >
            <Button
              size="small"
              type="text"
              icon={isRatioLocked ? <Lock size={12} /> : <Unlock size={12} />}
              onClick={onToggleRatioLock}
            />
          </Tooltip>

          {moveTargetOptions.length > 0 && (
            <Tooltip title={t('layoutEditor.moveToMonitor')}>
              <Select
                size="small"
                value={null}
                placeholder={<MonitorUp size={12} />}
                onChange={(monitorName: string) =>
                  widgetSettings.moveWidgetToMonitor(widget.id, monitorName)
                }
                options={moveTargetOptions}
                popupMatchSelectWidth={200}
                style={{ width: 56 }}
              />
            </Tooltip>
          )}

          <Tooltip title={t('layoutEditor.duplicateWidget')}>
            <Button
              size="small"
              type="text"
              icon={<Copy size={12} />}
              onClick={() => {
                const copyId = widgetSettings.duplicateWidget(widget.id);

                // Selection follows the copy: it is offset from the
                // widget it came from and on top, so it is the one the
                // user is about to place.
                if (copyId !== null) {
                  onSelectWidget(copyId);
                }
              }}
            />
          </Tooltip>

          {widget.type !== undefined && (
            <Tooltip title={t('layoutEditor.deleteWidgetCopy')}>
              <Button
                size="small"
                type="text"
                icon={<Trash2 size={12} />}
                onClick={() => {
                  widgetSettings.removeWidgetCopy(widget.id);
                  onSelectWidget(null);
                }}
              />
            </Tooltip>
          )}

          <Tooltip title={t('layoutEditor.bringToFront')}>
            <Button
              size="small"
              type="text"
              icon={<BringToFront size={12} />}
              onClick={() => widgetSettings.bringToFront(widget.id)}
            />
          </Tooltip>

          <Tooltip title={t('layoutEditor.sendToBack')}>
            <Button
              size="small"
              type="text"
              icon={<SendToBack size={12} />}
              onClick={() => widgetSettings.sendToBack(widget.id)}
            />
          </Tooltip>

          <Popover
            trigger="click"
            placement="bottom"
            getPopupContainer={popupContainer}
            content={
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 32px)',
                  gap: '4px',
                }}
              >
                <Button
                  size="small"
                  type="text"
                  icon={<ArrowUpLeft size={14} />}
                  onClick={() => onSnap('topLeft')}
                />
                <Button
                  size="small"
                  type="text"
                  icon={<ArrowUp size={14} />}
                  onClick={() => onSnap('topCenter')}
                />
                <Button
                  size="small"
                  type="text"
                  icon={<ArrowUpRight size={14} />}
                  onClick={() => onSnap('topRight')}
                />
                <Button
                  size="small"
                  type="text"
                  icon={<ArrowLeft size={14} />}
                  onClick={() => onSnap('midLeft')}
                />
                <Button
                  size="small"
                  type="text"
                  icon={<Maximize2 size={14} />}
                  onClick={() => onSnap('center')}
                />
                <Button
                  size="small"
                  type="text"
                  icon={<ArrowRight size={14} />}
                  onClick={() => onSnap('midRight')}
                />
                <Button
                  size="small"
                  type="text"
                  icon={<ArrowDownLeft size={14} />}
                  onClick={() => onSnap('bottomLeft')}
                />
                <Button
                  size="small"
                  type="text"
                  icon={<ArrowDown size={14} />}
                  onClick={() => onSnap('bottomCenter')}
                />
                <Button
                  size="small"
                  type="text"
                  icon={<ArrowDownRight size={14} />}
                  onClick={() => onSnap('bottomRight')}
                />
              </div>
            }
          >
            <Tooltip title={t('layoutEditor.quickPlacement')}>
              <Button
                size="small"
                type="text"
                icon={<LayoutGrid size={14} />}
              />
            </Tooltip>
          </Popover>
        </div>
      </div>
    );
  }
);
