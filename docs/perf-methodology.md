# Performance method: what the overlay costs the game

How to measure what Marble Trace costs the sim it sits on top of — frame rate,
1% lows, stutter, latency — and the app-side probes that explain a result. The
decision these measurements led to is [ADR-0009](adr/0009-overlay-changes-on-one-clock.md).

Two harnesses, two questions:

| question                                             | harness                                  | doc                                                                            |
| ---------------------------------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------ |
| what does the app cost **itself** (tick, IPC, heap)? | `npm run perf` on a recorded tape        | [telemetry-tapes.md](telemetry-tapes.md), [perf-baseline.md](perf-baseline.md) |
| what does the app cost **the game**?                 | `npm run perf:game` with iRacing running | this file                                                                      |

The first is cheap and deterministic and belongs to every change that touches
the telemetry path. The second needs the sim and a person driving the replay,
and belongs to every change that changes **how often the overlay changes**.

## How the overlay reaches the game

### The bundle is assembled per tick

The backend reads the sim on every source tick (~60 Hz) and runs every
processor on it. Whether a bundle is **published** on that tick, and what is in
it, is decided per tick:

1. **The clock.** A bundle goes out on every Nth tick: `appSettings.overlayUpdateHz`,
   30 Hz by default (60 / 30 / 20 / 15). Between published ticks the processors
   run and nothing is sent.
2. **Hot fields** — `carDynamics`, `carInputs`, `carPositions`, `lapDelta`,
   `coach`, `pitTarget`, `trackRecording` — are in every published bundle, and
   only if a widget on screen declared them (`telemetryEvents` in its manifest).
3. **Cold fields** ride along when their tier is due: the 10 Hz tier
   (`driverEntries`, `relative`, `proximity`, `lapTiming`, …), the 4 Hz tier
   (`fuel`, `carStatus`, `pitService`, …), the 1 Hz tier (`session`,
   `environment`). A tier is only ever due on a published tick, so a cold
   field never changes the overlay between two hot ones.
4. **Per window**, the bundle is narrowed to that window's mask and repeats of
   the last value are dropped.

So the clock caps how often the overlay _can_ change; the tiers decide _what_
changes and what it costs to send, parse and render. A layout with no hot widget
is sent a bundle only when a cold tier is due — about ten a second.

### Why a change costs the game

The overlay is a transparent, always-on-top window per monitor. Every time its
content changes, DWM composes a new desktop frame on the same GPU the game is
drawing on. A static overlay costs the game almost nothing; a changing one costs
it per change, however little changed. When the game already uses the GPU to
the edge of its frame budget, that extra work pushes its frame past the next
vblank, which shows up as a stutter and a lower 1% low.

Two things set how often the overlay changes:

- **the publication clock** — one change per published bundle at most;
- **anything that animates between bundles** — a CSS transition re-run by each
  value, an infinite CSS animation, a `requestAnimationFrame` loop. Any of them
  changes the overlay on every display frame (164 Hz on the test monitor),
  whatever the clock says.

Both must hold; one without the other measured no better than neither.

## Metrics

Per capture, after dropping the first 15 s (`scripts/perf-game/presentmon.mjs`):

| metric       | definition                                                                                                                                    |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| avg FPS      | frames / time                                                                                                                                 |
| 1% low       | `1000 / p99(frame time)` — the frame rate at the 99th-percentile frame time                                                                   |
| 1% low avg   | `1000 / mean(worst 1% of frame times)` — the CapFrameX-style figure; always quote which of the two                                            |
| 0.1% low     | `1000 / p99.9(frame time)`                                                                                                                    |
| stutter      | a frame longer than **2× the median of the 20 frames before it**; at ~6.5 ms frames on a 164 Hz monitor, a missed vblank. Reported per minute |
| hitch        | a frame longer than 50 ms, counted apart                                                                                                      |
| latency      | PresentMon `DisplayLatency`, average and p99                                                                                                  |
| GPU busy     | PresentMon `GPUBusy`: the game's own GPU time per frame — where the overlay's cost shows up                                                   |
| long frames  | share of frames longer than **2× the capture's median frame** — the frames the 1% low is made of                                              |
| long CPU/GPU | mean `CPUBusy` / `GPUBusy` of the long frames. CPU grown and GPU not: the game was waiting, not drawing more (see Reading a result)           |
| present mode | share of frames per PresentMon `PresentMode`; **must** be `Hardware: Independent Flip` for runs to be comparable                              |

