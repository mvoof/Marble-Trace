//! DirectInput8 enumeration and polling.
//!
//! DirectInput rather than XInput or raw HID because it is the only one of the
//! three that keeps delivering state while the sim owns foreground focus
//! (`DISCL_BACKGROUND`), which is the entire point of a global binding.
//!
//! Everything here runs on the poll thread: the COM objects are created there
//! and never leave it. The rest of the app talks to this module through the
//! channel in `super::runtime`.

use std::ffi::c_void;
use std::time::{Duration, Instant};

use std::sync::OnceLock;

use windows::core::{Interface, GUID};
use windows::Win32::Devices::HumanInterfaceDevice::{
    DirectInput8Create, IDirectInput8W, IDirectInputDevice8W, DI8DEVCLASS_GAMECTRL, DIDATAFORMAT,
    DIDEVCAPS, DIDEVICEINSTANCEW, DIDFT_ANYINSTANCE, DIDFT_BUTTON, DIDFT_POV, DIDF_ABSAXIS,
    DIEDFL_ATTACHEDONLY, DIENUM_CONTINUE, DIOBJECTDATAFORMAT, DIRECTINPUT_VERSION,
    DISCL_BACKGROUND, DISCL_NONEXCLUSIVE,
};
use windows::Win32::Foundation::{BOOL, E_FAIL, HINSTANCE, HWND};
use windows::Win32::System::LibraryLoader::GetModuleHandleW;

use super::identity::DeviceIdentity;

/// Buttons past this index are synthetic POV-hat directions, so a binding stays
/// a flat integer instead of needing a second "kind" field.
pub const POV_BUTTON_BASE: u32 = 1000;

const POV_DIRECTIONS: u32 = 4;
const POV_CENTERED: u32 = 0xFFFF;
/// Hundredths of a degree — DirectInput's POV unit.
const POV_DEGREE_RANGE: u32 = 36000;

const DI_BUTTON_COUNT: usize = 128;
const DI_POV_COUNT: usize = 4;
/// Bit 7 set means "down" in DirectInput's button bytes.
const DI_BUTTON_DOWN_MASK: u8 = 0x80;
/// Not in the windows-rs metadata. Without it `SetDataFormat` rejects any
/// device that has fewer objects than the format describes — i.e. all of them.
const DIDFT_OPTIONAL: u32 = 0x8000_0000;

/// Only buttons and hats are bindable, so the device is asked for exactly
/// those instead of the full `DIJOYSTATE2`. windows-rs ships no
/// `c_dfDIJoystick2` (the predefined formats are plain data exports of
/// dinput8.lib, which has no metadata), and a format we build ourselves is
/// both smaller and free of that link dependency.
#[repr(C)]
struct ButtonState {
    povs: [u32; DI_POV_COUNT],
    buttons: [u8; DI_BUTTON_COUNT],
}

impl Default for ButtonState {
    fn default() -> Self {
        Self {
            povs: [0; DI_POV_COUNT],
            buttons: [0; DI_BUTTON_COUNT],
        }
    }
}

/// The format keeps raw pointers into its own object array, so it is built once
/// and leaked into a `OnceLock` — DirectInput holds the pointer for the
/// lifetime of every device created with it.
struct JoystickFormat {
    format: DIDATAFORMAT,
    _objects: Vec<DIOBJECTDATAFORMAT>,
}

