import type { TFunction } from 'i18next';
import type { WidgetDefaultConfig } from '@/types/widget-settings';

// Widget names stay in English everywhere (catalog, editor, settings) —
// only widget config UI text (descriptions, settings labels) is localized.
export const getWidgetLabel = (
  _t: TFunction,
  widget: Pick<WidgetDefaultConfig, 'label'>
): string => widget.label;

export const getWidgetDescription = (
  t: TFunction,
  widget: Pick<WidgetDefaultConfig, 'id' | 'description'>
): string =>
  t(`catalog.${widget.id}.description`, {
    ns: 'widgets',
    defaultValue: widget.description ?? '',
  });
