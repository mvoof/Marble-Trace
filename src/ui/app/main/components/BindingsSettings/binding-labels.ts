import type { TFunction } from 'i18next';
import { DEFAULT_WIDGETS } from '@store/widget-catalog';
import { APP_OWNER, type Binding } from '@/types/input-bindings';
import type { HotkeyAction } from '@store/hotkeys/binding-types';
import type { InputDevice } from '@/types/bindings';
import { POV_BUTTON_BASE, POV_DIRECTION_COUNT } from './pov';

const WIDGET_LABEL_BY_ID = new Map(
  DEFAULT_WIDGETS.map((widget) => [widget.id, widget.label])
);

export const ownerLabel = (owner: string, t: TFunction): string =>
  owner === APP_OWNER
    ? t('bindings.groups.app')
    : (WIDGET_LABEL_BY_ID.get(owner) ?? owner);

/**
 * The per-widget "add to layout" actions all share one label key, so the widget
 * name is filled in here rather than duplicated into 40 translation entries.
 */
export const actionLabel = (action: HotkeyAction, t: TFunction): string =>
  t(`bindings.actions.${action.labelKey}`, {
    widget: ownerLabel(action.owner, t),
  });

const povLabel = (button: number, t: TFunction): string => {
  const hat = Math.floor((button - POV_BUTTON_BASE) / POV_DIRECTION_COUNT);
  const direction = (button - POV_BUTTON_BASE) % POV_DIRECTION_COUNT;

  return t('bindings.chip.hat', {
    hat: hat + 1,
    direction: t(`bindings.chip.direction.${direction}`),
  });
};

export const bindingLabel = (
  binding: Binding,
  device: InputDevice | undefined,
  t: TFunction
): string => {
  if (binding.kind === 'keyboard') {
    return binding.accelerator;
  }

  // An unknown device is one whose name was never persisted; the raw id is
  // still better than nothing, since it is what identifies the binding.
  const name = device?.productName ?? t('bindings.chip.unknownDevice');

  const button =
    binding.button >= POV_BUTTON_BASE
      ? povLabel(binding.button, t)
      : t('bindings.chip.button', { button: binding.button + 1 });

  return `${name} · ${button}`;
};
