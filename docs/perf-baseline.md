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

| row                     | source                                                                                                                                                                                            |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| tick p50/p99/max        | wall time of one `emit_domain_frames` pass (processors, assembly, mask, quantize, delivery), every tick of the span. The time the `dev` build spends sizing bundles is subtracted                 |
| `<recipient>` bundles/s | `telemetry/delivery.rs`, per window label. `@remote` is the remote-screen mirror                                                                                                                  |
| `<recipient>` KiB/s     | serialized JSON length of what that recipient was sent (a second serialization, `dev` only)                                                                                                       |
| first paint             | navigation start to the overlay's `first-contentful-paint`, observed from the entry module before React mounts (`app/sync/perf-cold-start.ts`) — the overlay's cold start, settings read included |
| heap at first paint     | `usedJSHeapSize` read as that paint is observed: what the window boots into, before the tape fills the stores                                                                                     |
| alloc MiB/s             | sum of positive `usedJSHeapSize` deltas every 50 ms. Run with `--enable-precise-memory-info`, which the script sets. Never RSS                                                                    |
| long tasks ≥50 ms       | `PerformanceObserver('longtask')`. 50 ms is the API's floor                                                                                                                                       |
| frames over budget      | `requestAnimationFrame` gaps over 25 ms (a 60 Hz frame and a half). The finer-grained stand-in for "tasks over 16 ms", which no browser API reports                                               |
| DOM mutations/s         | `MutationObserver` records on the overlay's `body`                                                                                                                                                |
| observer wake-ups/s     | `mobx.spy` reactions. A no-op in a production MobX, so always `—` in these runs                                                                                                                   |
| apply p50/p99/max       | `applyTelemetryBundle` per bundle, MobX reactions included. Ticks that do not carry the 1 Hz tier                                                                                                 |
| apply 1 Hz full         | the same, on the 1 Hz full bundles (`session` present)                                                                                                                                            |
| heap bucket             | sampling heap profile (16 KiB interval, collected objects included), each sample charged to the first matching frame on its stack                                                                 |

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

| date       | code                                                                  | mode        | tick p99 (µs) | overlay KiB/s | alloc (MiB/s) | DOM mut/s | apply p99 (ms) | apply 1 Hz max (ms) | note                                                               |
| ---------- | --------------------------------------------------------------------- | ----------- | ------------- | ------------- | ------------- | --------- | -------------- | ------------------- | ------------------------------------------------------------------ |
| 2026-10-04 | `refactor/architecture-rework` @ 4c1c2f0e + ticket 01                 | widgets     | 789 / 768     | 1060          | 11.64 / 11.65 | 7538      | 0.9            | 1.2 / 1.0           | baseline, two runs                                                 |
| 2026-10-04 | same                                                                  | stores-only | 756 / 747     | 1060          | 4.65 / 4.69   | 0         | 0.5            | 0.5                 | baseline, two runs                                                 |
| 2026-10-04 | `refactor/architecture-rework` @ fd5f1819 + ticket 03                 | widgets     | 800 / 785     | 1059          | 11.62 / 11.67 | 7530      | 1.0 / 0.9      | 0.9 / 0.8           | tick span widened                                                  |
| 2026-10-04 | `refactor/architecture-rework` @ 9eae162e (ticket 06) + harness of 07 | widgets     | 2048 / 903    | 1060          | 12.01 / 12.08 | 7542      | 1.1            | 1.3 / 0.9           | before 07; first paint 1592 / 1812 ms, heap 15.17 / 15.25 MiB      |
| 2026-10-04 | same + ticket 07                                                      | widgets     | 770 / 775     | 1059          | 12.50 / 12.33 | 7572      | 0.9            | 1.0 / 0.9           | after 07; first paint 1664 / 1600 ms, heap 13.16 / 13.23 MiB       |
| 2026-10-05 | `refactor/architecture-rework` @ deb97eee + ticket 11                 | widgets     | 570 / 575     | 761           | 9.42 / 9.41   | 7405      | 0.7            | 1.0 / 0.7           | static driver fields off `DriverEntry`; first paint 1616 / 1624 ms |
| 2026-10-05 | `refactor/architecture-rework` @ 34693683 + ticket 26                 | widgets     | 536 / 542     | 761           | 5.08 / 5.09   | 1009      | 0.8            | 1.2 / 1.0           | identity/join caches, track-map dots via SVG DOM                   |

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
`TrackMapWidget/TrackMapSvg.tsx` 2.13, `entities/cars/car-identity.ts` 2.05,
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

