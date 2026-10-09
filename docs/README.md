# Documentation

Start from what you want to do. Each page owns its subject; where two pages
touch, one links to the other instead of repeating it.

New here? Read [CONTRIBUTING.md](../CONTRIBUTING.md) for setup and the
workflow, then [architecture.md → Part 0](architecture.md#part-0--orientation)
for the shape of the app.

## I want to…

### Get started

| …                                        | Read                                                                             |
| ---------------------------------------- | -------------------------------------------------------------------------------- |
| set up, run and build the app            | [CONTRIBUTING → Getting started](../CONTRIBUTING.md#getting-started)             |
| know which checks run and how to commit  | [CONTRIBUTING → Workflow](../CONTRIBUTING.md#workflow)                           |
| look up an environment variable          | [CONTRIBUTING → Environment variables](../CONTRIBUTING.md#environment-variables) |
| look up a term (bundle, tier, instance…) | [CONTEXT.md](../CONTEXT.md)                                                      |

### Understand the app

| …                                                  | Read                                                                                           |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| the whole architecture, backend to widget          | [architecture.md](architecture.md)                                                             |
| the rules, short, with what enforces each          | [AGENTS.md](../AGENTS.md)                                                                      |
| why a decision went the way it did                 | [adr/](adr/README.md) — one file per decision                                                  |
| how the 60 Hz feed renders without re-rendering    | [rendering.md](rendering.md)                                                                   |
| how windows share settings (main, overlay, remote) | [architecture.md → Cross-window synchronization](architecture.md#cross-window-synchronization) |
| where a new file goes                              | [architecture.md → Where does my code go?](architecture.md#where-does-my-code-go)              |

### Build a widget

| …                                                   | Read                                                 |
| --------------------------------------------------- | ---------------------------------------------------- |
| go from an idea to a merged widget, step by step    | [widget-authoring.md](widget-authoring.md)           |
| find a helper, component, hook or token that exists | [widget-toolbox.md](widget-toolbox.md)               |
| write its Storybook stories                         | [widget-stories.md](widget-stories.md)               |
| take its pictures for the README and the site       | [widget-screenshots.md](widget-screenshots.md)       |
| add a steering wheel silhouette to Input Trace      | [steering-wheel-assets.md](steering-wheel-assets.md) |

With an agent, the `new-widget` skill (`.claude/skills/new-widget/`) walks the
same route and writes the files.

### Change the data or the settings

| …                                            | Read                                                                   |
| -------------------------------------------- | ---------------------------------------------------------------------- |
| change the settings file format (migrations) | [settings-schema.md](settings-schema.md)                               |
| add a car's class badge                      | [architecture.md → Car class badges](architecture.md#car-class-badges) |
| add a bindable hotkey / controller action    | [architecture.md → Input bindings](architecture.md#input-bindings)     |
| send a new telemetry field to the frontend   | [architecture.md → Part I — Backend](architecture.md#part-i--backend)  |

### Test and measure

| …                                                     | Read                                                                             |
| ----------------------------------------------------- | -------------------------------------------------------------------------------- |
| record a session as a tape, replay it without iRacing | [telemetry-tapes.md](telemetry-tapes.md)                                         |
| measure performance (`npm run perf`)                  | [telemetry-tapes.md → Measure](telemetry-tapes.md#measure-performance-on-a-tape) |
| see the baseline numbers and add a new run            | [perf-baseline.md](perf-baseline.md)                                             |
| check the UI in the real app                          | [AGENTS.md → Visual Testing](../AGENTS.md#visual-testing)                        |

## Every page

| Page                                                 | Holds                                                                     |
| ---------------------------------------------------- | ------------------------------------------------------------------------- |
| [architecture.md](architecture.md)                   | the full architecture: backend layers, frontend layers, the IPC, settings |
| [rendering.md](rendering.md)                         | hot/cold split, `useReactiveDomWrite`, `useReactiveCanvasLoop`            |
| [settings-schema.md](settings-schema.md)             | the settings load pipeline and how to write a migration                   |
| [widget-authoring.md](widget-authoring.md)           | the route for a new widget, ordered by cost                               |
| [widget-toolbox.md](widget-toolbox.md)               | every module of `shared/lib`, `shared/ui`, `shared/hooks` (test-checked)  |
| [widget-stories.md](widget-stories.md)               | `defineWidgetStories`, seeding, controls                                  |
| [widget-screenshots.md](widget-screenshots.md)       | `capture:widgets`, `SHOTS`, the site's WebP copies                        |
| [steering-wheel-assets.md](steering-wheel-assets.md) | tracing a wheel photo into an SVG and registering it                      |
| [telemetry-tapes.md](telemetry-tapes.md)             | recording, replaying, `npm run perf`                                      |
| [perf-baseline.md](perf-baseline.md)                 | measured numbers, append-only                                             |
| [adr/](adr/README.md)                                | architecture decision records                                             |
| [research/](research/)                               | investigations kept for reference (WebView2 flags)                        |
| [agents/](agents/)                                   | how an agent uses the issue tracker, the domain docs, React Doctor        |
