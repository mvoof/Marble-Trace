import type { TFunction } from 'i18next';
import type { WidgetDefaultConfig } from '@/types/widget-settings';
import { widgetTypeOf } from '@utils/widget-instance';

// Widget names stay in English everywhere (catalog, editor, settings) —
// only widget config UI text (descriptions, settings labels) is localized.
export const getWidgetLabel = (
  _t: TFunction,
  widget: Pick<WidgetDefaultConfig, 'label'>
): string => widget.label;

// Keyed by the widget's type, never by `id`: a copy's id is its own, and a
// lookup by it silently falls through to the untranslated shipped string.
export const getWidgetDescription = (
  t: TFunction,
  widget: Pick<WidgetDefaultConfig, 'id' | 'type' | 'description'>
): string =>
  t(`catalog.${widgetTypeOf(widget)}.description`, {
    ns: 'widgets',
    defaultValue: widget.description ?? '',
  });
