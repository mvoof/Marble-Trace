import { use } from 'react';

import { useWidgetSettingsStore } from '@store/root-store-context';
import { WidgetIdContext } from '@ui/app/overlay/components/WidgetContainer/WidgetIdContext';
import type {
  BaseUserSettings,
  WidgetSpecificSettings,
} from '@/types/widget-settings';

/**
 * The settings of the copy this component is being rendered as.
 *
 * A layout may hold several copies of a widget — one on the screen being raced
 * on, another on a stream screen with its own columns and its own scale — and
 * each carries settings of its own. A component asking the store for
 * `'standings'` would read the original's settings whichever copy it is
 * drawing, so every copy would render identically and every copy but one would
 * ignore its own settings.
 *
 * The id of the copy comes from `WidgetIdContext`, which the three places that
 * mount widgets all provide: the overlay, the layout editor's canvas and the
 * settings preview. `type` is the fallback for anywhere outside them —
 * Storybook, and tests that render a widget bare — where it names the original.
 */
export const useWidgetSettings = <
  SpecificSettings extends WidgetSpecificSettings,
>(
  type: string
): BaseUserSettings & SpecificSettings => {
  const widgetSettings = useWidgetSettingsStore();
  const instanceId = use(WidgetIdContext);

  return widgetSettings.getSettings<SpecificSettings>(instanceId || type);
};

/**
 * The id of the copy being rendered, for the readers a hook cannot serve.
 *
 * The canvas widgets read their settings *inside* a reactive draw loop, so that
 * every value the paint depends on is tracked — a hook read once at render time
 * would freeze them. They take the id here and do the store read themselves.
 */
export const useWidgetInstanceId = (type: string): string =>
  use(WidgetIdContext) || type;
