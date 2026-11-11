import { observer } from 'mobx-react-lite';
import { ColorPicker, Space, Switch } from 'antd';

import { SettingRow } from './SettingRow';

interface ColorToggleRowProps {
  title: string;
  desc?: string;
  color: string;
  /** `rgb` for a colour the widget stores as `rgba(...)`; hex otherwise. */
  colorFormat?: 'hex' | 'rgb';
  onColorChange: (color: string) => void;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}

/** A row whose control is a colour picker beside the switch it qualifies. */
export const ColorToggleRow = observer(
  ({
    title,
    desc,
    color,
    colorFormat = 'hex',
    onColorChange,
    checked,
    onCheckedChange,
  }: ColorToggleRowProps) => (
    <SettingRow title={title} desc={desc}>
      <Space>
        <ColorPicker
          value={color}
          onChange={(next) =>
            onColorChange(
              colorFormat === 'rgb' ? next.toRgbString() : next.toHexString()
            )
          }
        />
        <Switch checked={checked} onChange={onCheckedChange} />
      </Space>
    </SettingRow>
  )
);
