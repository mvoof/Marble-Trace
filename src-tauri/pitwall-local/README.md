# pitwall

Core Rust crate for the Pitwall telemetry stack. It provides the public API for:

- Connecting to iRacing live telemetry on Windows (`Pitwall::connect`).
- Replaying `.ibt` files on any platform (`Pitwall::open`).
- Subscribing to strongly typed telemetry streams via `PitwallFrame` adapters.
- Accessing session metadata, replay controls, and provider capabilities through one unified handle.

If you are looking for the full project overview (architecture, roadmap, contributing), read the repository-level `README.md`. This file focuses solely on using the published crate.

## Installation

```toml
[dependencies]
pitwall = "0.1"
tokio = { version = "1", features = ["rt-multi-thread", "macros"] }
futures = "0.3"
```

### Feature flags

| Feature            | Default | Description                                                                                                 |
| ------------------ | ------- | ----------------------------------------------------------------------------------------------------------- |
| `derive`           | ✅      | Pulls in `pitwall-derive` so you can `#[derive(PitwallFrame)]`. Disable if you implement adapters manually. |
| `tauri`            | ❌      | Re-exports helpers needed by `pitwall-tauri` (Specta integration).                                          |
| `schema-discovery` | ❌      | Enables experimental schema introspection utilities.                                                        |
| `benchmark`        | ❌      | Builds micro-benchmarks found under `benches/`.                                                             |

Enable additional flags in your manifest, e.g.:

```toml
pitwall = { version = "0.1", features = ["tauri", "schema-discovery"] }
```

## Quick start

### Live telemetry (Windows)

```rust
use pitwall::{Pitwall, PitwallFrame, UpdateRate};
use futures::StreamExt;

#[derive(Debug, PitwallFrame)]
struct CarData {
    #[field_name = "Speed"]
    speed: f32,
    #[field_name = "Gear"]
    gear: Option<i32>,
}

#[tokio::main]
async fn main() -> pitwall::Result<()> {
    let connection = Pitwall::connect().await?;
    let mut stream = connection.subscribe::<CarData>(UpdateRate::Native);

    while let Some(frame) = stream.next().await {
        println!("Speed: {speed:.1}, Gear: {:?}", frame.gear);
    }
    Ok(())
}
```

### IBT replay (cross-platform)

```rust
use pitwall::{Pitwall, PitwallFrame, UpdateRate};
use futures::StreamExt;

#[derive(Debug, PitwallFrame)]
struct CarData {
    #[field_name = "Speed"]
    speed: f32,
    #[field_name = "RPM"]
    rpm: f32,
}

#[tokio::main]
async fn main() -> pitwall::Result<()> {
    let connection = Pitwall::open("./test-data/race.ibt").await?;
    let mut stream = connection.subscribe::<CarData>(UpdateRate::Max(30));

    while let Some(frame) = stream.next().await {
        println!("Speed: {speed:.1} RPM: {rpm}");
    }
    Ok(())
}
```

Both connection types expose the same API surface—switching between live and replay sources is just a constructor change.

## Deriving frame adapters

The `PitwallFrame` derive macro (enabled by the default `derive` feature) generates a zero-copy adapter for your struct. Key attributes:

- `#[field_name = "Speed"]` – map a struct field to an iRacing telemetry variable.
- `Option<T>` – optional telemetry; `None` if the source is missing.
- `#[missing = "value"]` – provide a literal or expression fallback when the telemetry channel is absent.
- `#[fail_if_missing]` – aborts connection validation if the channel does not exist.
- `#[calculated = "expr"]` – compute a value at runtime without reading telemetry.
- `#[skip]` – field managed entirely by your application (not populated by Pitwall).

See the `pitwall-derive` crate for the full attribute matrix and `pitwall/tests/typescript_generation.rs` for an end-to-end example.

## Streams and session data

```rust
let conn = Pitwall::connect().await?;
let mut telemetry = conn.subscribe::<CarData>(UpdateRate::Native);
let mut session = conn.session_updates();

while let Some(info) = session.next().await {
    println!("Track: {}", info.weekend_info.track_display_name);
}
```

You may spawn multiple subscribers simultaneously; internally Pitwall fans out the producer data using Tokio watch channels, keeping frame construction under 1 ms even with hundreds of subscribers.

## Platform notes

- Live telemetry requires Windows + a running iRacing session. The crate uses `cfg(windows)` gates for memory-mapped IPC.
- IBT replay works on any platform supported by Rust and Tokio.
- Minimum supported Rust version (MSRV) is 1.89 due to the 2024 edition.

## Related crates

- [`pitwall-derive`](https://crates.io/crates/pitwall-derive): standalone copy of the derive macro (already included when you keep the default `derive` feature enabled).
- [`pitwall-tauri`](https://crates.io/crates/pitwall-tauri): helpers for streaming telemetry into Tauri + Specta type generation pipelines.

## License

MIT License. See `LICENSE` in this crate for details.
