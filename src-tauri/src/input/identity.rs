//! Stable device identity and the rules that match a persisted binding to a
//! device that is attached right now.
//!
//! The requirement this exists for: unplugging a wheel, replugging it, or
//! moving it to another USB port must not shuffle bindings. That rules out the
//! enumeration index and the HID interface path — both encode the port. The
//! primary key is `DIDEVICEINSTANCE.guidInstance`, which DirectInput derives
//! from the device's installation record and which survives both.
//!
//! A minority of drivers regenerate that GUID on reinstall, hence the
//! vendor/product fallback below. Pure logic, no COM — kept testable.

use crate::model::input::InputDevice;

/// A device as DirectInput currently reports it.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DeviceIdentity {
    /// Primary key: guidInstance formatted as a lowercase UUID string.
    pub id: String,
    pub vendor_id: u16,
    pub product_id: u16,
    pub product_name: String,
    pub button_count: u32,
}

impl DeviceIdentity {
    pub fn to_device(&self, connected: bool) -> InputDevice {
        InputDevice {
            id: self.id.clone(),
            vendor_id: self.vendor_id,
            product_id: self.product_id,
            product_name: self.product_name.clone(),
            button_count: self.button_count,
            connected,
        }
    }

    fn same_model(&self, other: &InputDevice) -> bool {
        self.vendor_id == other.vendor_id
            && self.product_id == other.product_id
            && self.product_name == other.product_name
    }
}

/// One stored device id that should be rewritten to a live one.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DeviceRemap {
    pub previous_id: String,
    pub next_id: String,
}

/// Resolves stored devices against the attached ones.
///
/// 1. exact id match — the normal path, nothing to do;
/// 2. otherwise, a stored device may adopt the id of an attached device of the
///    same model, but only when exactly one candidate on each side is
///    unclaimed. Two identical wheels are therefore never merged or guessed
///    at — they keep their own ids and the ambiguous one is left offline.
/// 3. anything still unmatched is offline; its bindings are kept, not dropped.
pub fn resolve_remaps(stored: &[InputDevice], attached: &[DeviceIdentity]) -> Vec<DeviceRemap> {
    let claimed_ids: Vec<&str> = attached.iter().map(|device| device.id.as_str()).collect();

    let unmatched_stored: Vec<&InputDevice> = stored
        .iter()
        .filter(|device| !claimed_ids.contains(&device.id.as_str()))
        .collect();

    let stored_ids: Vec<&str> = stored.iter().map(|device| device.id.as_str()).collect();

    let unclaimed_attached: Vec<&DeviceIdentity> = attached
        .iter()
        .filter(|device| !stored_ids.contains(&device.id.as_str()))
        .collect();

    let mut remaps = Vec::new();

    for candidate in &unmatched_stored {
        let same_model_stored = unmatched_stored
            .iter()
            .filter(|other| {
                other.vendor_id == candidate.vendor_id
                    && other.product_id == candidate.product_id
                    && other.product_name == candidate.product_name
            })
            .count();

        let matches: Vec<&&DeviceIdentity> = unclaimed_attached
            .iter()
            .filter(|live| live.same_model(candidate))
            .collect();

        // Ambiguity on either side means we cannot tell the two apart; leaving
        // the device offline is recoverable, silently swapping bindings between
        // two identical button boxes is not.
        if same_model_stored != 1 || matches.len() != 1 {
            continue;
        }

        remaps.push(DeviceRemap {
            previous_id: candidate.id.clone(),
            next_id: matches[0].id.clone(),
        });
    }

    remaps
}

/// The device list the frontend renders: every attached device, plus stored
/// ones that are not attached right now, marked offline so their bindings can
/// be shown greyed instead of disappearing.
pub fn merge_device_lists(stored: &[InputDevice], attached: &[DeviceIdentity]) -> Vec<InputDevice> {
    let mut devices: Vec<InputDevice> = attached
        .iter()
        .map(|identity| identity.to_device(true))
        .collect();

    for device in stored {
        if devices.iter().any(|live| live.id == device.id) {
            continue;
        }

        devices.push(InputDevice {
            connected: false,
            ..device.clone()
        });
    }

    devices
}

#[cfg(test)]
mod tests {
    use super::*;

    fn identity(id: &str, product_id: u16, name: &str) -> DeviceIdentity {
        DeviceIdentity {
            id: id.to_string(),
            vendor_id: 0x0eb7,
            product_id,
            product_name: name.to_string(),
            button_count: 32,
        }
    }

    fn stored(id: &str, product_id: u16, name: &str) -> InputDevice {
        identity(id, product_id, name).to_device(true)
    }

    #[test]
    fn exact_id_match_needs_no_remap() {
        let devices = vec![stored("guid-a", 1, "CSL DD")];
        let live = vec![identity("guid-a", 1, "CSL DD")];

        assert!(resolve_remaps(&devices, &live).is_empty());
    }

    #[test]
    fn regenerated_guid_is_rewritten_via_vendor_product() {
        let devices = vec![stored("guid-old", 1, "CSL DD")];
        let live = vec![identity("guid-new", 1, "CSL DD")];

        assert_eq!(
            resolve_remaps(&devices, &live),
            vec![DeviceRemap {
                previous_id: "guid-old".to_string(),
                next_id: "guid-new".to_string(),
            }]
        );
    }

    #[test]
    fn two_identical_devices_are_never_auto_matched() {
        let devices = vec![stored("guid-old-1", 1, "Button Box")];
        let live = vec![
            identity("guid-new-1", 1, "Button Box"),
            identity("guid-new-2", 1, "Button Box"),
        ];

        assert!(resolve_remaps(&devices, &live).is_empty());
    }

    #[test]
    fn different_model_is_not_a_fallback_match() {
        let devices = vec![stored("guid-old", 1, "CSL DD")];
        let live = vec![identity("guid-new", 2, "Handbrake")];

        assert!(resolve_remaps(&devices, &live).is_empty());
    }

    #[test]
    fn a_device_already_present_does_not_donate_its_id() {
        let devices = vec![
            stored("guid-a", 1, "Button Box"),
            stored("guid-old", 1, "Button Box"),
        ];
        let live = vec![identity("guid-a", 1, "Button Box")];

        // "guid-a" is claimed by an exact match, so the stale entry has no
        // unclaimed candidate to adopt.
        assert!(resolve_remaps(&devices, &live).is_empty());
    }

    #[test]
    fn stored_but_detached_device_is_listed_offline() {
        let devices = vec![stored("guid-gone", 3, "Handbrake")];
        let live = vec![identity("guid-a", 1, "CSL DD")];

        let merged = merge_device_lists(&devices, &live);

        assert_eq!(merged.len(), 2);
        assert!(merged.iter().any(|d| d.id == "guid-a" && d.connected));
        assert!(merged.iter().any(|d| d.id == "guid-gone" && !d.connected));
    }
}
