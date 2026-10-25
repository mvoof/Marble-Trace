//! The poll thread's COM apartment, held by a guard so every exit path — an
//! early return or a panic in the poll loop — uninitialises it exactly once.

use std::marker::PhantomData;

use windows::Win32::System::Com::{CoInitializeEx, CoUninitialize, COINIT_APARTMENTTHREADED};

/// Owns this thread's COM apartment; uninitialises only what it initialised.
pub struct ComApartment {
    /// `!Send`: the apartment belongs to the thread that entered it.
    _not_send: PhantomData<*const ()>,
}

impl ComApartment {
    /// `S_FALSE` (already initialised on this thread) is success and still
    /// needs its matching uninit; `RPC_E_CHANGED_MODE` is an error and gets
    /// none.
    pub fn enter() -> windows::core::Result<Self> {
        // SAFETY: no pointers are passed; the guard is `!Send`, so the paired
        // `CoUninitialize` runs on this same thread.
        unsafe { CoInitializeEx(None, COINIT_APARTMENTTHREADED) }.ok()?;

        Ok(Self {
            _not_send: PhantomData,
        })
    }
}

impl Drop for ComApartment {
    fn drop(&mut self) {
        // SAFETY: paired with the successful `CoInitializeEx` in `enter`, on
        // the same thread.
        unsafe { CoUninitialize() };
    }
}
