# ADR 0011: The backend is a Cargo workspace, one crate per layer or domain

**Status:** accepted, 2026-10-25
**Context:** `src-tauri/Cargo.toml`, `src-tauri/crates/`; `docs/rules/backend.md`

## Decision

`src-tauri/` is a Cargo workspace. The app crate keeps the wiring, every Tauri
command and the plugins behind the runtimes' seams; the rest lives in ten crates under
`src-tauri/crates/`: `mt-model`, `mt-source`, `mt-sim-iracing`,
`mt-computations`, `mt-telemetry`, `mt-chat`, `mt-input`, `mt-remote`,
`mt-companions`, `mt-hotkeys`. Only `mt-sim-iracing` depends on kerb; only the app depends on
tauri. Each further sim is its own `mt-sim-*` crate.

## Why

- **The layer rules were held by review alone.** Rust has no import lint, and
  the single crate had drifted: `model` imported `computations`, `sources`
  imported `telemetry`, the telemetry runtime called iRacing by name. A crate
  can only use what its `Cargo.toml` lists, so each of those is now a build
  error, not a reading.
- **LMU and AC are coming**, and kerb already reads both. In one crate a second
  adapter lands in the same files as the first. As crates, the runtime names
  only `TelemetrySource` and `PitCommander`; a sim is a sibling crate plus one
  line in the app's `sim.rs`.
- **Finding things.** A flat list of 21 processors and 28 model files did not
  say what belongs together; the crates and their subject folders do.

## Considered

- **Fewer crates** (model with source, companions in the app): fewer
  `Cargo.toml`s, but each merge drops a boundary the compiler would hold.
- **More crates** (hotkeys in the input crate, one per runtime piece): the
  hotkey dispatcher acts on telemetry, remote screens and pit orders; as its own
  crate it would depend on most of the others, which is the app's job.
- **The layout of an outside proposal** (one engine crate holding the kerb
  connector, a cross-sim normalizer and the scheduler): it puts every sim inside
  the runtime, the coupling this decision removes.

## Consequences

- The runtimes reach the app through traits and host structs — `EventSink`,
  `TelemetryHost`, `InputHost`, `RemoteHost`, `BundleAssets` — instead of
  `AppHandle`.
- An impl between two foreign types is refused by the orphan rule: the iRacing
  frame mapping uses a local `FromIracing` trait instead of `From`.
- `pub` items nothing uses no longer warn across crates; keep `pub` to what the
  next crate needs.
- The model is still iRacing-shaped in places (64-slot `CarIdx*` arrays with the
  sim's `-1`, raw frames under kerb's iRacing names, iRating and Safety Rating).
  Normalizing it is designed against a second sim's real data, with its adapter.
