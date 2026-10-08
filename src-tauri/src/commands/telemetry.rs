//! Commands that drive the telemetry runtime: starting and stopping the feed,
//! reading its current state, and the few knobs the settings UI turns on the
//! processors behind it.

use std::sync::atomic::Ordering;

use tauri::{AppHandle, State, Window};
use tracing::{debug, info};

use crate::model::defaults::MAX_FUEL_AVG_WINDOW;
use crate::model::session::SessionSnapshot;
use crate::sources::raw::{RawSession, RawValues, RawVarMeta};
use crate::sources::source::SourceFrame;
use crate::telemetry::delivery::DeliverySet;
use crate::telemetry::masks::REMOTE_LABEL;
use crate::telemetry::runtime::spawn_telemetry_thread;
use crate::telemetry::state::TelemetryState;
use crate::utils::lock_or_recover;

#[tauri::command]
pub async fn get_connection_status(state: State<'_, TelemetryState>) -> Result<bool, String> {
    Ok(state.service.is_connected.load(Ordering::Relaxed))
}

#[tauri::command]
pub async fn get_last_session_info(
    state: State<'_, TelemetryState>,
) -> Result<Option<SessionSnapshot>, String> {
    Ok(state.service.session().as_deref().cloned())
}

#[tauri::command]
pub async fn start_telemetry_stream(
    app: AppHandle,
    state: State<'_, TelemetryState>,
) -> Result<(), String> {
    info!("start_telemetry_stream command received");

    // A thread of the previous run sees it is no longer current and leaves on
    // its own, without announcing a disconnect over this one.
    let run = state.service.begin_run();

    spawn_telemetry_thread(app, state.service.clone(), run)
}

#[tauri::command]
pub async fn stop_telemetry_stream(state: State<'_, TelemetryState>) -> Result<(), String> {
    state.service.stop();

    debug!("Telemetry stream stopped");

    Ok(())
}

/// Records the calling window's appetite for the demand-gated bundle fields.
///
/// The label is taken from the caller, never from the payload: a label passed
/// from JS goes stale across a window reload, and the window is the authority
/// on its own identity. The entry is dropped when the window is destroyed
/// (`WindowEvent::Destroyed` in `lib.rs`).
#[tauri::command]
pub async fn set_active_events(
    window: Window,
    state: State<'_, TelemetryState>,
    mask: u32,
) -> Result<(), String> {
    let label = window.label();

    state.service.masks.register(label, mask);
    // Its counters start with its first registration and are dropped with the
    // window; re-registering on a layout change must not restart them.
    lock_or_recover(&state.service.delivery).ensure(label);

    debug!("Active events mask for {label} updated to: {mask:#b}");

    Ok(())
}

/// Records what the remote screens are asking for.
///
/// They have no webview of their own here — `remote/mirror.rs` taps the global
/// event stream — so their appetite is registered under a reserved pseudo-label
/// instead of a window's. Keeping it in the registry rather than implied by the
/// broadcast is what lets the later move to `emit_to` be a transport swap.
#[tauri::command]
pub async fn set_remote_active_events(
    state: State<'_, TelemetryState>,
    mask: u32,
) -> Result<(), String> {
    state.service.masks.register(REMOTE_LABEL, mask);
    lock_or_recover(&state.service.delivery).ensure(REMOTE_LABEL);

    debug!("Active events mask for {REMOTE_LABEL} updated to: {mask:#b}");

    Ok(())
}

/// Removes the calling window from the registry entirely.
///
/// A mask of `0` is not the same thing: it still describes a recipient that is
/// being delivered the ungated part of the bundle. A window nobody can see —
/// minimized, or with every widget hidden — should receive nothing at all, so
/// it takes its entry away and puts it back on the way in.
#[tauri::command]
pub async fn clear_active_events(
    window: Window,
    state: State<'_, TelemetryState>,
) -> Result<(), String> {
    let label = window.label();

    state.service.masks.drop_label(label);
    lock_or_recover(&state.service.delivery).drop_label(label);

    debug!("Active events cleared for {label}");

    Ok(())
}

/// The remote screens' counterpart of `clear_active_events`.
#[tauri::command]
pub async fn clear_remote_active_events(state: State<'_, TelemetryState>) -> Result<(), String> {
    state.service.masks.drop_label(REMOTE_LABEL);
    lock_or_recover(&state.service.delivery).drop_label(REMOTE_LABEL);

    debug!("Active events cleared for {REMOTE_LABEL}");

    Ok(())
}

#[tauri::command]
pub async fn set_pit_warning_laps(
    state: State<'_, TelemetryState>,
    laps: f32,
) -> Result<(), String> {
    if !laps.is_finite() || laps < 0.0 {
        return Err("pit_warning_laps must be a finite non-negative number".to_string());
    }

    state
        .service
        .configure(|config| config.fuel.pit_warning_laps = laps);

    Ok(())
}

