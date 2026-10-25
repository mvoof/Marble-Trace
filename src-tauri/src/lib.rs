#[cfg(feature = "dev")]
mod bindings;
mod commands;
mod hotkeys;
mod logging;
#[cfg(feature = "dev")]
mod perf_run;
mod process_priority;
mod remote_mirror;
mod settings_snapshot;
mod sim;
mod sink;

use commands::input::InputState;
use hotkeys::hotkey_host;
use mt_chat::state::{ChatServiceState, ChatState};
use mt_companions::CompanionsState;
use mt_hotkeys::runtime::HotkeyRuntime;
use mt_input::{InputHost, InputRuntime};
use mt_model::contract::windows::{MAIN_WINDOW_LABEL, OVERLAY_LABEL_PREFIX};
use mt_model::utils::lock_or_recover;
use mt_remote::control::RemoteState;
use mt_remote::server::RemoteHost;
use mt_telemetry::control::TelemetryCommand;
use mt_telemetry::state::TelemetryState;
#[cfg(feature = "dev")]
use perf_run::{spawn_if_requested, PerfRunConfig, PerfRunState};
use sink::{TauriAssets, TauriSink};

use std::error::Error;
use std::sync::Arc;
use tauri::{
    generate_context, App, AppHandle, Builder, Listener, Manager, Runtime, Window, WindowEvent,
};
use tauri_plugin_aptabase::EventTracker;
use tauri_plugin_store::StoreExt;
use tauri_plugin_window_state::StateFlags;

/// A monitor's DPI at a scale factor of 1.
const BASE_DPI: f64 = 96.0;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let result = with_plugins(Builder::default())
        .setup(setup)
        .invoke_handler(commands::invoke_handler())
        .manage(CompanionsState::default())
        .manage(ChatState {
            service: Arc::new(ChatServiceState::new()),
        })
        .manage(TelemetryState::default())
        .on_window_event(on_window_event)
        .run(generate_context!());

    // `run` fails only while building the app, before `setup` has set up
    // logging, so stderr is the one place the error can still go.
    if let Err(error) = result {
        eprintln!("tauri application failed to start: {error}");
        std::process::exit(1);
    }
}

fn with_plugins<R: Runtime>(builder: Builder<R>) -> Builder<R> {
    let aptabase_key = option_env!("APTABASE_KEY").unwrap_or("");

    let builder = builder
        .plugin(
            tauri_plugin_window_state::Builder::new()
                .with_denylist(&["overlay"])
                .with_state_flags(StateFlags::SIZE | StateFlags::POSITION | StateFlags::MAXIMIZED)
                .build(),
        )
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_aptabase::Builder::new(aptabase_key).build());

    #[cfg(feature = "dev")]
    let builder = builder.plugin(tauri_plugin_mcp_bridge::init());

    builder
}

fn setup(app: &mut App) -> Result<(), Box<dyn Error>> {
    let log_file_guard = logging::init(app);
    app.manage(log_file_guard);
    logging::install_panic_hook();
    logging::log_startup_info(app);

    #[cfg(feature = "dev")]
    if let Err(error) = bindings::export() {
        tracing::error!(%error, "contract export failed");
    }

    process_priority::lower_to_below_normal();

    // Registered before any server can start: the hub simply drops
    // everything while no browser is connected.
    let remote_state = RemoteState::default();
    remote_mirror::attach(app.handle(), Arc::clone(&remote_state.hub));
    let hotkeys = HotkeyRuntime::new(hotkey_host(app.handle(), Arc::clone(&remote_state.hub)));
    app.manage(remote_state);
    // Built here, on the main thread: an `AppHandle` must not be cloned on a
    // worker (`RemoteHost`), and the server starts from an async command.
    app.manage(RemoteHost {
        sink: Arc::new(TauriSink(app.handle().clone())),
        assets: Arc::new(TauriAssets(app.handle().clone())),
    });
    app.manage(Arc::clone(&hotkeys));

    #[cfg(feature = "dev")]
    {
        app.manage(PerfRunState {
            config: PerfRunConfig::from_env(),
            ..Default::default()
        });
        spawn_if_requested(app.handle());
    }

    forward_to_telemetry(app, "track-map:force-start", || {
        TelemetryCommand::ForceTrackStart
    });
    forward_to_telemetry(app, "track-map:clear", || TelemetryCommand::ClearTrackShape);

    track_app_started(app);

    if start_minimized(app) {
        if let Some(main_window) = app.get_webview_window(MAIN_WINDOW_LABEL) {
            let _ = main_window.minimize();
        }
    }

    // Started last: DirectInput needs the main window's HWND for background
    // cooperative level, and that only exists once the windows have been
    // created.
    app.manage(InputState {
        runtime: Some(InputRuntime::start(input_host(app.handle(), hotkeys))),
    });

    Ok(())
}

