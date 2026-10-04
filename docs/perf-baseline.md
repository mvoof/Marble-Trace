# Performance baseline

What the app costs on a recorded session, measured the same way every time.
Every performance claim in the architecture rework is checked against this file.
**Append, never overwrite**: a later measurement goes in as a new row in
[Runs](#runs) and, if it needs one, a new section below. Don't edit an earlier
section.

## How to measure

```powershell
# once per code change: release backend with the `dev` feature (the tape
# source lives there), production frontend, hidden source maps, no installer
npm run perf -- --tape D:\tapes\session-1791104931.tape.jsonl.gz --from 600 --build

# the baseline: two runs each, so the spread is printed beside the numbers
npm run perf -- --tape D:\tapes\session-1791104931.tape.jsonl.gz --from 600 --runs 2
npm run perf -- --tape D:\tapes\session-1791104931.tape.jsonl.gz --from 600 --runs 2 --mode stores-only

# where the overlay's bytes go (sampling heap profile over CDP)
npm run perf -- --tape D:\tapes\session-1791104931.tape.jsonl.gz --from 600 --seconds 30 --heap
npm run perf -- --tape D:\tapes\session-1791104931.tape.jsonl.gz --from 600 --seconds 30 --heap --mode stores-only
```

Close every running Marble Trace first: the instances share one WebView2 data
folder and one settings file. Leave the machine idle, with no build running.

A run plays the tape from `--from` seconds and waits 10 s to warm up. It then
resets the counters and measures for 60 s. After that the app writes a JSON
report (to `%TEMP%\marble-trace-perf\` by default) and exits. The script prints
the report as the tables below. `npm run perf -- --report a.json --report b.json`
prints saved reports side by side.

### What each row is

| row                     | source                                                                                                                                                                            |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| tick p50/p99/max        | wall time of one `emit_domain_frames` pass (processors, assembly, mask, quantize, delivery), every tick of the span. The time the `dev` build spends sizing bundles is subtracted |
| `<recipient>` bundles/s | `telemetry/delivery.rs`, per window label. `@remote` is the remote-screen mirror                                                                                                  |
| `<recipient>` KiB/s     | serialized JSON length of what that recipient was sent (a second serialization, `dev` only)                                                                                       |
| alloc MiB/s             | sum of positive `usedJSHeapSize` deltas every 50 ms. Run with `--enable-precise-memory-info`, which the script sets. Never RSS                                                    |
| long tasks ≥50 ms       | `PerformanceObserver('longtask')`. 50 ms is the API's floor                                                                                                                       |
| frames over budget      | `requestAnimationFrame` gaps over 25 ms (a 60 Hz frame and a half). The finer-grained stand-in for "tasks over 16 ms", which no browser API reports                               |
| DOM mutations/s         | `MutationObserver` records on the overlay's `body`                                                                                                                                |
| observer wake-ups/s     | `mobx.spy` reactions. A no-op in a production MobX, so always `—` in these runs                                                                                                   |
| apply p50/p99/max       | `applyTelemetryBundle` per bundle, MobX reactions included. Ticks that do not carry the 1 Hz tier                                                                                 |
| apply 1 Hz full         | the same, on the 1 Hz full bundles (`session` present)                                                                                                                            |
| heap bucket             | sampling heap profile (16 KiB interval, collected objects included), each sample charged to the first matching frame on its stack                                                 |

Limits of the method:

- **`JSON.parse` cannot be timed from the page.** Tauri 2.10 does not parse event
  payloads with `JSON.parse`. It writes each one into the script it evaluates in the
  webview as a JS object literal, so the parse happens before any of our code
  runs. Its cost shows up in two places: the `event payload literal` heap
  bucket, and the time between bundles. It never appears in `apply`.
- `performance.now()` in WebView2 ticks in 0.1 ms steps, so the `apply` rows
  are quantized. 0.4 against 0.5 ms is one step, not a 20 % change. Judge those
  rows in steps, not in percent.
- `stores-only` mounts no widget, but widget **stores** still run their
  telemetry reactions, because they are built whether their widget is on screen
  or not. Its numbers are an upper bound on the transport's own share.
- A `--heap` run pays for the profiler, so only its heap tables count. The
  heap totals agree with the `alloc` row of the same run within 3 %, and that
  cross-check is what makes the attribution trustworthy.

## Runs

One row per measurement. Later tickets add rows here.

| date       | code                                                  | mode        | tick p99 (µs) | overlay KiB/s | alloc (MiB/s) | DOM mut/s | apply p99 (ms) | apply 1 Hz max (ms) | note               |
| ---------- | ----------------------------------------------------- | ----------- | ------------- | ------------- | ------------- | --------- | -------------- | ------------------- | ------------------ |
| 2026-10-04 | `refactor/architecture-rework` @ 4c1c2f0e + ticket 01 | widgets     | 789 / 768     | 1060          | 11.64 / 11.65 | 7538      | 0.9            | 1.2 / 1.0           | baseline, two runs |
| 2026-10-04 | same                                                  | stores-only | 756 / 747     | 1060          | 4.65 / 4.69   | 0         | 0.5            | 0.5                 | baseline, two runs |
| 2026-10-04 | `refactor/architecture-rework` @ fd5f1819 + ticket 03 | widgets     | 800 / 785     | 1059          | 11.62 / 11.67 | 7530      | 1.0 / 0.9      | 0.9 / 0.8           | tick span widened  |

## 2026-10-04 — baseline (ticket 01)

**Machine.** AMD Ryzen 7 7700 (8 cores), 32 GB RAM, NVIDIA RTX 4070, Windows 11
Pro, WebView2 154.0.4258.53, one monitor (`DISPLAY1`).

**Build.** `npm run perf -- --build`: `tauri build --features dev --no-bundle`,
production Vite frontend. The backend carries specta and the tape source,
which are `dev` only. A release build has neither.

**Tape.** `session-1791104931.tape.jsonl.gz` (34.5 min, 110 486 frames, ~53 Hz),
played from 600 s, while the player is driving. Not in git (95 MB).

**Layout.** The active layout of the developer's settings. One overlay with
battery, delta, fuel, input-trace, invisible-dash, lap-log, led-flags,
pit-line, pit-service, proximity-radar, radar-bar, relative, standings,
stream-chat, track-map ×2, weather, wheel-to-wheel. No remote screen connected.

### Widgets, two runs

| metric                         | run 1           | run 2           | spread       |
| ------------------------------ | --------------- | --------------- | ------------ |
| tick p50 (µs)                  | 50              | 48              | 4.0 %        |
| tick p99 (µs)                  | 789             | 768             | 2.7 %        |
| tick max (µs)                  | 1593            | 1690            | 5.7 %        |
| overlay bundles/s              | 52.87           | 52.87           | 0.0 %        |
| overlay KiB/s                  | 1059.97         | 1061.81         | 0.2 %        |
| @remote bundles/s              | 52.87           | 52.87           | 0.0 %        |
| @remote KiB/s                  | 1059.97         | 1061.81         | 0.2 %        |
| alloc (MiB/s)                  | 11.64           | 11.65           | 0.1 %        |
| long tasks ≥50 ms /min         | 0               | 0               | —            |
| frames over budget (%)         | 0               | 0               | —            |
| DOM mutations/s                | 7537.85         | 7532.78         | 0.1 %        |
| apply p50 / p99 / max (ms)     | 0.4 / 0.9 / 1.4 | 0.4 / 0.9 / 1.0 | max: 4 steps |
| apply 1 Hz full p50 / max (ms) | 0.5 / 1.2       | 0.4 / 1.0       | 1–2 steps    |

### Stores-only, two runs

| metric                         | run 1           | run 2           | spread      |
| ------------------------------ | --------------- | --------------- | ----------- |
| tick p50 (µs)                  | 41              | 43              | 4.7 %       |
| tick p99 (µs)                  | 756             | 747             | 1.2 %       |
| tick max (µs)                  | 1385            | 1435            | 3.5 %       |
| overlay KiB/s                  | 1059.95         | 1061.80         | 0.2 %       |
| alloc (MiB/s)                  | 4.65            | 4.69            | 0.9 %       |
| DOM mutations/s                | 0               | 0               | —           |
| apply p50 / p99 / max (ms)     | 0.2 / 0.5 / 0.7 | 0.2 / 0.5 / 0.6 | max: 1 step |
| apply 1 Hz full p50 / max (ms) | 0.2 / 0.5       | 0.3 / 0.5       | 1 step      |

Every metric that is not a 0.1 ms-quantized time agrees within 6 %, which meets
the ticket's 10 % repeatability bar.

### Where the overlay's bytes go (30 s, `--heap`)

| heap bucket                             | widgets MiB/s | share  | stores-only MiB/s | share  |
| --------------------------------------- | ------------- | ------ | ----------------- | ------ |
| apply bundle → stores (incl. reactions) | 4.46          | 36.9 % | 1.68              | 35.2 % |
| React render / commit                   | 3.64          | 30.1 % | —                 | —      |
| event payload literal (the "parse")     | 3.26          | 26.9 % | 3.08              | 64.4 % |
| other                                   | 0.74          | 6.1 %  | 0.02              | 0.4 %  |
| **total sampled**                       | 12.09         |        | 4.78              |        |

Top allocating sources (self), widgets run: the event payload literal 4.18 MiB/s,
`TrackMapWidget/TrackMapSvg.tsx` 2.13, `utils/car-identity.ts` 2.05,
`react-dom` 0.63, `react/jsx-runtime` 0.30. In stores-only `car-identity.ts`
still allocates 1.06 MiB/s, which makes it store-side work that runs per bundle.

### What this baseline says

- **The transport is not under 1 % of allocation.** The spec assumed it was,
  based on a dev-build profile from before the rendering work. Receiving the
  payload costs ~3.1–3.3 MiB/s of JS heap (about 3 bytes of heap per byte on the
  wire) whether or not a widget is mounted, which is 27 % of the overlay's
  churn. Gate 12 measures after ticket 11 has removed the static driver fields,
  and these numbers are its "before".
- **Each overlay is sent ~1 MiB/s, and so is the remote mirror** while no
  browser is connected, so the backend serializes every tick twice for one
  monitor.
- The backend tick is cheap: p50 ~50 µs, p99 ~0.8 ms, max under 2 ms, no
  long tasks, no dropped frames.

## 2026-10-04 — disk and session YAML off the telemetry loop (ticket 03)

Same machine, tape, offset, layout and command as the baseline, widgets mode,
two runs. Over the 60 s the tape sends 16 session updates and one pit lane
calibration, so the span holds both cases the ticket names.

**The tick span is wider than the baseline's.** It now starts before the
parsed sessions are applied instead of at `emit_domain_frames`, because applying
a session is tick work too. The old parse ran outside the old span, so the
baseline never saw it; these rows count strictly more than the baseline rows do.

| metric                          | run 1 | run 2 | spread |
| ------------------------------- | ----- | ----- | ------ |
| tick p50 (µs)                   | 53    | 49    | 7.5 %  |
| tick p99 (µs)                   | 800   | 785   | 1.9 %  |
| tick max (µs)                   | 1169  | 1039  | 11.1 % |
| overlay-DISPLAY1 KiB/s          | 1060  | 1058  | 0.2 %  |
| overlay-DISPLAY1 alloc (MiB/s)  | 11.62 | 11.67 | 0.4 %  |
| overlay-DISPLAY1 apply p99 (ms) | 1.0   | 0.9   | 1 step |

- **p99 is unchanged** (800 / 785 against 789 / 768) with the session apply now
  inside the span.
- **The worst tick dropped by about a third** (1169 / 1039 against 1593 / 1690 µs).
  The file writes inside the emit were the outliers.
- Nothing on the frontend moved, as expected for a backend-only change.