## 2026-10-04 — the telemetry thread owns its state (ticket 04)

Same machine, tape, offset, layout and command as ticket 03, widgets mode, two
runs.

| metric                          | run 1 | run 2 | spread |
| ------------------------------- | ----- | ----- | ------ |
| tick p50 (µs)                   | 55    | 52    | 5.5 %  |
| tick p99 (µs)                   | 838   | 809   | 3.5 %  |
| tick max (µs)                   | 1617  | 1227  | 24.1 % |
| overlay-DISPLAY1 KiB/s          | 1060  | 1060  | 0.0 %  |
| overlay-DISPLAY1 alloc (MiB/s)  | 11.64 | 11.72 | 0.7 %  |
| overlay-DISPLAY1 apply p99 (ms) | 1.0   | 0.9   | 1 step |

- **No speed-up.** p99 is 838 / 809 against 800 / 785 after 03, about the
  spread between two runs. The locks that went away were uncontended, so they
  cost almost nothing per tick. The ticket is about ownership, not time.
- **The wire is unchanged to the byte** (1059.94 / 1059.96 KiB/s, same bundle
  rate), so the bundles the loop builds are the same ones.

## 2026-10-04 — per-window composition roots (ticket 07)

Same machine, tape, offset, layout and command as ticket 03, widgets mode, two
runs each. The harness gained two rows for this ticket (first paint, heap at
first paint); the "before" runs are ticket 06's code with only that harness
change.

| metric                                     | before (06)   | after (07)    |
| ------------------------------------------ | ------------- | ------------- |
| overlay-DISPLAY1 first paint (ms)          | 1592 / 1812   | 1664 / 1600   |
| overlay-DISPLAY1 heap at first paint (MiB) | 15.17 / 15.25 | 13.16 / 13.23 |
| overlay-DISPLAY1 alloc (MiB/s)             | 12.01 / 12.08 | 12.50 / 12.33 |
| overlay-DISPLAY1 apply p99 (ms)            | 1.1 / 1.1     | 0.9 / 0.9     |

- **The overlay boots into 2 MiB less heap** (13.2 against 15.2 MiB, both
  pairs within 0.5 %): it no longer constructs the editor, the inspector,
  diagnostics, companion apps, the chat sign-in or the device list.
- **First paint did not move** beyond the spread between runs. It is dominated
  by reading and migrating the settings file and by the widgets' first render,
  not by store construction.
- The "before" pair ran while type checks and tests were running beside it (its tick p99
  of 2048 µs in run 1 is that load, not the code), so its alloc and apply rows
  are not comparable to the "after" pair. The heap reading is taken before any
  telemetry arrives and agrees between both runs of each pair.

## 2026-10-05 — static driver data travels once (ticket 11)

Same machine, tape, offset, layout and command as ticket 03, widgets mode, two
runs. `DriverEntry` (in `driverEntries` and in `relative`) no longer carries
name, number, class id/badge/colour, car names, flair, AI flag, iRating,
licence or incidents; the overlay joins them back from `SessionSnapshot.cars`
(`entities/cars/driver-entry-join.ts`).

