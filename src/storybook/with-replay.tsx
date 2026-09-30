import { useEffect } from 'react';
import type { Decorator } from '@storybook/react-vite';

import type { RootStore } from '@store/root-store';
import { useStore } from '@store/root-store-context';

/**
 * Plays a burst of frames into the story's store once the widget is mounted.
 *
 * A widget that draws a history - a trace, a trail - builds it from successive
 * frames, and a seed hands it only one. Replayed after mount, every update is
 * its own action, the widget's reaction runs per frame and fills its buffer,
 * and the story shows what a few seconds of driving would have left behind.
 * The same thing the in-app preview does with `seedInputHistory`.
 */
export const withReplay = (replay: (store: RootStore) => void): Decorator => {
  const ReplayDecorator: Decorator = (Story) => {
    const store = useStore();

    useEffect(() => {
      replay(store);
    }, [store]);

    return <Story />;
  };

  return ReplayDecorator;
};
