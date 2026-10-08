import { use } from 'react';

import { useLiveWidgetsStore } from '@entities/layout/live-widgets-context';
import { WidgetIdContext } from '@entities/widget/WidgetIdContext';
import { widgetTypeFromId } from '@entities/widget/widget-instance';
import type { BaseUserSettings } from '@shared/contracts/widget-settings';
import type { LiveWidgetsView } from '@entities/layout/live-widgets.store';

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
 *
 * A widget that reads *another* widget's settings (the shift lights follow the
 * race dash's pit assist) is not that widget's copy: the id in the context is
 * its own, and reading by it would find none of the other widget's keys. Such a
 * read takes the instance that speaks for the other widget (`settingsOfType`).
 */
type SettingsReader = Pick<
  LiveWidgetsView,
  'getWidget' | 'getSettings' | 'settingsOfType'
>;

/**
 * Which record a component rendered as `instanceId` reads when it asks for
 * `type`'s settings: its own copy's when that copy is one of `type`, otherwise
 * the instance that speaks for `type`.
 */
export const readWidgetSettings = <
  SpecificSettings extends object = Record<string, unknown>,
>(
  liveWidgets: SettingsReader,
  instanceId: string | null | undefined,
  type: string
): BaseUserSettings & SpecificSettings => {
  if (!instanceId) {
    return liveWidgets.settingsOfType<SpecificSettings>(type);
  }

  const instanceType =
    liveWidgets.getWidget(instanceId)?.type ?? widgetTypeFromId(instanceId);

  if (instanceType !== type) {
    return liveWidgets.settingsOfType<SpecificSettings>(type);
  }

  return liveWidgets.getSettings<SpecificSettings>(instanceId);
};

export const useWidgetSettings = <
  SpecificSettings extends object = Record<string, unknown>,
>(
  type: string
): BaseUserSettings & SpecificSettings =>
  readWidgetSettings<SpecificSettings>(
    useLiveWidgetsStore(),
    use(WidgetIdContext),
    type
  );

/**
 * The id of the copy being rendered, for the readers a hook cannot serve.
 *
 * The canvas widgets read their settings *inside* a reactive draw loop, so that
 * every value the paint depends on is tracked — a hook read once at render time
 * would freeze them. They take the id here and do the store read themselves.
 */
export const useWidgetInstanceId = (type: string): string =>
  use(WidgetIdContext) || type;
