use std::sync::{Mutex, MutexGuard};

/// Locks a mutex and returns the guard, even if the mutex is poisoned.
/// This is a common pattern in this application where we prefer to continue
/// with potentially stale data rather than crashing or handling errors explicitly
/// for every telemetry frame.
pub fn lock_or_recover<T>(mutex: &Mutex<T>) -> MutexGuard<'_, T> {
    mutex.lock().unwrap_or_else(|e| e.into_inner())
}
