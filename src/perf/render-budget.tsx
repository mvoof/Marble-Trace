import type { ReactNode } from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { runInAction, spy } from 'mobx';

import { RootStore } from '@store/root-store';
import { RootStoreContext } from '@store/root-store-context';
import { seedScenario } from '@store/preview/scenarios';

/**
 * The render-budget harness. Nothing here is imported by the application — it
 * exists only for `*.perf.test.tsx`. See `docs/rendering.md`.
 *
 * It replays a fixed burst of telemetry through the store's own update methods,
 * one MobX action per frame, and reports how many times each `observer`
 * component woke while that happened. Wake-ups, not committed renders: the rule
 * the budgets enforce is about what an observable wakes.
 */

/** MobX names an observer component's reaction `observer<ComponentName>`. */
const OBSERVER_REACTION_PREFIX = 'observer';

/**
 * `observer(function RotatingRing() { … })` shadows the `const RotatingRing` it
 * is assigned to, so the bundler renames the inner function to `RotatingRing2`
 * to keep the two apart. The suffix is the bundler's, not the component's.
 */
const BUNDLER_SHADOW_SUFFIX = /\d+$/;

const componentNameOf = (reactionName: string): string =>
  reactionName
    .slice(OBSERVER_REACTION_PREFIX.length)
    .replace(BUNDLER_SHADOW_SUFFIX, '');

export interface RenderBudgetReport {
  /** Wake-ups keyed by component name, for the frames of the burst only. */
  wakeUps: Record<string, number>;
  /** How many frames were replayed, so a test can express a budget per frame. */
  frames: number;
}

export interface MeasureRenderBudgetOptions<Frame> {
  /** The subtree under test, mounted under a store context of its own. */
  ui: (store: RootStore) => ReactNode;
  /**
   * The frames to replay, built from the seeded store. Built by the test; never
   * by an application module.
   */
  burst: (store: RootStore) => readonly Frame[];
  /** Writes one frame through the store's own update method. */
  applyFrame: (store: RootStore, frame: Frame) => void;
  /** Extra seeding on top of the preview scenario, if the widget needs it. */
  seed?: (store: RootStore) => void;
  /** The preview scenario to seed from; the baseline unless a test says otherwise. */
  scenarioId?: string;
  /**
   * Runs once the burst has been replayed and the frame it scheduled has run,
   * with the still-mounted subtree. This is where a test asserting the other
   * half of the reactive-DOM contract reads what was actually written.
   */
  afterBurst?: (container: HTMLElement) => void;
  /**
   * Runs on the mounted subtree before a single frame of the burst, and before
   * any animation frame has been allowed to run. This is where a test pins what
   * the first paint shows.
   */
  afterMount?: (container: HTMLElement) => void;
}

const bumpWakeUp = (counts: Map<string, number>, componentName: string) => {
  counts.set(componentName, (counts.get(componentName) ?? 0) + 1);
};

/**
 * `spy` is compiled out of a production MobX build, so a config that ever set
 * `NODE_ENV=production` would leave every counter at zero and every budget
 * passing. That failure is silent, so it is checked rather than trusted.
 */
const assertSpyIsLive = (componentWakeUps: Map<string, number>) => {
  if (componentWakeUps.size > 0) {
    return;
  }

  throw new Error(
    'Render budget: MobX spy reported no reactions at all. Either the subtree ' +
      'under test reads nothing observable, or this ran against a production ' +
      'MobX build, where spy is a no-op and every budget passes with zero.'
  );
};

/**
 * A component declared as `observer(() => …)` has no name to report, so every
 * one of them would land in the same bucket. Components under a budget are
 * declared as `observer(function Name() { … })` — see `docs/rendering.md`.
 */
const assertComponentsAreNamed = (componentWakeUps: Map<string, number>) => {
  if (!componentWakeUps.has('')) {
    return;
  }

  throw new Error(
    'Render budget: an observer component in the subtree under test is ' +
      'anonymous, so its wake-ups cannot be attributed. Declare every ' +
      'component under a budget as `observer(function Name() { … })`.'
  );
};

export const measureRenderBudget = async <Frame,>({
  ui,
  burst,
  applyFrame,
  seed,
  scenarioId,
  afterBurst,
  afterMount,
}: MeasureRenderBudgetOptions<Frame>): Promise<RenderBudgetReport> => {
  const store = new RootStore({ skipInit: true });

  seedScenario(store, scenarioId);
  seed?.(store);

  const container = document.createElement('div');

  document.body.appendChild(container);

  const globalScope = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean };
  const previousActEnvironment = globalScope.IS_REACT_ACT_ENVIRONMENT;

  globalScope.IS_REACT_ACT_ENVIRONMENT = true;

  const root = createRoot(container);

  await act(async () => {
    root.render(
      <RootStoreContext.Provider value={store}>
        {ui(store)}
      </RootStoreContext.Provider>
    );
  });

  afterMount?.(container);

  // Counting starts after the first mount: the budget is about what the burst
  // costs, not what putting the widget on screen costs once.
  const componentWakeUps = new Map<string, number>();

  const stopSpying = spy((event) => {
    if (event.type !== 'reaction') {
      return;
    }

    if (!event.name.startsWith(OBSERVER_REACTION_PREFIX)) {
      return;
    }

    bumpWakeUp(componentWakeUps, componentNameOf(event.name));
  });

  const frames = burst(store);

  try {
    for (const frame of frames) {
      await act(async () => {
        runInAction(() => applyFrame(store, frame));
      });
    }
  } finally {
    stopSpying();
  }

  // The bypass writes inside `requestAnimationFrame`, so the last frame of the
  // burst has not landed yet when the loop above ends.
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => resolve());
  });

  afterBurst?.(container);

  await act(async () => {
    root.unmount();
  });

  container.remove();
  globalScope.IS_REACT_ACT_ENVIRONMENT = previousActEnvironment;

  assertSpyIsLive(componentWakeUps);
  assertComponentsAreNamed(componentWakeUps);

  return {
    wakeUps: Object.fromEntries(componentWakeUps),
    frames: frames.length,
  };
};

export interface RenderBudget {
  /** The number this component may not exceed today. */
  budget: number;
  /**
   * Where the budget should be. Present only on a component that predates the
   * rendering rule: recording the current number alone would quietly make it
   * the agreed budget.
   */
  target?: number;
  /** One line of justification, required whenever a budget is raised. */
  note?: string;
}

/**
 * Asserts every component in the table against its budget, and throws with the
 * component, its budget and its actual count named in the message.
 */
export const assertRenderBudgets = (
  report: RenderBudgetReport,
  budgets: Record<string, RenderBudget>
) => {
  const overspent = Object.entries(budgets)
    .map(([componentName, budget]) => ({
      componentName,
      budget,
      actual: report.wakeUps[componentName] ?? 0,
    }))
    .filter(({ budget, actual }) => actual > budget.budget);

  if (overspent.length === 0) {
    return;
  }

  const lines = overspent.map(
    ({ componentName, budget, actual }) =>
      `${componentName}: budget ${budget.budget}, actual ${actual}` +
      (budget.target === undefined ? '' : ` (target ${budget.target})`)
  );

  throw new Error(
    `Render budget exceeded over ${report.frames} frames:\n  ${lines.join('\n  ')}\n\n` +
      'Either the component now wakes for something it does not render, or the ' +
      'budget moved on purpose — see docs/rendering.md.'
  );
};
