import { use } from 'react';
import { observer } from 'mobx-react-lite';

import {
  normalizeOrder,
  type SettingsOf,
  type SettingsSchema,
  type SettingsShape,
} from '@shared/lib/widget-settings-dsl';
import { PanelWidgetContext } from './Card';
import { ColumnList, type ColumnListItem } from './ColumnList';
import type { BoolKey, Labels } from './schema-rows';
import { useWidgetEditor } from './WidgetEditorContext';

type OrderKey<Shape extends SettingsShape> = {
  [Key in keyof Shape & string]: Shape[Key]['kind'] extends 'order'
    ? Key
    : never;
}[keyof Shape & string];

interface ColumnRowsProps<Shape extends SettingsShape> {
  /** The `order` setting the list reorders. */
  setting: OrderKey<Shape>;
  /**
   * The switch that draws each column, by column. A column reads its name and
   * hint from its switch.
   */
  toggles: Readonly<Record<string, BoolKey<SettingsOf<Shape>>>>;
}

/**
 * A table's columns as a flat list: its order is the `order` setting, each
 * switch the column's own. Outside a panel (Storybook, previews) it shows the
 * shipped settings and writes nothing. Reached through `schemaRows`, which
 * hands it the schema's label reader.
 */
export const columnRows = <Shape extends SettingsShape>(
  schema: SettingsSchema<Shape>,
  useLabelReader: () => (setting: keyof Shape & string) => Labels
) =>
  observer(({ setting, toggles }: ColumnRowsProps<Shape>) => {
    const labelOf = useLabelReader();
    const widgetId = use(PanelWidgetContext);
    const editor = useWidgetEditor();
    const field = schema.shape[setting];

    if (field.kind !== 'order') {
      return null;
    }

    const settings = (widgetId
      ? editor.getSettings(widgetId)
      : schema.defaults) as unknown as Record<string, unknown>;
    const stored = settings[setting];
    const order = normalizeOrder(
      Array.isArray(stored) ? (stored as string[]) : [],
      field.options
    );

    const toggleOf = (column: string) =>
      toggles[column] as keyof Shape & string;

    const write = (partial: Record<string, unknown>) => {
      if (widgetId) {
        editor.updateUserSettings(widgetId, partial);
      }
    };

    const items: ColumnListItem<string>[] = order.map((column) => {
      const { title, desc } = labelOf(toggleOf(column));

      return {
        column,
        label: title,
        hint: desc,
        shown: settings[toggleOf(column)] === true,
      };
    });

    return (
      <ColumnList
        items={items}
        onReorder={(next) => write({ [setting]: next })}
        onToggle={(column, shown) => write({ [toggleOf(column)]: shown })}
      />
    );
  });