/// Number of recent laps averaged for fuel consumption. 0 = the whole session.
#[tauri::command]
pub async fn set_fuel_avg_window(
    state: State<'_, TelemetryState>,
    window: u32,
) -> Result<(), String> {
    if window > MAX_FUEL_AVG_WINDOW {
        return Err(format!(
            "fuel_avg_window must be between 0 (all laps) and {MAX_FUEL_AVG_WINDOW}"
        ));
    }

    state
        .service
        .configure(|config| config.fuel.avg_window = window as usize);

    debug!("Fuel average window updated to: {window}");

    Ok(())
}

/// Whether laps under a local yellow count towards fuel consumption.
#[tauri::command]
pub async fn set_fuel_count_yellow_laps(
    state: State<'_, TelemetryState>,
    count: bool,
) -> Result<(), String> {
    state
        .service
        .configure(|config| config.fuel.count_local_yellow_laps = count);

    debug!("Fuel count local yellow laps updated to: {count}");

    Ok(())
}

#[tauri::command]
pub async fn set_car_length(state: State<'_, TelemetryState>, length: f32) -> Result<(), String> {
    if !(0.5..=15.0).contains(&length) || !length.is_finite() {
        return Err("Car length must be a finite value between 0.5 and 15.0 meters".to_string());
    }

    state
        .service
        .configure(|config| config.car_length_m = length);

    debug!("Car length updated in backend to: {}m", length);

    Ok(())
}

/// Opens and closes the telemetry inspector's data feed.
///
/// The inspector deliberately pulls rather than subscribing: resubscribing the
/// settings window to the telemetry bundle is exactly the cost that was removed
/// from it. While this is off the backend keeps no frame at all.
#[tauri::command]
pub async fn set_inspector_active(
    state: State<'_, TelemetryState>,
    active: bool,
) -> Result<(), String> {
    state
        .service
        .configure(|config| config.inspector_active = active);

    if !active {
        state.service.clear_inspector_frame();
    }

    debug!("Telemetry inspector active: {active}");

    Ok(())
}

/// The last adapted frame, or `None` when the sim is not connected or the feed
/// was only just switched on. Deliberately the whole `SourceFrame` and not the
/// bundle: the point of the inspector is to show what the sim gives us,
/// including the fields the app does not forward to any widget.
#[tauri::command]
pub async fn get_inspector_frame(
    state: State<'_, TelemetryState>,
) -> Result<Option<SourceFrame>, String> {
    Ok(lock_or_recover(&state.service.inspector_frame).clone())
}

/// Every telemetry variable's value under the sim's own names, refreshed with
/// the adapted frame while the feed is open. `None` while the sim is not
/// connected, or when the source is a tape — a tape records adapted frames.
#[tauri::command]
pub async fn get_inspector_raw_values(
    state: State<'_, TelemetryState>,
) -> Result<Option<RawValues>, String> {
    Ok(lock_or_recover(&state.service.inspector_raw_values).clone())
}

/// The sim's variable list for this connection: type, unit, description and
/// length of each. Fixed while connected, so the inspector reads it once.
#[tauri::command]
pub async fn get_raw_var_meta(state: State<'_, TelemetryState>) -> Result<Vec<RawVarMeta>, String> {
    Ok(state.service.raw_var_meta())
}

/// The session text exactly as the sim wrote it, with the same text as a tree.
#[tauri::command]
pub async fn get_raw_session(
    state: State<'_, TelemetryState>,
) -> Result<Option<RawSession>, String> {
    Ok(state.service.raw_session())
}

/// The delivery counters: per recipient, how many bundles went out and how many
/// of them carried each demand-gated field, over a stated wall-clock span.
///
/// Polled by the telemetry inspector on the same 4 Hz it polls the frame with,
/// and for the same reason: the settings window answers this with a command
/// instead of subscribing to the traffic it is asking about.
#[tauri::command]
pub async fn get_delivery_counters(
    state: State<'_, TelemetryState>,
) -> Result<Vec<DeliverySet>, String> {
    Ok(lock_or_recover(&state.service.delivery).snapshot())
}

/// Restarts every recipient's counters and the tick timings, giving a
/// measurement run a defined start. The recipients themselves are left
/// registered.
#[tauri::command]
pub async fn reset_delivery_counters(state: State<'_, TelemetryState>) -> Result<(), String> {
    lock_or_recover(&state.service.delivery).reset();
    #[cfg(feature = "dev")]
    lock_or_recover(&state.service.tick_timings).reset();

    Ok(())
}
