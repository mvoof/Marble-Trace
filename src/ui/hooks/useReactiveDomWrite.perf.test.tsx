import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { observable, runInAction } from 'mobx';
import { observer } from 'mobx-react-lite';
import { describe, expect, it } from 'vitest';

import { useReactiveDomWrite } from './useReactiveDomWrite';

/**
 * A browser test rather than jsdom for the same reason the budgets are: the
 * primitive's whole behaviour is a real `requestAnimationFrame` around a real
 * style write, and a faked one of either proves nothing.
 */

const FIRST_PROPERTY = '--first-value';
const SECOND_PROPERTY = '--second-value';

const nextFrame = (): Promise<void> =>
  new Promise((resolve) => {
    requestAnimationFrame(() => resolve());
  });

const values = observable({ first: 1, second: 2 });

const TwoWrites = observer(function TwoWrites() {
  const elementRef = useReactiveDomWrite<HTMLDivElement>(
    (element, scheduleWrite) => {
      const first = values.first;
      const second = values.second;

      scheduleWrite(() =>
        element.style.setProperty(FIRST_PROPERTY, `${first}`)
      );
      scheduleWrite(() =>
        element.style.setProperty(SECOND_PROPERTY, `${second}`)
      );
    },
    []
  );

  return <div data-testid="target" ref={elementRef} />;
});

const readProperties = (container: HTMLElement) => {
  const target = container.querySelector<HTMLDivElement>(
    '[data-testid="target"]'
  )!;

  return {
    first: target.style.getPropertyValue(FIRST_PROPERTY),
    second: target.style.getPropertyValue(SECOND_PROPERTY),
  };
};

const writeCounts = { first: 0, second: 0 };

const CountingWrites = observer(function CountingWrites() {
  const elementRef = useReactiveDomWrite<HTMLDivElement>(
    (element, scheduleWrite) => {
      const first = values.first;
      const second = values.second;

      scheduleWrite(() => {
        writeCounts.first += 1;
        element.style.setProperty(FIRST_PROPERTY, `${first}`);
      });
      scheduleWrite(() => {
        writeCounts.second += 1;
        element.style.setProperty(SECOND_PROPERTY, `${second}`);
      });
    },
    []
  );

  return <div data-testid="target" ref={elementRef} />;
});

const lateMount = observable({ isShown: false, level: 1 });

/**
 * The shape almost every consumer has: the component draws nothing until the
 * value it shows is on screen, so the first commit carries no element at all.
 */
const ShownLate = observer(function ShownLate() {
  const elementRef = useReactiveDomWrite<HTMLDivElement>(
    (element, scheduleWrite) => {
      const level = lateMount.level;

      scheduleWrite(() =>
        element.style.setProperty(FIRST_PROPERTY, `${level}`)
      );
    },
    []
  );

  if (!lateMount.isShown) {
    return null;
  }

  return <div data-testid="target" ref={elementRef} />;
});

describe('useReactiveDomWrite', () => {
  it('keeps every write scheduled in one run', async () => {
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<TwoWrites />);
    });

    expect(readProperties(container)).toEqual({ first: '1', second: '2' });

    runInAction(() => {
      values.first = 3;
      values.second = 4;
    });

    await nextFrame();
    await nextFrame();

    expect(readProperties(container)).toEqual({ first: '3', second: '4' });

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it('costs one write per call site however often the run repeats', async () => {
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<CountingWrites />);
    });

    writeCounts.first = 0;
    writeCounts.second = 0;

    for (const step of [10, 20, 30]) {
      runInAction(() => {
        values.first = step;
        values.second = step + 1;
      });
    }

    await nextFrame();
    await nextFrame();

    expect(writeCounts).toEqual({ first: 1, second: 1 });
    expect(readProperties(container)).toEqual({ first: '30', second: '31' });

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  it('starts writing when the element appears, not when the component mounts', async () => {
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);

    runInAction(() => {
      lateMount.isShown = false;
      lateMount.level = 1;
    });

    await act(async () => {
      root.render(<ShownLate />);
    });

    expect(container.querySelector('[data-testid="target"]')).toBeNull();

    await act(async () => {
      runInAction(() => {
        lateMount.isShown = true;
      });
    });

    // Synchronous, like every first run: the element is on screen carrying
    // none of the value yet, and a deferred write would paint one frame of the
    // stylesheet's fallback first.
    expect(readProperties(container).first).toBe('1');

    runInAction(() => {
      lateMount.level = 2;
    });

    await nextFrame();
    await nextFrame();

    expect(readProperties(container).first).toBe('2');

    await act(async () => {
      root.unmount();
    });
    container.remove();
  });
});
