import type { TFunction } from 'i18next';
import type { WidgetDefaultConfig } from '@shared/contracts/widget-settings';

// Widget names stay in English everywhere (catalog, editor, settings) —
// only widget config UI text (descriptions, settings labels) is localized.
export const getWidgetLabel = (
  _t: TFunction,
  widget: Pick<WidgetDefaultConfig, 'label'>
): string => widget.label;

// Keyed by the widget's type, never by `id`: an instance's id is its own, and a
// lookup by it silently falls through to the untranslated shipped string.
export const getWidgetDescription = (
  t: TFunction,
  widget: Pick<WidgetDefaultConfig, 'type' | 'description'>
): string =>
  t(`catalog.${widget.type}.description`, {
    ns: 'widgets',
    defaultValue: widget.description ?? '',
  });