| metric                           | before (07) | after (11)  |
| -------------------------------- | ----------- | ----------- |
| tick p99 (µs)                    | 770 / 775   | 570 / 575   |
| overlay-DISPLAY1 KiB/s           | 1059        | 762 / 760   |
| overlay-DISPLAY1 alloc (MiB/s)   | 12.50/12.33 | 9.42 / 9.41 |
| overlay-DISPLAY1 DOM mutations/s | 7572        | 7403 / 7407 |
| overlay-DISPLAY1 apply p99 (ms)  | 0.9 / 0.9   | 0.7 / 0.7   |

- **The wire is 28 % lighter** (1059 → 761 KiB/s at the same 52.87
  bundles/s), every recipient alike — `@remote` carries the same bytes as the
  overlay. The bundle rate and the gated-field counts are unchanged, so the
  whole difference is the strings that left each 10 Hz entry.
- **Allocation fell by a quarter** (12.4 → 9.4 MiB/s) although the overlay now
  builds the joined rows itself: the payload literal Tauri evaluates for every
  bundle shrank by more than the join allocates.
- **The tick got cheaper** (p99 ~770 → ~570 µs): the processors no longer clone
  eleven strings per car per tick, and there is less to serialize.
- DOM mutations stayed where they were, as they should: the widgets draw the
  same rows.
- Caveat: tickets 08–10 landed between the "before" pair and this one without
  a measurement of their own. None of them changes what `DriverEntry` carries,
  but their share of the tick and alloc rows is not separated out here.

## 2026-10-05 — transport gate (ticket 12)

Code `refactor/architecture-rework` @ 78d49dcd (ticket 11), the same `--build`
binary as ticket 11's rows. Tape, offset and command as before.

**Layout.** The developer's race layout, the largest one in use: one overlay
(`DISPLAY1`, 17 widgets — the list above) and one stream screen (`strim`,
`purpose: stream`, 12 widgets) that is normally an OBS browser source. OBS was
closed; the stream page was opened in Chrome (same Chromium engine) with
`--enable-precise-memory-info` and driven over CDP by a probe that wraps the
page's `socket.onmessage` — on that page the handler _is_ `JSON.parse` +
`applyTelemetryBundle`, synchronously, so parse and store writes are timed
together there, which the overlay cannot do. The probe's 60 s window is
aligned to the app's by start time, not by marker (±1 s).

### Overlay

| metric                                      | run 1           | run 2           |
| ------------------------------------------- | --------------- | --------------- |
| alloc (MiB/s), widgets                      | 9.39            | 9.44            |
| apply p50 / p99 / max (ms)                  | 0.3 / 0.7 / 1.2 | 0.2 / 0.7 / 1.0 |
| apply 1 Hz full p50 / max (ms)              | 0.3 / 0.8       | 0.3 / 0.7       |
| alloc (MiB/s), stores-only (`--heap`)       | 1.65            |                 |
| apply p99 / 1 Hz full max (ms), stores-only | 0.1 / 0.1       |                 |

| heap bucket (widgets, 60 s)             | MiB/s | share  |
| --------------------------------------- | ----- | ------ |
| apply bundle → stores (incl. reactions) | 4.65  | 49.1 % |
| React render / commit                   | 2.40  | 25.4 % |
| event payload literal (the "parse")     | 1.77  | 18.7 % |
| other                                   | 0.64  | 6.8 %  |

Stores-only: the parse is 1.62 of 1.69 MiB/s (95.7 %); store writes 0.03 MiB/s.
Top allocating sources with widgets: payload literal 26.1 %,
`entities/cars/car-identity.ts` 21.6 %, `TrackMapSvg.tsx` 20.0 %, MobX 8.4 %,
`entities/cars/driver-entry-join.ts` 5.1 %.

### Stream screen (Chrome, 33 telemetry messages/s after the hub's thinning)

