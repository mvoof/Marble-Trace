import { use, type CSSProperties, type ReactNode } from 'react';
import { observer } from 'mobx-react-lite';
import { ColorPicker, Switch } from 'antd';

import type { WidgetSpecificSettings } from '@/types/widget-settings';
import styles from '@ui/app/main/components/WidgetSettings/WidgetSettings.module.scss';
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
 *
 * A row that only qualifies another — the ring of a compass, the colour of a
 * line — declares it with `dependsOn` instead of the panel wrapping it in
 * `{settings.x && …}`. Controls that are not a plain switch or colour go in a
 * `DependentBlock`. Gate on whether the feature exists at all, never on a
 * layout choice the user flips back and forth: a row that vanishes under the
 * pointer is worse than one that changes nothing.
 */
// NonNullable so an optional setting (`animate?: boolean`) still counts as a
// boolean key — a row falls back to `fallback` while it is unset.
type KeysOfType<Settings, Value> = {
  [Key in keyof Settings]-?: NonNullable<Settings[Key]> extends Value
    ? Key
    : never;
}[keyof Settings];

/** A key of `Settings` that a `SwitchRow` can bind — for panels that list them. */
export type SwitchKey<Settings> = KeysOfType<Settings, boolean>;

/**
 * What a dependent row qualifies: a boolean setting that must be on, or — when
 * the feature is gated by something other than one switch (a style that has no
 * marker, a colour the class colour overrides) — a predicate over the settings.
 * A predicate spells out its parent too, since it replaces the key.
 */
type Dependency<Settings> =
  | KeysOfType<Settings, boolean>
  | ((settings: Settings) => boolean);

type AnyDependency = string | ((settings: never) => boolean);

interface RowProps {
  settingKey: string;
  /**
   * The setting this row qualifies. The row is hidden while it is off and
   * otherwise drawn indented under the block above it — so it must be placed
   * directly after its parent, as a direct child of the card.
   */
  dependsOn?: AnyDependency;
  title: string;
  desc?: string;
  disabled?: boolean;
  style?: CSSProperties;
  /** What the row shows while the setting itself is undefined. */
  fallback?: boolean | string;
  /** Colors: write `#rrggbb` instead of `rgba(...)`. */
  hex?: boolean;
}

/**
 * The id of the widget record this panel is editing.
 *
 * A panel names the widget it configures in `PANEL_WIDGET_IDS`, but that is a
 * *type* — and since a layout may hold several copies of a widget, the record
 * being edited is one of them and is not addressed by that string. Reading the
 * id from the panel context is what points a panel at the copy the user
 * selected instead of always at the original.
 *
 * `fallbackId` is that type, used only where no panel context exists: Storybook,
 * and previews that render a panel outside the settings page.
 */
export const usePanelWidgetId = (fallbackId: string): string =>
  use(PanelWidgetContext) ?? fallbackId;

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

// Outside a panel (Storybook, previews) there is no record to read, so every
// dependant is shown — a preview that hid half the panel would preview nothing.
const useDependencyMet = (dependsOn: AnyDependency): boolean => {
  const widgetId = use(PanelWidgetContext);
  const editor = useWidgetEditor();

  if (!widgetId) {
    return true;
  }

  const settings = editor.getSettings(widgetId) as unknown as Record<
    string,
    unknown
  >;

  if (typeof dependsOn === 'function') {
    return (dependsOn as (value: unknown) => boolean)(settings);
  }

  return Boolean(settings[dependsOn]);
};

interface DependentBlockProps {
  dependsOn: AnyDependency;
  children: ReactNode;
}

/**
 * A block that qualifies the one above it: hidden while its parent is off,
 * drawn indented and joined to the parent's block while it is on.
 *
 * Joining is done by the card's stylesheet, not by nesting, so a dependant
 * attaches to whatever block precedes it — which is why it must sit right after
 * its parent and there is only ever one level of it.
 */
const DependentSettingBlock = observer(
  ({ dependsOn, children }: DependentBlockProps) => {
    const isMet = useDependencyMet(dependsOn);

    if (!isMet) {
      return null;
    }

    return <div className={styles.fieldSubRow}>{children}</div>;
  }
);

const SwitchSettingRow = observer(
  ({
    settingKey,
    dependsOn,
    title,
    desc,
    disabled,
    style,
    fallback,
  }: RowProps) => {
    const { value, write } = useBoundSetting(settingKey);

    const row = (
      <SettingRow title={title} desc={desc} style={style}>
        <Switch
          checked={value === undefined ? fallback === true : value === true}
          disabled={disabled}
          onChange={(next) => write(next)}
        />
      </SettingRow>
    );

    if (dependsOn === undefined) {
      return row;
    }

    return (
      <DependentSettingBlock dependsOn={dependsOn}>{row}</DependentSettingBlock>
    );
  }
);

const ColorSettingRow = observer(
  ({
    settingKey,
    dependsOn,
    title,
    desc,
    disabled,
    style,
    fallback,
    hex,
  }: RowProps) => {
    const { value, write } = useBoundSetting(settingKey);

    const row = (
      <SettingRow title={title} desc={desc} style={style}>
        <ColorPicker
          value={(value ?? fallback) as string}
          disabled={disabled}
          onChange={(color) =>
            write(hex ? color.toHexString() : color.toRgbString())
          }
        />
      </SettingRow>
    );

    if (dependsOn === undefined) {
      return row;
    }

    return (
      <DependentSettingBlock dependsOn={dependsOn}>{row}</DependentSettingBlock>
    );
  }
);

type TypedRowProps<Settings, Value> = Omit<
  RowProps,
  'settingKey' | 'dependsOn'
> & {
  settingKey: KeysOfType<Settings, Value>;
  dependsOn?: Dependency<Settings>;
};

export const panelRows = <Settings extends WidgetSpecificSettings>() => ({
  SwitchRow: SwitchSettingRow as React.ComponentType<
    TypedRowProps<Settings, boolean>
  >,
  ColorRow: ColorSettingRow as React.ComponentType<
    TypedRowProps<Settings, string>
  >,
  DependentBlock: DependentSettingBlock as React.ComponentType<{
    dependsOn: Dependency<Settings>;
    children: ReactNode;
  }>,
});
