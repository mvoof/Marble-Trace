# Contributing to Marble Trace

> [!NOTE]
> Please prefer English language for all communication.

Before creating an issue, check that the problem is not
[already reported](https://github.com/mvoof/Marble-Trace/issues).

- [Getting started](#getting-started) — tools, setup, running the app
- [Workflow](#workflow) — branch, checks, commit, pull request
- [Where to read next](#where-to-read-next) — the docs, by task
- [Environment variables](#environment-variables) — every one, in one place
- [Agent tooling](#agent-tooling) — what is tracked for AI agents, and what is not

---

## Getting started

### Prerequisites

| Tool                                                                | Version / note                                                                     |
| ------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Windows                                                             | the iRacing SDK is Windows-only                                                    |
| [Node.js](https://nodejs.org/)                                      | 20.19+ or 22.12+ (what Vite 7 requires)                                            |
| [Rust](https://rustup.rs/)                                          | stable, with `rustfmt` and `clippy` (the commit hooks run both)                    |
| [Tauri v2 prerequisites](https://v2.tauri.app/start/prerequisites/) | WebView2 and the MSVC build tools                                                  |
| [uv](https://docs.astral.sh/uv/)                                    | optional — only to trace a steering wheel ([guide](docs/steering-wheel-assets.md)) |

iRacing itself is optional: a recorded tape runs the app without it
([docs/telemetry-tapes.md](docs/telemetry-tapes.md)), and Storybook shows every
widget on mock data.

### Setup

```sh
git clone https://github.com/your-username/Marble-Trace.git   # your fork
cd Marble-Trace
git remote add upstream https://github.com/mvoof/Marble-Trace.git
npm install            # also installs the lefthook commit hooks
```

### Run

```bash
npm run tauri:dev          # the app in dev mode, with the `dev` feature
npm run storybook          # widgets in isolation on :6006, no sim needed
```

`npm run tauri:dev` opens **main** (the settings) and one transparent
**overlay** window per monitor, the widgets of that monitor drawn in it.

### Build

```bash
npm run tauri:build:dev       # unsigned, with the `dev` feature
npm run tauri:build:release   # what ships
```

### Every script

| Command                                      | Does                                                                     |
| -------------------------------------------- | ------------------------------------------------------------------------ |
| `npm test`                                   | vitest, once                                                             |
| `npm run typecheck`                          | `tsc --noEmit`                                                           |
| `npm run lint` / `npm run lint:fix`          | oxlint, type-aware — this is what enforces the layers                    |
| `npm run format`                             | oxfmt over ts, scss, json, md                                            |
| `cd src-tauri && cargo fmt`                  | Rust formatting                                                          |
| `cd src-tauri && cargo clippy --all-targets` | Rust lints, test modules included                                        |
| `cd src-tauri && cargo test`                 | Rust tests                                                               |
| `npm run capture:widgets`                    | widget pictures from Storybook ([guide](docs/widget-screenshots.md))     |
| `npm run perf`                               | performance run on a tape ([guide](docs/telemetry-tapes.md))             |
| `npm run wheel:trace`                        | trace a wheel photo into an SVG ([guide](docs/steering-wheel-assets.md)) |

---

## Workflow

### 1. Branch

```sh
git fetch upstream
git checkout -b feature/short-description upstream/main
```

### 2. Change

Follow the rules in [AGENTS.md](AGENTS.md) — every section there says what
enforces it: a lint rule, a test, or review. Add tests where the change has
behaviour worth pinning.

- **A new widget:** read [docs/widget-authoring.md](docs/widget-authoring.md)
  before opening a widget file — the route from an idea to a merged widget,
  ordered by cost. [docs/widget-toolbox.md](docs/widget-toolbox.md) lists what
  already exists, so you do not write a fifth lap-time formatter.
- **A widget that reads telemetry:** read [docs/rendering.md](docs/rendering.md)
  first — the overlay renders under a 60 Hz feed.
- **The settings file format:** read [docs/settings-schema.md](docs/settings-schema.md).
  Most changes need no migration.
- **Anything visual:** check it in the running app, not in a browser.

### 3. Check

The commit hooks (`lefthook.yml`) run on the staged files: oxlint with
`--fix`, oxfmt, `tsc`, the related vitest tests, and for Rust `cargo fmt`,
`cargo clippy --all-targets -D warnings` and `cargo test`. A failing hook stops
the commit — fix the cause; do not skip it. Before opening a pull request also
run the whole suite once (`npm test`) and `npm run tauri:build:dev`.

### 4. Commit

Messages follow [Conventional Commits](https://conventionalcommits.org):

```
<type>[optional scope]: <description>
```

| `<type>`   | for                                               |
| ---------- | ------------------------------------------------- |
| `feat`     | a new feature                                     |
| `fix`      | a bug fix                                         |
| `perf`     | a change that improves performance                |
| `refactor` | neither a feature, a fix nor a performance change |
| `docs`     | documentation only                                |
| `test`     | tests only                                        |
| `style`    | cosmetic code change                              |
| `ci`       | CI configuration and scripts                      |
| `chore`    | repository maintenance                            |
| `revert`   | reverts earlier commits                           |

The scope is usually the widget or the area (`feat(fuel): …`,
`fix(settings): …`).

### 5. Keep up to date and push

```sh
git fetch upstream
git rebase upstream/main          # resolve conflicts, then: git rebase --continue
git push -u origin feature/short-description
git push --force-with-lease       # after a rebase of an already pushed branch
```

> [!IMPORTANT]
> Never run `git pull` on your branch after a rebase. The rebase rewrote your
> commits, so local and remote have diverged; `pull` merges the two and brings
> the pre-rebase copies back as duplicates. Force-push instead.

### 6. Open a pull request

Against `main`, saying what changed and why. A new widget comes with its
pictures, its README section and its site card
([widget-authoring.md → Step 12](docs/widget-authoring.md#step-12--put-it-in-the-readme-and-on-the-site)).

---

## Where to read next

**[docs/README.md](docs/README.md)** is the index of every page, by task. The
ones asked about most:

| I want to…                                   | Read                                                                                                        |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| understand the architecture                  | [docs/architecture.md](docs/architecture.md)                                                                |
| know why a decision went the way it did      | [docs/adr/](docs/adr/README.md)                                                                             |
| build a widget                               | [docs/widget-authoring.md](docs/widget-authoring.md)                                                        |
| write its stories / take its pictures        | [docs/widget-stories.md](docs/widget-stories.md) · [docs/widget-screenshots.md](docs/widget-screenshots.md) |
| record or replay a tape, measure performance | [docs/telemetry-tapes.md](docs/telemetry-tapes.md)                                                          |
| change the settings format                   | [docs/settings-schema.md](docs/settings-schema.md)                                                          |
| add a steering wheel silhouette              | [docs/steering-wheel-assets.md](docs/steering-wheel-assets.md)                                              |
| add a car class badge                        | [docs/architecture.md → Car class badges](docs/architecture.md#car-class-badges)                            |
| add a hotkey or controller action            | [docs/architecture.md → Input bindings](docs/architecture.md#input-bindings)                                |

---

## Environment variables

None of these is needed to build or run the app. They switch on diagnostics,
recording and generation steps you use while developing.

On PowerShell set a variable for one run with `$env:NAME = 'value'; npm run tauri:dev`
(it stays set for the rest of that terminal; `Remove-Item Env:NAME` clears it).
In Git Bash, prefix the command: `NAME=value npm run tauri:dev`. **Write paths
with forward slashes** (`D:/tapes`): Git Bash reads a backslash as an escape and
drops it.

### Runtime — read when the app starts

| Variable                    | Build      | Effect                                                                                                                                                                                                                                                                                |
| --------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `RUST_LOG`                  | any        | `tracing` filter for the backend console and the log file, replacing the default (`marble_trace_lib=info` for the file). `RUST_LOG=marble_trace_lib=debug` gives verbose backend logs; `marble_trace_lib::telemetry=debug` narrows them to one module.                                |
| `MARBLE_TRACE_RECORD`       | `dev` only | A directory. Every live sim connection is recorded into it as its own tape, `session-<unix seconds>.tape.jsonl.gz`: each tick's adapted frame plus the raw session YAML. The directory is created if missing. Writing happens on a thread of its own, off the telemetry loop.         |
| `MARBLE_TRACE_REPLAY`       | `dev` only | Path to a tape. The app plays it at the pace it was recorded **instead of** connecting to the sim, and loops it: at the end of the tape the source disconnects, the runtime resets and reconnects, and the tape starts over. A tape that cannot be opened falls back to the live sim. |
| `MARBLE_TRACE_REPLAY_FROM`  | `dev` only | Seconds into the tape to start from, so a perf run measures the same stretch of driving every time. Frames before it are skipped; the last session recorded before it is kept.                                                                                                        |
| `MARBLE_TRACE_PERF`         | `dev` only | Path of a JSON report. Starts a perf run on the replayed tape: after the warm-up the delivery counters and tick timings reset, every overlay collects for the measured span, the report is written and the app exits. `npm run perf` sets this and the three below for you.           |
| `MARBLE_TRACE_PERF_SECONDS` | `dev` only | Measured span of a perf run, default 60.                                                                                                                                                                                                                                              |
| `MARBLE_TRACE_PERF_WARMUP`  | `dev` only | Playback before the measured span starts, default 10.                                                                                                                                                                                                                                 |
| `MARBLE_TRACE_PERF_MODE`    | `dev` only | `widgets` (default) or `stores-only`: telemetry is received and applied, no widget is mounted.                                                                                                                                                                                        |
| `MARBLE_TRACE_PERF_HEAP`    | `dev` only | `1` while `npm run perf -- --heap` takes a heap profile over CDP: the overlays hold their report until the profile is taken.                                                                                                                                                          |

`dev` is the cargo feature `npm run tauri:dev` and `npm run tauri:build:dev`
enable; a release build ignores every tape and perf variable. Use **absolute
paths** for them — `tauri dev` runs the backend with `src-tauri/` as its working
directory, so a relative path lands there. How to use them, step by step:
[docs/telemetry-tapes.md](docs/telemetry-tapes.md).

The backend log is `%APPDATA%\com.voof.marble-trace\logs\marble-trace.log`
(the previous run's is `marble-trace.log.old`).

### Build time — baked into the executable

Read by `src-tauri/build.rs` from the environment or from `src-tauri/.env`
(gitignored). A missing value still builds.

| Variable                  | Effect                                                                                                                                                                                                                |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `APTABASE_KEY`            | Analytics key. Unset, the analytics plugin gets an empty key.                                                                                                                                                         |
| `MARBLE_TRACE_SOURCEMAPS` | Read by `vite.config.ts`, not `build.rs`, and not from `.env`. `1` makes `vite build` emit hidden source maps; `npm run perf -- --build` sets it so a heap profile resolves to source files. Never set for a release. |
| `TWITCH_CLIENT_ID`        | Twitch application id for stream chat. Unset, Twitch sign-in needs a client id entered in the app's settings.                                                                                                         |

### Tooling

| Variable          | Used by                     | Effect                                                                                                                                                                                                                                                                                      |
| ----------------- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `UPDATE_BINDINGS` | `cargo test --features dev` | Lets the test `regenerates_the_contract_on_demand` rewrite `src/shared/contracts/bindings.ts` and the generated constants; without it the test does nothing: `UPDATE_BINDINGS=1 cargo test --features dev regenerates_the_contract`. The output is unformatted; the commit hook formats it. |
| `STORYBOOK_URL`   | `npm run capture:widgets`   | Storybook to take widget pictures from. Default `http://localhost:6006`.                                                                                                                                                                                                                    |
| `TAURI_DEV_HOST`  | `vite.config.ts`            | Host the dev server binds and serves HMR on, for running the frontend on another device. Set by the Tauri CLI when needed.                                                                                                                                                                  |

---

## Agent tooling

`AGENTS.md`, the project skills under `.claude/skills/` and `.mcp.json` are
tracked: they are the shared contract an agent working in this repository reads,
and the MCP server the visual-testing workflow needs.

Anything that makes your machine run third-party code is **not** tracked, and is
yours to opt into. `.claude/settings.json` is gitignored along with
`settings.local.json` — put `enabledPlugins`, `enableAllProjectMcpServers` and
your permission allow-list in the local file, so a clone never enables a plugin
you have not read. The MCP server in `.mcp.json` is pinned to an exact version
for the same reason; bump it deliberately, in its own commit.

---

If you have any questions or need help, open an issue or ask in the discussions.
We appreciate your contributions!