// SAFETY: the pointers inside point only at `_objects`, which lives in the same
// struct and is never mutated after construction.
unsafe impl Send for JoystickFormat {}
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
                dwOfs: (index * std::mem::size_of::<u32>()) as u32,
                dwType: DIDFT_POV | DIDFT_ANYINSTANCE | DIDFT_OPTIONAL,
                dwFlags: 0,
            });
        }

        let buttons_offset = std::mem::size_of::<[u32; DI_POV_COUNT]>();

        for index in 0..DI_BUTTON_COUNT {
            objects.push(DIOBJECTDATAFORMAT {
                pguid: std::ptr::null(),
                dwOfs: (buttons_offset + index) as u32,
                dwType: DIDFT_BUTTON | DIDFT_ANYINSTANCE | DIDFT_OPTIONAL,
                dwFlags: 0,
            });
        }

        let format = DIDATAFORMAT {
            dwSize: std::mem::size_of::<DIDATAFORMAT>() as u32,
            dwObjSize: std::mem::size_of::<DIOBJECTDATAFORMAT>() as u32,
            dwFlags: DIDF_ABSAXIS,
            dwDataSize: std::mem::size_of::<ButtonState>() as u32,
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

/// 8 ms matches a typical wheel's report rate and costs almost nothing.
pub const POLL_INTERVAL: Duration = Duration::from_millis(8);
/// How often to look for newly attached devices while something is missing.
pub const REENUM_INTERVAL: Duration = Duration::from_secs(2);

/// One button edge, as the poll loop sees it.
pub struct ButtonEdge {
    pub device_id: String,
    pub button: u32,
    pub pressed: bool,
}

struct OpenDevice {
    identity: DeviceIdentity,
    device: IDirectInputDevice8W,
    acquired: bool,
    buttons: [bool; DI_BUTTON_COUNT],
    povs: [[bool; POV_DIRECTIONS as usize]; DI_POV_COUNT],
}

pub struct DirectInputSession {
    context: IDirectInput8W,
    hwnd: HWND,
    devices: Vec<OpenDevice>,
    last_enumeration: Instant,
}

/// GUID formatting is done by hand rather than via Debug so the persisted id
/// shape is pinned here and can never drift with a windows-rs release.
fn format_guid(guid: &GUID) -> String {
    let bytes = guid.to_u128().to_be_bytes();

    format!(
        "{:08x}-{:04x}-{:04x}-{:02x}{:02x}-{:02x}{:02x}{:02x}{:02x}{:02x}{:02x}",
        u32::from_be_bytes([bytes[0], bytes[1], bytes[2], bytes[3]]),
        u16::from_be_bytes([bytes[4], bytes[5]]),
        u16::from_be_bytes([bytes[6], bytes[7]]),
        bytes[8],
        bytes[9],
        bytes[10],
        bytes[11],
        bytes[12],
        bytes[13],
        bytes[14],
        bytes[15],
    )
}

fn wide_to_string(chars: &[u16]) -> String {
    let end = chars.iter().position(|c| *c == 0).unwrap_or(chars.len());

    String::from_utf16_lossy(&chars[..end])
}

/// For HID devices DirectInput packs the USB ids into `guidProduct.data1`:
/// low word vendor, high word product. Cheaper and more reliable than a
/// separate `GetProperty(DIPROP_VIDPID)` round trip.
fn vendor_product(instance: &DIDEVICEINSTANCEW) -> (u16, u16) {
    let packed = instance.guidProduct.data1;

    (packed as u16, (packed >> 16) as u16)
}

struct EnumContext {
    found: Vec<(GUID, DeviceIdentity)>,
}

unsafe extern "system" fn enum_devices_callback(
    instance: *mut DIDEVICEINSTANCEW,
    context: *mut c_void,
) -> BOOL {
    let collected = &mut *(context as *mut EnumContext);
    let instance = &*instance;
    let (vendor_id, product_id) = vendor_product(instance);

    collected.found.push((
        instance.guidInstance,
        DeviceIdentity {
            id: format_guid(&instance.guidInstance),
            vendor_id,
            product_id,
            product_name: wide_to_string(&instance.tszProductName),
            // Filled in after the device is opened — capabilities need the
            // device object, which the enumeration callback does not have.
            button_count: 0,
        },
    ));

    BOOL(DIENUM_CONTINUE as i32)
}

impl DirectInputSession {
    /// `hwnd` must be a real top-level window: DirectInput refuses background
    /// cooperative level without one.
    pub fn new(hwnd: HWND) -> windows::core::Result<Self> {
        let module = unsafe { GetModuleHandleW(None)? };
        let mut raw: *mut c_void = std::ptr::null_mut();

        unsafe {
            DirectInput8Create(
                HINSTANCE::from(module),
                DIRECTINPUT_VERSION,
                &IDirectInput8W::IID as *const GUID,
                &mut raw,
                None::<&windows::core::IUnknown>,
            )?;
        }

        let context = unsafe { IDirectInput8W::from_raw(raw) };

        Ok(Self {
            context,
            hwnd,
            devices: Vec::new(),
            last_enumeration: Instant::now() - REENUM_INTERVAL,
        })
    }

    pub fn identities(&self) -> Vec<DeviceIdentity> {
        self.devices
            .iter()
            .map(|open| open.identity.clone())
            .collect()
    }

    /// Opens every attached game controller that is not open yet, and drops the
    /// ones that have gone away. Returns true when the device list changed.
    pub fn refresh_devices(&mut self) -> bool {
        self.last_enumeration = Instant::now();

        let mut collected = EnumContext { found: Vec::new() };

        let result = unsafe {
            self.context.EnumDevices(
                DI8DEVCLASS_GAMECTRL,
                Some(enum_devices_callback),
                &mut collected as *mut EnumContext as *mut c_void,
                DIEDFL_ATTACHEDONLY,
            )
        };

        if let Err(error) = result {
            tracing::warn!("DirectInput device enumeration failed: {error}");

            return false;
        }

        let found_ids: Vec<String> = collected
            .found
            .iter()
            .map(|(_, identity)| identity.id.clone())
            .collect();

        let before = self.devices.len();

        self.devices
            .retain(|open| found_ids.contains(&open.identity.id));

        let mut changed = self.devices.len() != before;

        for (guid, identity) in collected.found {
            if self
                .devices
                .iter()
                .any(|open| open.identity.id == identity.id)
            {
                continue;
            }

            match self.open_device(&guid, identity) {
                Ok(open) => {
                    tracing::info!(
                        "input device connected: {} ({} buttons)",
                        open.identity.product_name,
                        open.identity.button_count
                    );

                    self.devices.push(open);
                    changed = true;
                }
                Err(error) => {
                    // A driver that refuses background access is unusable for
                    // global bindings, but must not take startup down with it.
                    tracing::warn!("failed to open input device: {error}");
                }
            }
        }

        changed
    }

    fn open_device(
        &self,
        guid: &GUID,
        mut identity: DeviceIdentity,
    ) -> windows::core::Result<OpenDevice> {
        let mut device: Option<IDirectInputDevice8W> = None;

        unsafe { self.context.CreateDevice(guid, &mut device, None)? };

        let device = device
            .ok_or_else(|| windows::core::Error::new(E_FAIL, "CreateDevice returned no device"))?;

        unsafe {
            device.SetDataFormat(joystick_format() as *const DIDATAFORMAT as *mut DIDATAFORMAT)?;
            device.SetCooperativeLevel(self.hwnd, DISCL_BACKGROUND | DISCL_NONEXCLUSIVE)?;
        }

        let mut caps = DIDEVCAPS {
            dwSize: std::mem::size_of::<DIDEVCAPS>() as u32,
            ..Default::default()
        };

        if unsafe { device.GetCapabilities(&mut caps) }.is_ok() {
            identity.button_count = caps.dwButtons;
        }

        // Acquisition may legitimately fail until the device settles; the poll
        // loop retries it on every tick.
        let acquired = unsafe { device.Acquire() }.is_ok();

        Ok(OpenDevice {
            identity,
            device,
            acquired,
            buttons: [false; DI_BUTTON_COUNT],
            povs: [[false; POV_DIRECTIONS as usize]; DI_POV_COUNT],
        })
    }

    pub fn should_reenumerate(&self) -> bool {
        self.last_enumeration.elapsed() >= REENUM_INTERVAL
    }

    /// One poll tick. Returns only the edges — a held button is reported once.
    pub fn poll(&mut self) -> Vec<ButtonEdge> {
        let mut edges = Vec::new();

        for open in &mut self.devices {
            if !open.acquired {
                open.acquired = unsafe { open.device.Acquire() }.is_ok();

                if !open.acquired {
                    continue;
                }
            }

            if unsafe { open.device.Poll() }.is_err() {
                // DIERR_INPUTLOST / DIERR_NOTACQUIRED: re-acquire next tick.
                open.acquired = false;
                continue;
            }

            let mut state = ButtonState::default();

            let read = unsafe {
                open.device.GetDeviceState(
                    std::mem::size_of::<ButtonState>() as u32,
                    &mut state as *mut ButtonState as *mut c_void,
                )
            };

            if read.is_err() {
                open.acquired = false;
                continue;
            }

            collect_button_edges(open, &state, &mut edges);
            collect_pov_edges(open, &state, &mut edges);
        }

        edges
    }
}

fn collect_button_edges(open: &mut OpenDevice, state: &ButtonState, edges: &mut Vec<ButtonEdge>) {
    for index in 0..DI_BUTTON_COUNT {
        let pressed = state.buttons[index] & DI_BUTTON_DOWN_MASK != 0;

        if pressed == open.buttons[index] {
            continue;
        }

        open.buttons[index] = pressed;

        edges.push(ButtonEdge {
            device_id: open.identity.id.clone(),
            button: index as u32,
            pressed,
        });
    }
}

/// A hat is reported as an angle, so it is expanded into four directional
/// pseudo-buttons; a diagonal counts as both of its neighbours held.
fn collect_pov_edges(open: &mut OpenDevice, state: &ButtonState, edges: &mut Vec<ButtonEdge>) {
    for hat in 0..DI_POV_COUNT {
        let angle = state.povs[hat];
        let centered = angle == POV_CENTERED || angle > POV_DEGREE_RANGE;

        for direction in 0..POV_DIRECTIONS {
            let pressed = !centered && pov_direction_active(angle, direction);

            if pressed == open.povs[hat][direction as usize] {
                continue;
            }

            open.povs[hat][direction as usize] = pressed;

            edges.push(ButtonEdge {
                device_id: open.identity.id.clone(),
                button: POV_BUTTON_BASE + hat as u32 * POV_DIRECTIONS + direction,
                pressed,
            });
        }
    }
}

/// Direction 0 is up, then clockwise. Each direction covers a 135° arc centred
/// on its axis, so the diagonals overlap two of them.
fn pov_direction_active(angle: u32, direction: u32) -> bool {
    let quarter = POV_DEGREE_RANGE / POV_DIRECTIONS;
    let centre = direction * quarter;
    let distance = (angle as i32 - centre as i32).unsigned_abs();
    let wrapped = distance.min(POV_DEGREE_RANGE - distance);

    wrapped < quarter * 3 / 4
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn pov_up_activates_only_up() {
        assert!(pov_direction_active(0, 0));
        assert!(!pov_direction_active(0, 1));
        assert!(!pov_direction_active(0, 2));
        assert!(!pov_direction_active(0, 3));
    }

    #[test]
    fn pov_diagonal_activates_both_neighbours() {
        let up_right = POV_DEGREE_RANGE / 8;

        assert!(pov_direction_active(up_right, 0));
        assert!(pov_direction_active(up_right, 1));
        assert!(!pov_direction_active(up_right, 2));
    }

    #[test]
    fn pov_wraps_around_zero() {
        let up_left = POV_DEGREE_RANGE - POV_DEGREE_RANGE / 8;

        assert!(pov_direction_active(up_left, 0));
        assert!(pov_direction_active(up_left, 3));
    }

    #[test]
    fn guid_is_formatted_as_lowercase_uuid() {
        let guid = GUID::from_u128(0x1234_5678_9abc_def0_1234_5678_9abc_def0);

        assert_eq!(format_guid(&guid), "12345678-9abc-def0-1234-56789abcdef0");
    }
}
