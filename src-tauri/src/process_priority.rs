//! Yields CPU scheduling priority to the simulator.
//!
//! Diagnostics on a live iRacing session showed the sim's foreground thread
//! already at ~83% before the overlay draws anything, and at ~97% with the full
//! widget set — the frame rate is lost to CPU contention, not to the GPU, which
//! still had headroom. Nothing the overlay does is latency-critical to the
//! millisecond: a delta that repaints 5 ms late is invisible, a dropped frame in
//! the sim is not. So the app asks the scheduler to prefer the game.
//!
//! Below-normal rather than idle: idle priority would let any background task on
//! the machine starve the overlay outright, and a widget that stops updating
//! during a busy moment is worse than one that costs a little.

#[cfg(windows)]
pub fn lower_to_below_normal() {
    use windows::Win32::System::Threading::{
        GetCurrentProcess, SetPriorityClass, BELOW_NORMAL_PRIORITY_CLASS,
    };

    // SAFETY: `GetCurrentProcess` returns a pseudo-handle to this process that
    // needs no closing, and `SetPriorityClass` only reads it.
    let result = unsafe { SetPriorityClass(GetCurrentProcess(), BELOW_NORMAL_PRIORITY_CLASS) };

    match result {
        Ok(()) => tracing::info!("Process priority set to below normal"),
        Err(e) => tracing::warn!("Failed to lower process priority: {}", e),
    }
}

#[cfg(not(windows))]
pub fn lower_to_below_normal() {}
