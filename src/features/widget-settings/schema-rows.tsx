import { observer } from 'mobx-react-lite';
import type { i18n as I18n } from 'i18next';
import { useTranslation } from 'react-i18next';
import { InputNumber, Segmented, Slider } from 'antd';

import type {
  SettingsOf,
  SettingsSchema,
  SettingsShape,
} from '@shared/lib/widget-settings-dsl';
import { SettingRow } from './SettingRow';
import { untypedRows, useBoundSetting } from './setting-rows';

/**
 * The panel half of a widget's settings schema: one `Row` per setting, its
 * control picked by the field's kind, its labels by the setting key.
 *
 * A row's title is `settingsPanels.<localeBlock>.<setting>` and its
 * description the same key with `Desc`; a choice's members are
 * `<setting>_<member>`, or `common.<setting>_<member>` for a choice several
 * widgets share. A field with a `label` reads from that key instead — a
 * `common.*` string several widgets share.
 *
 * Kept here, not beside the schema: the schema is read by every window through
 * the manifest, and antd must not reach the overlay or the remote page.
 *
 * Controls with their own logic — a slider with a unit in its tooltip, a
 * segmented control whose labels are not the members ("Off" / "8s") — are
 * still written out in the panel, and take their labels from `useLabels`.
 */
const SLIDER_WIDTH_PX = 160;

type BoolKey<Settings> = {
  [Key in keyof Settings]-?: Settings[Key] extends boolean ? Key : never;
}[keyof Settings];

type Dependency<Settings> =
  | BoolKey<Settings>
  | ((settings: Settings) => boolean);

interface RowProps<Shape extends SettingsShape> {
  setting: keyof Shape & string;
  /** The setting this row qualifies — see `panelRows` in `setting-rows.tsx`. */
  dependsOn?: Dependency<SettingsOf<Shape>>;
  disabled?: boolean;
  /** A choice or a number: the control below the texts, full width. */
  stacked?: boolean;
  /** A number typed in rather than slid — for a wide range or exact values. */
  input?: boolean;
}

interface Labels {
  title: string;
  /** Absent when the locale has no `<key>Desc` — a row can be a title alone. */
  desc?: string;
}

export const schemaRows = <Shape extends SettingsShape>(
  schema: SettingsSchema<Shape>
) => {
  // Typed per setting by `Row`'s own props; underneath, any key.
  const { SwitchRow, ColorRow, DependentBlock } = untypedRows;

  const labelKeyOf = (setting: keyof Shape & string): string => {
    const { label } = schema.shape[setting];

    return label
      ? `settingsPanels.${label}`
      : `settingsPanels.${schema.localeBlock}.${setting}`;
  };

  // A choice several widgets share names its members once, in `common`; a
  // widget's own block may still word them its own way.
  const optionKeyOf = (
    i18n: I18n,
    setting: keyof Shape & string,
    option: string | number
  ): string => {
    const own = `${labelKeyOf(setting)}_${option}`;

    return i18n.exists(own, { ns: 'widgets' })
      ? own
      : `settingsPanels.common.${setting}_${option}`;
  };

  const useLabels = (setting: keyof Shape & string): Labels => {
    const { t, i18n } = useTranslation('widgets');
    const labelKey = labelKeyOf(setting);
    const descKey = `${labelKey}Desc`;

    return {
      title: t(labelKey),
      desc: i18n.exists(descKey, { ns: 'widgets' }) ? t(descKey) : undefined,
    };
  };

  const ValueRow = observer(
    ({
      setting,
      disabled,
      stacked,
      input,
    }: Omit<RowProps<Shape>, 'dependsOn'>) => {
      const { t, i18n } = useTranslation('widgets');
      const { title, desc } = useLabels(setting);
      const { value: current, write } = useBoundSetting(setting);
      const field = schema.shape[setting];

      if (field.kind === 'choice') {
        return (
          <SettingRow title={title} desc={desc} stacked={stacked}>
            <Segmented<string | number>
              block={stacked}
              value={current as string | number}
              disabled={disabled}
              onChange={write}
              options={field.options.map((option) => ({
                label: t(optionKeyOf(i18n, setting, option)),
                value: option,
              }))}
            />
          </SettingRow>
        );
      }

      if (field.kind === 'number' && input) {
        return (
          <SettingRow title={title} desc={desc} stacked={stacked}>
            <InputNumber
              style={stacked ? { width: '100%' } : undefined}
              min={field.min}
              max={field.max}
              step={field.step ?? 1}
              value={current as number}
              disabled={disabled}
              onChange={(next) => next !== null && write(next)}
            />
          </SettingRow>
        );
      }

      if (field.kind === 'number') {
        return (
          <SettingRow title={title} desc={desc} stacked={stacked}>
            <Slider
              style={stacked ? undefined : { width: SLIDER_WIDTH_PX }}
              min={field.min}
              max={field.max}
              step={field.step ?? 1}
              value={current as number}
              disabled={disabled}
              onChange={write}
            />
          </SettingRow>
        );
      }

      return null;
    }
  );

  const Row = observer(
    ({ setting, dependsOn, disabled, stacked, input }: RowProps<Shape>) => {
      const labels = useLabels(setting);
      const field = schema.shape[setting];
      const dependency = dependsOn as string | ((settings: never) => boolean);

      if (field.kind === 'bool') {
        return (
          <SwitchRow
            settingKey={setting}
            dependsOn={dependency}
            disabled={disabled}
            {...labels}
          />
        );
      }

      if (field.kind === 'color') {
        return (
          <ColorRow
            settingKey={setting}
            dependsOn={dependency}
            disabled={disabled}
            hex={
              typeof field.default === 'string' && field.default.startsWith('#')
            }
            {...labels}
          />
        );
      }

      if (dependency === undefined) {
        return (
          <ValueRow
            setting={setting}
            disabled={disabled}
            stacked={stacked}
            input={input}
          />
        );
      }

      return (
        <DependentBlock dependsOn={dependency}>
          <ValueRow
            setting={setting}
            disabled={disabled}
            stacked={stacked}
            input={input}
          />
        </DependentBlock>
      );
    }
  );

  return { Row, useLabels };
};
