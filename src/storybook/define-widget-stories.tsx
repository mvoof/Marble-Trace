import { useLayoutEffect } from 'react';
import type { ComponentType } from 'react';
import { runInAction } from 'mobx';
import type {
  Decorator,
  Meta,
  ArgTypes,
  StoryContext,
} from '@storybook/react-vite';

import type { PreviewScenarioId } from '@/types/preview-scenarios';
import type { RootStore } from '@store/root-store';
import { useStore } from '@store/root-store-context';
import { withStore } from '../../.storybook/decorators';
import { widgetDecorator } from './widgetDecorator';
import { seedFromSnapshot, seedScenario } from './seed-from-snapshot';
import {
  omitSettings,
  pickSettings,
  settingsArgTypesOf,
  settingsDefaultsOf,
  mergeArgTypes,
  widgetIdOfComponent,
} from './widget-settings-args';

interface WidgetStorySize {
  width?: number | string;
  height?: number | string;
  minWidth?: number;
  background?: string;
  widgetBg?: string;
  display?: string;
  borderRadius?: number | string;
  overflow?: string;
  border?: string;
  scale?: number;
}

/**
 * Names a declared scenario as a story's starting state.
 *
 * Spread into a story's `parameters`, it is seeded before the meta's own
 * `seed` runs, so a story states only what makes it different from the
 * scenario. The id is checked against the shipped union, so a typo fails the
 * build rather than showing an empty widget:
 *
 * ```ts
 * export const RunningShort: Story = {
 *   parameters: previewScenario('fuel-short'),
 * };
 * ```
 */
export const previewScenario = (id: PreviewScenarioId) => ({
  previewScenario: id,
});

interface DefineWidgetStoriesOptions<Args> {
  /** The widget component to render (no props — reads its own stores). */
  widget: ComponentType;
  /**
   * The widget whose settings become Controls. Found from the component's
   * `mount.ts` when left out; a story rendering something that is not a
   * mounted widget gets no settings controls.
   */
  widgetId?: string;
  /** Decorator frame size/background that mimics WidgetContainer. */
  size?: WidgetStorySize;
  /** Load the shared telemetry snapshot as a baseline before `seed`. */
  seedSnapshot?: boolean;
  /**
   * The only widget-specific part: push `args` into the stores. It runs after
   * the story's scenario base, and is handed that scenario's id so a seed can
   * leave the domain the scenario already stated alone.
   */
  seed?: (store: RootStore, args: Args, scenarioId?: PreviewScenarioId) => void;
  /** Default control values shared by every story. */
  args?: Partial<Args>;
  /** Storybook control config per arg. */
  argTypes?: Partial<ArgTypes<Args>>;
}

type WidgetMeta<Args> = Pick<
  Meta<Args>,
  'render' | 'decorators' | 'parameters' | 'args' | 'argTypes'
>;

/**
 * Builds everything in a widget `meta` except the `title`, hiding all the
 * repetitive plumbing (store provider, snapshot baseline, decorator frame,
 * runInAction wiring). Spread it into an object-literal `meta` whose only
 * literal field is `title` — that keeps Storybook's static CSF indexer happy
 * (it reads `title` statically) while the rest stays declarative:
 *
 * ```ts
 * const meta: Meta<StoryArgs> = {
 *   title: 'Widgets/FuelWidget',
 *   ...defineWidgetStories<StoryArgs>({ widget: FuelWidget, size, seed, args }),
 * };
 * export default meta;
 * ```
 *
 * Each `export const` story is then just an args override. The snapshot baseline
 * and `seed` re-run on every args change, so Controls drive the widget live for
 * visual testing.
 *
 * A story can name a declared scenario as its starting state via
 * `parameters: previewScenario('fuel-short')`; it is seeded before `seed`, so a
 * story that names one needs no seeding code of its own.
 *
 * A single frame wraps the widget; a story can resize it (e.g. swap a vertical
 * layout) via `parameters: { widgetFrame: { width, height } }` — this overrides
 * the default `size` in place instead of nesting a second clipped frame.
 */
export const defineWidgetStories = <Args,>(
  options: DefineWidgetStoriesOptions<Args>
): WidgetMeta<Args> => {
  const { widget: Widget, size, seedSnapshot, seed, args, argTypes } = options;
  const widgetId = options.widgetId ?? widgetIdOfComponent(Widget);
  const settingsDefaults = widgetId ? settingsDefaultsOf(widgetId) : {};

  const StoryHost = ({
    hostArgs,
    scenarioId,
  }: {
    hostArgs: Args;
    scenarioId?: PreviewScenarioId;
  }) => {
    const store = useStore();

    const argsSignature = JSON.stringify(hostArgs);

    useLayoutEffect(() => {
      runInAction(() => {
        // Widgets gate their content on a live connection (otherwise they show
        // the "no data" placeholder). Stories always render sample data, so mark
        // the sim connected before seeding.
        store.sim.isConnected = true;

        // A scenario lays down the snapshot itself, so naming one makes the
        // meta's own snapshot baseline redundant. The story's `seed` runs last
        // either way, and overrides whatever the base put in place.
        if (scenarioId) {
          seedScenario(store, scenarioId);
        } else if (seedSnapshot) {
          seedFromSnapshot(store);
        }

        // Every setting is written back, not only the changed ones, so a
        // control returned to its default restores it. The story's own seed
        // runs after and keeps the last word on the keys it states.
        if (widgetId) {
          store.liveWidgets.updateUserSettings(
            widgetId,
            pickSettings(hostArgs as Record<string, unknown>, settingsDefaults)
          );
        }

        if (seed) {
          seed(store, hostArgs, scenarioId);
        }
      });
      // hostArgs is re-read through argsSignature, its structural identity.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [store, argsSignature, scenarioId]);

    const widgetProps = omitSettings(
      hostArgs as Record<string, unknown>,
      settingsDefaults
    );

    return <Widget {...widgetProps} />;
  };

  const frameDecorator: Decorator = (Story, context) => {
    const override = context.parameters.widgetFrame as
      | WidgetStorySize
      | undefined;

    return widgetDecorator({ ...size, ...override })(Story, context);
  };

  return {
    render: (renderArgs: Args, context: StoryContext<Args>) => (
      <StoryHost
        hostArgs={renderArgs}
        scenarioId={
          context.parameters.previewScenario as PreviewScenarioId | undefined
        }
      />
    ),
    parameters: { layout: 'centered' },
    decorators: [withStore(), frameDecorator],
    args: { ...settingsDefaults, ...args } as Args,
    argTypes: mergeArgTypes(settingsArgTypesOf(settingsDefaults), argTypes),
  } as WidgetMeta<Args>;
};
