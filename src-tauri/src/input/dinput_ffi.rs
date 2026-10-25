//! Every DirectInput8 call the poll thread makes, behind safe types.
//!
//! windows-rs marks each COM method `unsafe`, whatever its arguments, so the
//! calls live here and nowhere else: a [`Joystick`] can only be obtained from
//! [`DirectInput::open`], which has already set its data format, and the only
//! buffer DirectInput writes into is a [`ButtonState`] whose size is pinned at
//! compile time. `super::dinput` builds on these without any `unsafe`.

use std::ffi::c_void;
use std::sync::OnceLock;

use windows::core::{Interface, BOOL, GUID};
use windows::Win32::Devices::HumanInterfaceDevice::{
    DirectInput8Create, IDirectInput8W, IDirectInputDevice8W, DI8DEVCLASS_GAMECTRL, DIDATAFORMAT,
    DIDEVCAPS, DIDEVICEINSTANCEW, DIDFT_ANYINSTANCE, DIDFT_BUTTON, DIDFT_POV, DIDF_ABSAXIS,
    DIEDFL_ATTACHEDONLY, DIENUM_CONTINUE, DIENUM_STOP, DIOBJECTDATAFORMAT, DIRECTINPUT_VERSION,
    DISCL_BACKGROUND, DISCL_NONEXCLUSIVE,
};
use windows::Win32::Foundation::{E_FAIL, E_POINTER, HINSTANCE, HWND};
use windows::Win32::System::LibraryLoader::GetModuleHandleW;

pub const DI_BUTTON_COUNT: usize = 128;
pub const DI_POV_COUNT: usize = 4;
/// Not in the windows-rs metadata. Without it `SetDataFormat` rejects any
/// device that has fewer objects than the format describes — i.e. all of them.
const DIDFT_OPTIONAL: u32 = 0x8000_0000;

/// Only buttons and hats are bindable, so the device is asked for exactly
/// those instead of the full `DIJOYSTATE2`. windows-rs ships no
/// `c_dfDIJoystick2` (the predefined formats are plain data exports of
/// dinput8.lib, which has no metadata), and a format we build ourselves is
/// both smaller and free of that link dependency.
#[repr(C)]
pub struct ButtonState {
    pub povs: [u32; DI_POV_COUNT],
    pub buttons: [u8; DI_BUTTON_COUNT],
}

/// The bytes `GetDeviceState` writes. The format announces it as `dwDataSize`
/// and the read passes it as the buffer size, so both come from here.
const JOYSTICK_DATA_SIZE: usize = DI_POV_COUNT * size_of::<u32>() + DI_BUTTON_COUNT;

const _: () = assert!(size_of::<ButtonState>() == JOYSTICK_DATA_SIZE);

impl Default for ButtonState {
    fn default() -> Self {
        Self {
            povs: [0; DI_POV_COUNT],
            buttons: [0; DI_BUTTON_COUNT],
        }
    }
}

/// The format keeps raw pointers into its own object array, so it is built once
/// and kept in a `OnceLock` — DirectInput holds the pointer for the lifetime of
/// every device created with it.
struct JoystickFormat {
    format: DIDATAFORMAT,
    _objects: Vec<DIOBJECTDATAFORMAT>,
}

// SAFETY: the only raw pointers inside point at `_objects`, which lives in the
// same struct. The value sits in a `OnceLock`, so it is never mutated after
// init and never dropped: other threads only ever read data that cannot change
// or move.
unsafe impl Send for JoystickFormat {}
// SAFETY: see `Send` above.
unsafe impl Sync for JoystickFormat {}

static JOYSTICK_FORMAT: OnceLock<JoystickFormat> = OnceLock::new();

fn joystick_format() -> &'static DIDATAFORMAT {
    let built = JOYSTICK_FORMAT.get_or_init(|| {
        let mut objects: Vec<DIOBJECTDATAFORMAT> =
            Vec::with_capacity(DI_POV_COUNT + DI_BUTTON_COUNT);

        for index in 0..DI_POV_COUNT {
            objects.push(DIOBJECTDATAFORMAT {
                // Null guid: match any object of this type, in device order.
                pguid: std::ptr::null(),
                dwOfs: (index * size_of::<u32>()) as u32,
                dwType: DIDFT_POV | DIDFT_ANYINSTANCE | DIDFT_OPTIONAL,
                dwFlags: 0,
            });
        }

        let buttons_offset = size_of::<[u32; DI_POV_COUNT]>();

        for index in 0..DI_BUTTON_COUNT {
            objects.push(DIOBJECTDATAFORMAT {
                pguid: std::ptr::null(),
                dwOfs: (buttons_offset + index) as u32,
                dwType: DIDFT_BUTTON | DIDFT_ANYINSTANCE | DIDFT_OPTIONAL,
                dwFlags: 0,
            });
        }

        let format = DIDATAFORMAT {
            dwSize: size_of::<DIDATAFORMAT>() as u32,
            dwObjSize: size_of::<DIOBJECTDATAFORMAT>() as u32,
            dwFlags: DIDF_ABSAXIS,
            dwDataSize: JOYSTICK_DATA_SIZE as u32,
            dwNumObjs: objects.len() as u32,
            rgodf: objects.as_ptr() as *mut DIOBJECTDATAFORMAT,
        };

        JoystickFormat {
            format,
            _objects: objects,
        }
    });

    &built.format
}

