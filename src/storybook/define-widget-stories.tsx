import { useLayoutEffect, useRef } from 'react';
import type { ComponentType } from 'react';
import { runInAction } from 'mobx';
import type { Decorator, Meta, ArgTypes } from '@storybook/react-vite';

import type { RootStore } from '@store/root-store';
import { useStore } from '@store/root-store-context';
import { withStore } from '../../.storybook/decorators';
import { widgetDecorator } from './widgetDecorator';
import { seedFromSnapshot } from './seed-from-snapshot';

interface WidgetStorySize {
  width?: number | string;
  height?: number | string;
  minWidth?: number;
  background?: string;
  display?: string;
  borderRadius?: number | string;
}

interface DefineWidgetStoriesOptions<Args> {
  /** The widget component to render (no props — reads its own stores). */
  widget: ComponentType;
  /** Decorator frame size/background that mimics WidgetContainer. */
  size?: WidgetStorySize;
  /** Load the shared telemetry snapshot as a baseline before `seed`. */
  seedSnapshot?: boolean;
  /** The only widget-specific part: push `args` into the stores. */
  seed?: (store: RootStore, args: Args) => void;
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
 *   title: 'Widgets/SpeedWidget',
 *   ...defineWidgetStories<StoryArgs>({ widget: SpeedWidget, size, seed, args }),
 * };
 * export default meta;
 * ```
 *
 * Each `export const` story is then just an args override. The snapshot baseline
 * and `seed` re-run on every args change, so Controls drive the widget live for
 * visual testing.
 *
 * A single frame wraps the widget; a story can resize it (e.g. swap a vertical
 * layout) via `parameters: { widgetFrame: { width, height } }` — this overrides
 * the default `size` in place instead of nesting a second clipped frame.
 */
export const defineWidgetStories = <Args,>(
  options: DefineWidgetStoriesOptions<Args>
): WidgetMeta<Args> => {
  const { widget: Widget, size, seedSnapshot, seed, args, argTypes } = options;

  const StoryHost = ({ hostArgs }: { hostArgs: Args }) => {
    const store = useStore();

    const argsSignature = JSON.stringify(hostArgs);
    const cachedArgs = useRef(hostArgs);

    if (cachedArgs.current !== hostArgs) {
      cachedArgs.current = hostArgs;
    }

    useLayoutEffect(() => {
      runInAction(() => {
        if (seedSnapshot) {
          seedFromSnapshot(store);
        }

        if (seed) {
          seed(store, cachedArgs.current);
        }
      });
    }, [store, argsSignature]);

    return <Widget />;
  };

  const frameDecorator: Decorator = (Story, context) => {
    const override = context.parameters.widgetFrame as
      | WidgetStorySize
      | undefined;

    return widgetDecorator({ ...size, ...override })(Story, context);
  };

  return {
    render: (renderArgs: Args) => <StoryHost hostArgs={renderArgs} />,
    parameters: { layout: 'centered' },
    decorators: [withStore(), frameDecorator],
    args: args as Args,
    argTypes,
  } as WidgetMeta<Args>;
};
