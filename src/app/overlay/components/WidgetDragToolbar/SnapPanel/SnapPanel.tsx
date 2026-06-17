import ReactDOM from 'react-dom';
import { observer } from 'mobx-react-lite';
import {
  ArrowDownLeft,
  ArrowDown,
  ArrowDownRight,
  ArrowLeft,
  Maximize2,
  ArrowRight,
  ArrowUpLeft,
  ArrowUp,
  ArrowUpRight,
} from 'lucide-react';
import styles from './SnapPanel.module.scss';
import { useWidgetSettingsStore } from '@store/root-store-context';

const SNAP_MARGIN = 8;
const PANEL_WIDTH = 102;
const TOOLBAR_OFFSET_TOP = 30;

type SnapPosition =
  | 'topLeft'
  | 'topCenter'
  | 'topRight'
  | 'midLeft'
  | 'center'
  | 'midRight'
  | 'bottomLeft'
  | 'bottomCenter'
  | 'bottomRight';

const SNAP_BUTTONS: Array<{
  pos: SnapPosition;
  icon: React.ReactNode;
  title: string;
}> = [
  { pos: 'topLeft', icon: <ArrowUpLeft />, title: 'Top Left' },
  { pos: 'topCenter', icon: <ArrowUp />, title: 'Top Center' },
  { pos: 'topRight', icon: <ArrowUpRight />, title: 'Top Right' },
  { pos: 'midLeft', icon: <ArrowLeft />, title: 'Middle Left' },
  { pos: 'center', icon: <Maximize2 />, title: 'Center' },
  { pos: 'midRight', icon: <ArrowRight />, title: 'Middle Right' },
  { pos: 'bottomLeft', icon: <ArrowDownLeft />, title: 'Bottom Left' },
  { pos: 'bottomCenter', icon: <ArrowDown />, title: 'Bottom Center' },
  { pos: 'bottomRight', icon: <ArrowDownRight />, title: 'Bottom Right' },
];

interface SnapPanelProps {
  widgetId: string;
  onClose: () => void;
}

export const SnapPanel = observer(({ widgetId, onClose }: SnapPanelProps) => {
  const widgetSettings = useWidgetSettingsStore();

  const widget = widgetSettings.getWidget(widgetId);
  const widgetX = widget?.userSettings.x ?? 0;
  const widgetY = widget?.userSettings.y ?? 0;
  const widgetW = widget?.userSettings.currentWidth ?? 200;
  const screenH = window.innerHeight;

  const panelLeft = widgetX + widgetW - PANEL_WIDTH - 4;
  const panelTop = widgetY + TOOLBAR_OFFSET_TOP;
  const clampedTop = Math.min(panelTop, screenH - 120 - SNAP_MARGIN);

  const snapTo = (pos: SnapPosition) => {
    if (!widget) {
      return;
    }

    const width = widget.userSettings.currentWidth;
    const height = widget.userSettings.currentHeight;
    const screenW = window.innerWidth;
    const m = SNAP_MARGIN;

    const positions: Record<SnapPosition, { x: number; y: number }> = {
      topLeft: { x: m, y: m },
      topCenter: { x: Math.round((screenW - width) / 2), y: m },
      topRight: { x: screenW - width - m, y: m },
      midLeft: { x: m, y: Math.round((screenH - height) / 2) },
      center: {
        x: Math.round((screenW - width) / 2),
        y: Math.round((screenH - height) / 2),
      },
      midRight: {
        x: screenW - width - m,
        y: Math.round((screenH - height) / 2),
      },
      bottomLeft: { x: m, y: screenH - height - m },
      bottomCenter: {
        x: Math.round((screenW - width) / 2),
        y: screenH - height - m,
      },
      bottomRight: { x: screenW - width - m, y: screenH - height - m },
    };

    const { x, y } = positions[pos];

    widgetSettings.updatePosition(widgetId, x, y);
    onClose();
  };

  return ReactDOM.createPortal(
    <div
      role="menu"
      tabIndex={-1}
      className={styles.snapPanel}
      style={{ left: panelLeft, top: clampedTop }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {SNAP_BUTTONS.map(({ pos, icon, title }) => (
        <button
          key={pos}
          type="button"
          className={styles.snapButton}
          title={title}
          onClick={(e) => {
            e.stopPropagation();
            snapTo(pos);
          }}
        >
          {icon}
        </button>
      ))}
    </div>,
    document.body
  );
});