The present mode is the first thing to read. `Composed: Flip` means DWM is
composing the game itself — no multi-plane overlay support, an older Windows, a
driver setting — which is a different and more expensive regime than the one
ADR-0009 was measured in.

## What you need

None of this ships with the repository; each item says how to get it.

| what                                    | how to get it                                                                                                                                                                                                                                                                                        |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| the binary under test                   | `npm run perf:build` — `src-tauri/target/release/marble-trace.exe`, the build every run starts                                                                                                                                                                                                       |
| PresentMon                              | [PresentMon's releases](https://github.com/GameTechDev/PresentMon/releases): the installer puts the console binary where the harness looks, or download the console `.exe` alone and point `PRESENTMON` at it (`CONTRIBUTING.md` → Environment variables)                                            |
| rights to capture                       | administrator, the _Performance Log Users_ group, or `--elevate` on each run (Protocol, step 7)                                                                                                                                                                                                      |
| an iRacing replay                       | drive or spectate a session with the field you want to measure and save its replay in iRacing; open it again before a session. A replay is yours — the numbers below were taken on one that is not shared                                                                                            |
| a layout with every widget (`perf-all`) | in the app, Layouts → add a layout named `perf-all`, switch every widget on for the monitor the game is on and place them so none hides another. Any layout name works with `--layout`; `perf-all` is only the name these docs use                                                                   |
| widget ids for `--widgets`              | the instance ids of the layout passed with `--layout`. The first instance of a widget on a layout carries the widget's own id (`track-map`, `standings`, …, the folder names under `src/widgets/`); a further copy is `<id>-2`, `<id>-3`, as `%APPDATA%m.voof.marble-tracesettings.json` lists them |
| a tape, for `changes` and `heap` only   | record one: [telemetry-tapes.md](telemetry-tapes.md) → Record a session. Tapes are large and stay out of git                                                                                                                                                                                         |

## Protocol

1. **One machine, one day, alternating.** Absolute numbers from another day or
   another PC are not comparable; deltas against a game-only run taken in the
   same session are. Alternate the scenarios (S0, A, B, A, B, S0) so a drift in
   conditions shows up rather than landing in one scenario.
2. **A replay, not live driving.** Save a replay of a session with the field you
   want to measure, pick a point, use one camera. `mark` saves the frame the
   replay stands on, and `run --rewind` puts the replay back on it and plays it
   before every capture; the harness then waits the same lead time for every
   run, app or not, so each capture covers the same stretch. Live driving is
   usable for large effects but every run sees a different scene. Two points of
   one replay can differ a lot — the same build and layout read a 1% low of 96
   at one and 65 at another — so compare only runs taken from one point.
3. **At least three runs per scenario.** A run does not land on a stable value:
   the same build, layout and point fell either near 65 or near 110–125 from one
   run to the next. One capture per variant proves nothing; read the spread of
   three, and suspect any single number that disagrees with the rest.
4. **The game full screen**, borderless, as the user would race; note the FPS
   cap, VRR and resolution. Close what else draws: browsers, recorders, the
   editor you are reading results in. **Nothing may sit over the game window**
   — a chat or an editor on top is composed like an overlay, and its redraws
   cost the game the same way (one such capture of the game "alone" read 78
   stutters a minute against 1). `run` warns when the game is not the
   foreground window and saves a screenshot with every capture.
5. **90 s per capture** after 15 s of warm-up (105 s captured).
6. **Settings.** A run makes the chosen layout active, turns layout auto-switch
   off (a replay's session would switch it back), switches off every widget not
   asked for and sets the overlay rate — then restores the settings file byte
   for byte. Close Marble Trace before a run; the harness starts its own build
   (`src-tauri/target/release/marble-trace.exe`, from `npm run perf:build`).
7. **PresentMon access.** Capturing needs ETW rights: administrator, or the
   account in the _Performance Log Users_ group (`net localgroup "Performance
   Log Users" <user> /add`, then sign out and in). Without either, pass
   `--elevate` and confirm the UAC prompt on each run.

### Scenarios

| scenario | command                                                                 | isolates                          |
| -------- | ----------------------------------------------------------------------- | --------------------------------- |
| S0       | `run --name s0 --no-app`                                                | the reference                     |
| static   | `run --name static --widgets lap-log` (any widget that does not change) | the window itself                 |
| layout   | `run --name race --layout race`                                         | what a driver actually runs       |
| all      | `run --name all --layout perf-all`                                      | the worst case                    |
| rate     | `… --rate 60` against `… --rate 30`                                     | the clock                         |
| bisect   | `… --widgets a,b,c` halving the set                                     | which widget, when one stands out |

A layout with every widget (`perf-all`) is worth keeping for these runs.

## Step by step

One session, start to finish. Every `run` below takes `--rewind --elevate`
(the latter only without _Performance Log Users_) and `--out <dir>`, the same
directory for the whole session: the replay point is kept there.

1. **Build the binary under test.** `npm run perf:build`. To compare two
   commits, build the other one in a `git worktree` with
   `CARGO_TARGET_DIR` pointing at this repo's `src-tauri/target`, keep both
   `marble-trace.exe` files under their own names, and copy the one a run
   measures into place before it.
2. **Set up the game.** iRacing full screen, borderless; open the replay, pick
   one camera. Close every window that draws, and Marble Trace itself.
3. **Mark the point.** Stand the replay where the captures should begin and run
   `npm run perf:game -- mark`. The stretch after it must hold for the whole
   capture: 20 s of lead and 105 s of capture.
4. **Take the reference.** `run --name s0a --no-app`.
5. **Alternate the variants**, three runs each: A, B, A, B, A, B
   (`run --name a1 --layout perf-all --rate 30`, …). A variant is a widget set
   (`--widgets`), a rate (`--rate`) or a build (step 1).
6. **Close with the reference.** `run --name s0b --no-app`. If it moved far from
   `s0a`, the conditions drifted during the session and the variants between
   them cannot be compared.
7. **Check every screenshot** beside its capture: the game in front, the
   expected widgets on, nothing else over it.
8. **Read the numbers** with `report <capture.csv>...` and Reading a result
   below: the present mode first, then the spread of each variant's three runs,
   then the long frames.
9. **Bisect** when a set costs more than expected: halve it with `--widgets`,
   three runs per half, and keep halving the half that holds the cost. Before
   blaming a widget's drawing, check how often it changes the overlay at all
   (`changes`, below): a widget that changes on every bundle costs what any
   other such widget would.

Captures, screenshots and the replay point stay in `--out`; copy what is worth
keeping out of the temporary directory before it is cleaned.

## Commands

```bash
npm run perf:build                                         # the measured binary, once per change
npm run perf:game -- mark                                  # remember where the replay stands
npm run perf:game -- run --name s0 --no-app --rewind --elevate      # game alone
npm run perf:game -- run --name all-30 --layout perf-all --rate 30 --rewind --elevate
npm run perf:game -- report <capture.csv>...               # summarize saved captures side by side
npm run perf:game -- changes --tape <your tape> --from 600 --layout perf-all
npm run perf:game -- heap --seconds 120 --tape <your tape> --from 600
npm run perf:game -- processes --seconds 30                # with the app (and game) running
```

Captures, screenshots and the settings backup go to
`%TEMP%\marble-trace-perf\game\` unless `--out` says otherwise. Each `run`
saves a screenshot beside its capture: look at it before trusting the numbers —
it is how a minimized overlay or the wrong layout is caught.

## App-side probes

They explain a result; they do not replace the capture.

- **`changes`** — who requests animation frames and which CSS animations and
  transitions are running. Requests at a multiple of the bundle rate are fine:
  the browser folds them into one frame per bundle. **Any running animation is
  not**, and is the first thing to look at when a lower clock does not help.
  Callers are minified; resolve them against `dist/assets/*.map` of the build.
- **`heap`** — the JS heap over time, the collector over 10 s, and a forced full
  collection with the renderer's allocators (`v8`, `blink_gc`, …) before and
  after. What a forced collection removes was garbage not yet reached; what
  stays is what the overlay holds.
- **`processes`** — CPU, private memory and GPU 3D time of every app process by
  role (Rust, WebView2 browser / GPU / renderers) and of DWM, from perf
  counters.

Pitfalls found the hard way:

- **Tracing loads what it measures.** A Chromium trace with the `gpu` or `viz`
  categories keeps the WebView2 GPU process's main thread 95–99 % busy even on
  an empty overlay. Busy-thread figures from such a trace are not evidence;
  GPU engine counters and PresentMon are.
- **Present counts do not discriminate.** The overlay's GPU process presents at
  the monitor's rate even when nothing changed; those idle presents are cheap.
  What matters is the number of frames with new content.
- **Synthetic load is a good model.** A 240 px SVG compass turned at a fixed
  rate reproduced a real widget's cost within the run-to-run spread, and it is
  how the rate curve below was taken without editing a widget.
- **DWM's CPU time reads zero** without administrator rights.
- **One run is not a result.** Captures of one variant fell into two groups, a
  1% low near 65 or near 110–125, with nothing changed between them — the 15 Hz
  map read 109, then 63. Hence three runs per variant.
- **The long frames are the game waiting, not drawing.** In the slow group the
  game's long frames took ~15 ms of CPU against ~5 ms for a normal one, while
  its GPU time barely moved (7.3 against 6.5 ms). Lowering the priority of every
  app process and pinning them to four cores of their own changed nothing, so
  the game is not losing CPU to the overlay's threads; it waits on something
  both share when the overlay presents. The only lever found is how often the
  overlay changes.
- **What a widget draws matters far less than how often it changes.** Splitting
  the track map so the moving dots sat on their own compositor layer above a
  static track did not move its cost.

## Results so far

Ryzen 7 7700, RTX 4070, 3440×1440 @ 164 Hz, WebView2 154, iRacing full screen,
GPU-bound (~90 % busy, `GPUBusy` ~6.3 ms of a ~6.5 ms frame), one replay
segment at Road Atlanta, 2026-10-12.

| overlay                                          | avg FPS         | 1% low         | 1% low avg   | stutters/min  |
| ------------------------------------------------ | --------------- | -------------- | ------------ | ------------- |
| none                                             | 154–155         | 122–125        | 109–113      | 0.7–1.3       |
| app, no widget switched on                       | 150.1           | 114            | 99           | 4             |
| one static widget                                | 148.5           | 115            | 100          | 4             |
| one compass at 60 / 30 / 15 Hz                   | 142 / 146 / 147 | 69 / 100 / 110 | 61 / 78 / 89 | 147 / 32 / 22 |
| 29 widgets at 60 Hz, with transitions (before)   | 136.7           | 69             | 62           | 85            |
| 29 widgets at 30 Hz, transitions removed (after) | 141.4–142.3     | 96–99          | 73–76        | 25–35         |

Every run kept `Hardware: Independent Flip`, `SyncInterval 0`, tearing allowed.
Bisecting `perf-all` found no single expensive widget: any one widget changing
at 60 Hz cost about what all of them did. The full set of runs, including the
2×2 of clock against transitions, is in ADR-0009.

A second point of the same replay, 2026-10-13, heavier for any overlay, after
the alert animations moved to timers and the radar off its own frame loop. One
or two runs per row, so read them as groups, not as exact values:

| overlay, 30 Hz                                                       | avg FPS   | 1% low        | long frames | stutters/min   |
| -------------------------------------------------------------------- | --------- | ------------- | ----------- | -------------- |
| none                                                                 | 155–158   | 129–135       | ~0 %        | 0–1            |
| `perf-all`, 29 widgets                                               | 141–143   | 64–67         | 2–3 %       | 41–70          |
| standings, relative                                                  | 151.8     | 125.2         | 0.1 %       | 8              |
| delta, fuel, radar-bar, weather                                      | 150.2     | 121.7         | —           | 23             |
| track map alone                                                      | 144.2     | 64.7          | 2.4 %       | 123            |
| track map alone, 15 / 20 Hz                                          | 148 / 145 | 109 · 63 / 65 | —           | 16 · 141 / 107 |
| `perf-all` on the previous build (before the alert and radar change) | 134.8     | 67.1          | —           | 38             |

- The cost followed how often the overlay changed, not the widget. On this
  replay the four widgets of the second set hardly changed (a delta with no
  reference, a fuel figure at 4 Hz, an empty radar bar), the tables changed
  about ten times a second, and the track map on every bundle — the one widget
  of the set the game paid for.
- The alert and radar change raised the average frame rate (141–143 against 135) and left the 1% low where it was at this point.
- The 15 Hz map fell once in each group (109 and 63): too few runs to tell
  whether a lower clock makes the slow group rarer.

### What this corrects in the earlier picture

The earlier performance docs were written against the app's own costs —
allocation, renders, IPC — measured with `npm run perf`. Set against the
game's frames:

| earlier claim                                                                                                       | where                                                  | measured                                                                                                                                                                                                                                                         |
| ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| the overlay held 1.0–2.5 GB and **is not leaking**                                                                  | `rendering.md`                                         | **holds.** The renderer grows to ~1.4 GB and plateaus; a forced full collection leaves ~200 MiB (`v8` 209 → 13 MiB, `blink_gc` 752 → 98 MiB). Major collections rarely run, so the garbage piles up to a ceiling                                                 |
| it cost the game 10–20 FPS                                                                                          | `rendering.md`                                         | **holds in size:** −11 % of 154 FPS                                                                                                                                                                                                                              |
| the cost is the **rate of allocation** (React elements)                                                             | `rendering.md`                                         | **not for the game.** One compass that hardly allocates cost as much as 29 widgets; the whole app with its stores and bundle parsing but a static overlay cost almost nothing. Allocation is the app's own cost — CPU, memory, GC pauses — not the game's frames |
| the sim is 60 Hz and React cannot render at 60 Hz; the rate is absorbed in four layers                              | `architecture.md` → Performance                        | **right for CPU, silent on the game.** Tiers, `observableRef`, decomposition and canvas + RAF all cut work inside the webview; none limits how often the overlay changes on screen. A canvas or `useReactiveDomWrite` at 60 Hz is still 60 changes a second      |
| transitions smooth the steps: "these values are usually transitioned", "composited, and cheap enough to transition" | `useReactiveDomWrite.ts`, `close-battle/BattleRow.tsx` | **wrong.** A transition re-run by each value keeps the overlay at the monitor's rate whatever the clock; composited or not makes no difference                                                                                                                   |
| `npm run perf` shows no long tasks and no frames over budget                                                        | `perf-baseline.md`                                     | **true, and blind to this.** The harness measures the app; its own rAF probe holds the overlay at the monitor's rate, and a 25 ms threshold catches nothing at 164 Hz                                                                                            |

The [WebView2 flags research](research/webview2-browser-flags.md) agrees with
what was measured where the two overlap: frame-rate switches
(`--disable-frame-rate-limit`, `--disable-gpu-vsync`) are undocumented for
WebView2 and were left untested, and occlusion by the game does not throttle the
overlay — which is why the overlay must limit its own changes rather than rely
on the browser to.

Both kinds of cost are real. The earlier work keeps the webview cheap; the
clock keeps the game's frames intact. A change can be good for one and neutral
for the other, which is why it is measured with both harnesses.

### Reading a result

| observation                                    | look at                                                                      |
| ---------------------------------------------- | ---------------------------------------------------------------------------- |
| present mode is not Independent Flip           | the system, not the app: MPO support, Windows version, driver                |
| the app with no widget already costs the game  | the transparent window and WebView2 themselves                               |
| a static widget is fine, a changing one is not | the rate of change: the clock, then `changes` for anything animating         |
| a lower clock changes nothing                  | `changes`: something animates between bundles                                |
| one widget accounts for most of the cost       | how often it changes the overlay (`changes`), then its drawing               |
| runs of one variant disagree                   | more runs; the result is the groups they fall into, not their mean           |
| long frames grow in CPU time, not in GPU time  | the game waiting while the overlay presents: fewer changes, not cheaper ones |
| avg FPS holds but 1% low and stutter move      | normal for this cost — GPU busy per frame, missed vblanks                    |
| the cost disappears with an FPS cap            | GPU headroom absorbs it; the uncapped, GPU-bound case is the one to fix      |