/// A frontend event that only asks the telemetry thread to do something.
fn forward_to_telemetry(app: &App, event: &'static str, command: fn() -> TelemetryCommand) {
    let handle = app.handle().clone();

    app.listen(event, move |_| {
        handle.state::<TelemetryState>().service.send(command());
    });
}

fn track_app_started(app: &App) {
    let monitor = app.primary_monitor().ok().flatten();
    let locale = sys_locale::get_locale().unwrap_or_else(|| "unknown".to_string());
    let props = serde_json::json!({
        "screen_width": monitor.as_ref().map(|monitor| monitor.size().width),
        "screen_height": monitor.as_ref().map(|monitor| monitor.size().height),
        "scale_factor": monitor.as_ref().map(|monitor| monitor.scale_factor()),
        "dpi": monitor.as_ref().map(|monitor| (BASE_DPI * monitor.scale_factor()) as u32),
        "locale": locale,
    });

    let _ = app.track_event("app_started", Some(props));
}

/// Read straight from the store: it has to act before the main window has
/// loaded the settings.
fn start_minimized(app: &App) -> bool {
    app.store("settings.json")
        .ok()
        .and_then(|store| store.get("settings"))
        .and_then(|settings| settings.get("app")?.get("startMinimized")?.as_bool())
        .unwrap_or(false)
}

fn on_window_event(window: &Window, event: &WindowEvent) {
    match event {
        WindowEvent::Destroyed => on_window_destroyed(window),
        WindowEvent::Resized(size) => {
            tracing::debug!(
                window = window.label(),
                width = size.width,
                height = size.height,
                "window resized"
            );
        }
        WindowEvent::Moved(position) => {
            tracing::debug!(
                window = window.label(),
                x = position.x,
                y = position.y,
                "window moved"
            );
        }
        WindowEvent::ScaleFactorChanged { scale_factor, .. } => {
            tracing::info!(window = window.label(), scale_factor, "window DPI changed");
        }
        _ => {}
    }
}

fn on_window_destroyed(window: &Window) {
    tracing::info!(window = window.label(), "window destroyed");

    // A window that is gone must not keep a demand-gated field switched on
    // for everyone else.
    let app_handle = window.app_handle();
    let service = &app_handle.state::<TelemetryState>().service;

    service.masks.drop_label(window.label());
    lock_or_recover(&service.delivery).drop_label(window.label());

    if window.label() == MAIN_WINDOW_LABEL {
        for (label, overlay) in app_handle.webview_windows() {
            if label.starts_with(OVERLAY_LABEL_PREFIX) {
                let _ = overlay.destroy();
            }
        }

        // Only the instances this app started, and only the ones still
        // marked to close with it — see `companions::close`.
        mt_companions::close_all_owned(&app_handle.state::<CompanionsState>());
    }
}

/// The input runtime's link to the app: its events, the main window's handle,
/// and the hotkey dispatcher its edges go to.
fn input_host(app: &AppHandle, hotkeys: Arc<HotkeyRuntime>) -> InputHost {
    let window_app = app.clone();

    InputHost {
        sink: Arc::new(TauriSink(app.clone())),
        window: Box::new(move || {
            let window = window_app.get_webview_window(MAIN_WINDOW_LABEL)?;

            window
                .hwnd()
                .map(|handle| handle.0)
                .inspect_err(|error| tracing::warn!("no window handle for input capture: {error}"))
                .ok()
        }),
        on_edge: Box::new(move |event| hotkeys.on_device_edge(event)),
    }
}
