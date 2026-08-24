import { use, type CSSProperties } from 'react';
import { observer } from 'mobx-react-lite';
import { ColorPicker, Switch } from 'antd';

import type { WidgetSpecificSettings } from '@/types/widget-settings';
import { PanelWidgetContext } from './Card';
import { SettingRow } from './SettingRow';
import { useWidgetEditor } from '../WidgetEditorContext';

/**
 * Setting rows that bind themselves.
 *
 * A panel used to spell out the same six lines for every toggle — a
 * `SettingRow`, a `Switch`, the read out of `settings`, the write back through
 * `update`. Only the key and the labels ever differed, and there were eighty of
 * them. These rows take the key and read the widget being edited from the panel
 * context, so a toggle is one line and cannot be wired to the wrong widget.
 *
 * `panelRows<Settings>()` is called once per panel at module level: it is a
 * type-level cast that costs nothing at runtime, and it is what keeps
 * `settingKey` restricted to the keys of that widget's settings which actually
 * hold the right type.
 */
type KeysOfType<Settings, Value> = {
  [Key in keyof Settings]-?: Settings[Key] extends Value ? Key : never;
}[keyof Settings];

interface RowProps {
  settingKey: string;
  title: string;
  desc?: string;
  disabled?: boolean;
  style?: CSSProperties;
}

const useBoundSetting = (settingKey: string) => {
  const widgetId = use(PanelWidgetContext);
  const editor = useWidgetEditor();

  const settings = widgetId
    ? (editor.getSettings(widgetId) as unknown as Record<string, unknown>)
    : undefined;

  return {
    value: settings?.[settingKey],
    write: (value: unknown) => {
      if (!widgetId) return;

      editor.updateUserSettings(widgetId, { [settingKey]: value });
    },
  };
};

const SwitchSettingRow = observer(
  ({ settingKey, title, desc, disabled, style }: RowProps) => {
    const { value, write } = useBoundSetting(settingKey);

    return (
      <SettingRow title={title} desc={desc} style={style}>
        <Switch
          checked={value === true}
          disabled={disabled}
          onChange={(next) => write(next)}
        />
      </SettingRow>
    );
  }
);

const ColorSettingRow = observer(
  ({ settingKey, title, desc, disabled, style }: RowProps) => {
    const { value, write } = useBoundSetting(settingKey);

    return (
      <SettingRow title={title} desc={desc} style={style}>
        <ColorPicker
          value={value as string}
          disabled={disabled}
          onChange={(color) => write(color.toRgbString())}
        />
      </SettingRow>
    );
  }
);

export const panelRows = <Settings extends WidgetSpecificSettings>() => ({
  SwitchRow: SwitchSettingRow as React.ComponentType<
    Omit<RowProps, 'settingKey'> & {
      settingKey: KeysOfType<Settings, boolean>;
    }
  >,
  ColorRow: ColorSettingRow as React.ComponentType<
    Omit<RowProps, 'settingKey'> & {
      settingKey: KeysOfType<Settings, string>;
    }
  >,
});