| metric                                  | run 1           | run 2           | heap run        |
| --------------------------------------- | --------------- | --------------- | --------------- |
| parse + apply p50 / p99 / max (ms)      | 0.3 / 1.1 / 1.5 | 0.3 / 1.1 / 1.5 | 0.3 / 1.1 / 1.4 |
| parse + apply, 1 Hz full p50 / p99 (ms) | 0.3 / 1.1       | 0.3 / 1.0       | 0.3 / 1.2       |
| alloc (MiB/s)                           | 6.51            | 6.46            | 6.40            |

Heap: apply incl. reactions 59.5 %, React 27.0 %, other 13.5 % — `JSON.parse`
is in "other" here: V8 charges a builtin's allocations to its caller
(`remote-socket.service.ts`), so it has no bucket of its own.

### Against the criterion (fixed in ticket 12, not adjusted)

1. Worst tick, parse + store writes p99 ≤ 0.8 ms — **fails on the stream
   screen** (1.0–1.2 ms on 1 Hz full ticks, and the ordinary ticks are no
   better). On the overlay the parse cannot be timed; store writes alone are
   ≤ 0.1 ms (stores-only), with reactions 0.7–0.8 ms max on full ticks.
2. Parse + store writes ≤ 5 % of allocation — **fails**: 1.65 of 9.4 MiB/s
   (17.6 %) by the stores-only A/B, 18.7 % parse by the profile.

What the numbers also say: the transport's whole cost on the overlay is
1.65 MiB/s. Reactions and React, which a binary transport does not touch, are
7.0 MiB/s; `carIdentityOf` alone (2.05 MiB/s) allocates more than the parse.

## 2026-10-05 — reaction and render allocations (ticket 26)

Code `refactor/architecture-rework` @ 34693683 + ticket 26, a fresh `--build`.
Tape, offset, layout and command as in ticket 12. Measured in three steps, each
two runs plus a 30 s heap profile, so each change carries its own number:

| step                                                    | alloc (MiB/s) | DOM mutations/s |
| ------------------------------------------------------- | ------------- | --------------- |
| before (ticket 12)                                      | 9.39 / 9.44   | 7400            |
| identity without spread + `delete`, caches, `speed` out | 6.54 / 6.52   | 7400            |
| track-map dots placed through `transform.baseVal`       | 5.41 / 5.48   | 1009            |
| the dots' `SVGTransform` items held instead of re-read  | 5.08 / 5.09   | 1009            |

| allocating source (self)             | before (12) | after |
| ------------------------------------ | ----------- | ----- |
| `entities/cars/car-identity.ts`      | 2.05        | 0.35  |
| `TrackMapSvg.tsx`                    | 1.89        | 0.56  |
| `entities/cars/driver-entry-join.ts` | 0.49        | 0.56  |
| event payload literal                | 2.46        | 1.99  |

- **`speed` was in the identity.** It moves every tick, so the standings and
  relative identities compared unequal on every 10 Hz frame and the content
  comparison bought nothing: every subscriber re-rendered anyway. It is a
  moving field now; the one reader (wheel-to-wheel) reads full entries.
- **The identity is copied, not spread and `delete`d**, and a car whose drawn
  fields did not change keeps last frame's object (`CarIdentityCache`), so the
  identity lists compare by reference (`comparer.shallow`).
- **The join reuses a row** while neither the car's live entry nor its roster
  entry changed. On this tape almost every car moves every frame, so the join
  allocates what it did (0.49 → 0.56, within the profile's noise); the reuse
  pays for parked and retired cars.
- **Track-map dots** no longer build a `translate(x, y) rotate(r)` string per
  car per frame (×2 instances at 60 Hz); positions go through a reused
  `Float64Array` into each dot's own `SVGTransform` items, and the dot list is
  a live `getElementsByClassName` collection instead of a fresh
  `querySelectorAll`. The engine writes the attribute back lazily, which is
  also why the overlay's DOM mutation records fell from 7400 to 1009 per
  second — the dots are still moved every frame (checked live).
- Apply p99 0.7 → 0.8 ms is one 0.1 ms timer step; tick p99 unchanged.
