//! DirectInput8 enumeration and polling.
//!
//! DirectInput rather than XInput or raw HID because it is the only one of the
//! three that keeps delivering state while the sim owns foreground focus
//! (`DISCL_BACKGROUND`), which is the entire point of a global binding.
//!
//! Everything here runs on the poll thread: the COM objects are created there
//! and never leave it. The rest of the app talks to this module through the
//! channel in `super::runtime`. The FFI itself is in `super::dinput_ffi`.

use std::time::{Duration, Instant};

use windows::core::GUID;
use windows::Win32::Devices::HumanInterfaceDevice::DIDEVICEINSTANCEW;
use windows::Win32::Foundation::HWND;

use super::dinput_ffi::{ButtonState, DirectInput, Joystick, DI_BUTTON_COUNT, DI_POV_COUNT};
use super::identity::DeviceIdentity;

/// Buttons past this index are synthetic POV-hat directions, so a binding stays
/// a flat integer instead of needing a second "kind" field.
pub const POV_BUTTON_BASE: u32 = 1000;

const POV_DIRECTIONS: u32 = 4;
const POV_CENTERED: u32 = 0xFFFF;
/// Hundredths of a degree — DirectInput's POV unit.
const POV_DEGREE_RANGE: u32 = 36000;

/// Bit 7 set means "down" in DirectInput's button bytes.
const DI_BUTTON_DOWN_MASK: u8 = 0x80;

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
    joystick: Joystick,
    acquired: bool,
    buttons: [bool; DI_BUTTON_COUNT],
    povs: [[bool; POV_DIRECTIONS as usize]; DI_POV_COUNT],
}

pub struct DirectInputSession {
    direct_input: DirectInput,
    devices: Vec<OpenDevice>,
    /// `None` until the first enumeration, which is then due at once.
    last_enumeration: Option<Instant>,
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

fn identity_of(instance: &DIDEVICEINSTANCEW) -> DeviceIdentity {
    let (vendor_id, product_id) = vendor_product(instance);

    DeviceIdentity {
        id: format_guid(&instance.guidInstance),
        vendor_id,
        product_id,
        product_name: wide_to_string(&instance.tszProductName),
        // Filled in after the device is opened — capabilities need the
        // device object, which enumeration does not have.
        button_count: 0,
    }
}

impl DirectInputSession {
    /// `hwnd` must be a real top-level window: DirectInput refuses background
    /// cooperative level without one.
    pub fn new(hwnd: HWND) -> windows::core::Result<Self> {
        Ok(Self {
            direct_input: DirectInput::new(hwnd)?,
            devices: Vec::new(),
            last_enumeration: None,
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
        self.last_enumeration = Some(Instant::now());

        let instances = match self.direct_input.attached_game_controllers() {
            Ok(instances) => instances,
            Err(error) => {
                tracing::warn!("DirectInput device enumeration failed: {error}");

                return false;
            }
        };

        let found: Vec<(GUID, DeviceIdentity)> = instances
            .iter()
            .map(|instance| (instance.guidInstance, identity_of(instance)))
            .collect();

        let found_ids: Vec<String> = found
            .iter()
            .map(|(_, identity)| identity.id.clone())
            .collect();

        let before = self.devices.len();

        self.devices
            .retain(|open| found_ids.contains(&open.identity.id));

        let mut changed = self.devices.len() != before;

        for (guid, identity) in found {
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
        let joystick = self.direct_input.open(guid)?;

        if let Some(button_count) = joystick.button_count() {
            identity.button_count = button_count;
        }

        // Acquisition may legitimately fail until the device settles; the poll
        // loop retries it on every tick.
        let acquired = joystick.acquire();

        Ok(OpenDevice {
            identity,
            joystick,
            acquired,
            buttons: [false; DI_BUTTON_COUNT],
            povs: [[false; POV_DIRECTIONS as usize]; DI_POV_COUNT],
        })
    }

    pub fn should_reenumerate(&self) -> bool {
        self.last_enumeration
            .is_none_or(|enumerated_at| enumerated_at.elapsed() >= REENUM_INTERVAL)
    }

    /// One poll tick. Returns only the edges — a held button is reported once.
    pub fn poll(&mut self) -> Vec<ButtonEdge> {
        let mut edges = Vec::new();

        for open in &mut self.devices {
            if !open.acquired {
                open.acquired = open.joystick.acquire();

                if !open.acquired {
                    continue;
                }
            }

            let Some(state) = open.joystick.read_state() else {
                // Input lost or not acquired: re-acquire next tick.
                open.acquired = false;
                continue;
            };

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