/// # Safety
///
/// Passed only to `EnumDevices` in [`DirectInput::attached_game_controllers`]:
/// `context` is the `Vec<DIDEVICEINSTANCEW>` handed in there, `instance` is
/// valid for the duration of the call. A null pointer stops the enumeration.
///
/// Unwinding out of an `extern "system"` function aborts the process; the body
/// is one copy and one `push`, neither of which unwinds.
unsafe extern "system" fn collect_device(
    instance: *mut DIDEVICEINSTANCEW,
    context: *mut c_void,
) -> BOOL {
    // SAFETY: per this function's contract, `context` is null or the live,
    // unaliased `Vec` the synchronous `EnumDevices` call was given.
    let found = unsafe { (context as *mut Vec<DIDEVICEINSTANCEW>).as_mut() };
    // SAFETY: DirectInput passes a pointer that is null or valid for this call.
    let instance = unsafe { instance.as_ref() };

    let (Some(found), Some(instance)) = (found, instance) else {
        return BOOL(DIENUM_STOP as i32);
    };

    found.push(*instance);

    BOOL(DIENUM_CONTINUE as i32)
}

/// The DirectInput8 context, bound to the window devices report to.
pub struct DirectInput {
    context: IDirectInput8W,
    hwnd: HWND,
}

impl DirectInput {
    /// `hwnd` must be a real top-level window: DirectInput refuses background
    /// cooperative level without one.
    pub fn new(hwnd: HWND) -> windows::core::Result<Self> {
        // SAFETY: `None` asks for our own exe's module handle, which is not
        // reference-counted and stays valid for the process lifetime.
        let module = unsafe { GetModuleHandleW(None)? };
        let mut raw: *mut c_void = std::ptr::null_mut();

        // SAFETY: the IID is a static, `raw` is an out-pointer to a local, and
        // no outer object is passed for aggregation.
        unsafe {
            DirectInput8Create(
                HINSTANCE::from(module),
                DIRECTINPUT_VERSION,
                &IDirectInput8W::IID as *const GUID,
                &mut raw,
                None::<&windows::core::IUnknown>,
            )?;
        }

        if raw.is_null() {
            return Err(windows::core::Error::new(
                E_POINTER,
                "DirectInput8Create returned no interface",
            ));
        }

        // SAFETY: `raw` is a non-null `IDirectInput8W` the call above handed us
        // one reference to; `from_raw` takes over that reference, exactly once.
        let context = unsafe { IDirectInput8W::from_raw(raw) };

        Ok(Self { context, hwnd })
    }

    /// Every attached game controller, in DirectInput's order.
    pub fn attached_game_controllers(&self) -> windows::core::Result<Vec<DIDEVICEINSTANCEW>> {
        let mut found: Vec<DIDEVICEINSTANCEW> = Vec::new();

        // SAFETY: `collect_device`'s contract — the call is synchronous and
        // `found` is the `Vec` it expects, alive and unborrowed throughout.
        unsafe {
            self.context.EnumDevices(
                DI8DEVCLASS_GAMECTRL,
                Some(collect_device),
                &mut found as *mut Vec<DIDEVICEINSTANCEW> as *mut c_void,
                DIEDFL_ATTACHEDONLY,
            )?;
        }

        Ok(found)
    }

    /// Opens a device for background, non-exclusive reads in our format.
    pub fn open(&self, instance_guid: &GUID) -> windows::core::Result<Joystick> {
        let mut device: Option<IDirectInputDevice8W> = None;

        // SAFETY: `instance_guid` outlives the call; `device` is a local
        // out-parameter that receives the one reference.
        unsafe {
            self.context
                .CreateDevice(instance_guid, &mut device, None)?
        };

        let device = device
            .ok_or_else(|| windows::core::Error::new(E_FAIL, "CreateDevice returned no device"))?;

        // SAFETY: the format is `'static` (see `JoystickFormat`) and DirectInput
        // only reads it; the `*mut` is a windows-rs signature artefact.
        unsafe {
            device.SetDataFormat(joystick_format() as *const DIDATAFORMAT as *mut DIDATAFORMAT)?;
        }

        // SAFETY: plain value arguments; DirectInput validates the window.
        unsafe { device.SetCooperativeLevel(self.hwnd, DISCL_BACKGROUND | DISCL_NONEXCLUSIVE)? };

        Ok(Joystick { device })
    }
}

/// An opened device. Only [`DirectInput::open`] makes one, so its data format
/// is always set to [`ButtonState`]'s layout.
pub struct Joystick {
    device: IDirectInputDevice8W,
}

impl Joystick {
    pub fn button_count(&self) -> Option<u32> {
        let mut caps = DIDEVCAPS {
            dwSize: size_of::<DIDEVCAPS>() as u32,
            ..Default::default()
        };

        // SAFETY: `caps` is a local with `dwSize` set, as the call requires.
        let read = unsafe { self.device.GetCapabilities(&mut caps) };

        read.ok().map(|_| caps.dwButtons)
    }

    /// May fail until the device settles, or after it lost focus or power.
    pub fn acquire(&self) -> bool {
        // SAFETY: no arguments; `device` is a live interface this value owns.
        unsafe { self.device.Acquire() }.is_ok()
    }

    /// `None` when the device has to be acquired again (`DIERR_INPUTLOST`,
    /// `DIERR_NOTACQUIRED`).
    pub fn read_state(&self) -> Option<ButtonState> {
        // SAFETY: no arguments; `device` is a live interface this value owns.
        unsafe { self.device.Poll() }.ok()?;

        let mut state = ButtonState::default();

        // SAFETY: `state` is exactly `JOYSTICK_DATA_SIZE` bytes (pinned above),
        // the size the data format announced and the size passed here.
        unsafe {
            self.device.GetDeviceState(
                JOYSTICK_DATA_SIZE as u32,
                &mut state as *mut ButtonState as *mut c_void,
            )
        }
        .ok()?;

        Some(state)
    }
}
