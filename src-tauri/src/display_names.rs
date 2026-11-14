//! The model name of each attached monitor ("DELL U2723"), keyed by the GDI
//! device name the webview's monitor list reports (`\\.\DISPLAY1`).
//!
//! Tauri names a monitor by its GDI device alone. The name printed on the
//! bezel comes from the monitor's EDID, which Windows hands out only through
//! the display configuration API: one active path per lit monitor, its source
//! carrying the GDI name and its target the EDID name.

use serde::Serialize;

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[cfg_attr(feature = "dev", derive(specta::Type))]
#[serde(rename_all = "camelCase")]
pub struct DisplayName {
    /// As Windows spells it, prefix included: `\\.\DISPLAY1`.
    pub device_name: String,
    /// The EDID's friendly name. A monitor that reports none (some laptop
    /// panels, most capture dummies) is left out of the list.
    pub model: String,
}

#[cfg(feature = "dev")]
pub fn register_types(types: &mut specta::TypeCollection) {
    types.register::<DisplayName>();
}

/// A fixed-size wide string up to its first NUL.
fn wide_to_string(wide: &[u16]) -> String {
    let units: Vec<u16> = wide.iter().copied().take_while(|&unit| unit != 0).collect();

    String::from_utf16_lossy(&units)
}

#[cfg(windows)]
pub fn display_names() -> Vec<DisplayName> {
    let Some(paths) = ffi::active_paths() else {
        return Vec::new();
    };

    paths
        .iter()
        .filter_map(|path| {
            let device_name = ffi::source_device_name(&path.sourceInfo)?;
            let model = ffi::target_model(&path.targetInfo)?;

            if model.is_empty() {
                return None;
            }

            Some(DisplayName { device_name, model })
        })
        .collect()
}

#[cfg(not(windows))]
pub fn display_names() -> Vec<DisplayName> {
    Vec::new()
}

#[cfg(windows)]
mod ffi {
    use std::mem::size_of;

    use tracing::warn;
    use windows::Win32::Devices::Display::{
        DisplayConfigGetDeviceInfo, GetDisplayConfigBufferSizes, QueryDisplayConfig,
        DISPLAYCONFIG_DEVICE_INFO_GET_SOURCE_NAME, DISPLAYCONFIG_DEVICE_INFO_GET_TARGET_NAME,
        DISPLAYCONFIG_DEVICE_INFO_HEADER, DISPLAYCONFIG_DEVICE_INFO_TYPE, DISPLAYCONFIG_MODE_INFO,
        DISPLAYCONFIG_PATH_INFO, DISPLAYCONFIG_PATH_SOURCE_INFO, DISPLAYCONFIG_PATH_TARGET_INFO,
        DISPLAYCONFIG_SOURCE_DEVICE_NAME, DISPLAYCONFIG_TARGET_DEVICE_NAME, QDC_ONLY_ACTIVE_PATHS,
    };
    use windows::Win32::Foundation::{ERROR_SUCCESS, LUID};

    use super::wide_to_string;

    /// The paths of the monitors currently lit. A display change between the
    /// two calls makes the second fail; the caller polls, so it is not retried.
    pub fn active_paths() -> Option<Vec<DISPLAYCONFIG_PATH_INFO>> {
        let mut path_count = 0u32;
        let mut mode_count = 0u32;

        // SAFETY: both out-pointers point at live locals.
        let sizes = unsafe {
            GetDisplayConfigBufferSizes(QDC_ONLY_ACTIVE_PATHS, &mut path_count, &mut mode_count)
        };

        if sizes != ERROR_SUCCESS {
            warn!("GetDisplayConfigBufferSizes failed: {:?}", sizes);
            return None;
        }

        let mut paths = vec![DISPLAYCONFIG_PATH_INFO::default(); path_count as usize];
        let mut modes = vec![DISPLAYCONFIG_MODE_INFO::default(); mode_count as usize];

        // SAFETY: each array holds exactly the count passed beside it, and the
        // counts are live locals the call writes back.
        let result = unsafe {
            QueryDisplayConfig(
                QDC_ONLY_ACTIVE_PATHS,
                &mut path_count,
                paths.as_mut_ptr(),
                &mut mode_count,
                modes.as_mut_ptr(),
                None,
            )
        };

        if result != ERROR_SUCCESS {
            warn!("QueryDisplayConfig failed: {:?}", result);
            return None;
        }

        paths.truncate(path_count as usize);

        Some(paths)
    }

    fn header<Packet>(
        kind: DISPLAYCONFIG_DEVICE_INFO_TYPE,
        adapter_id: LUID,
        id: u32,
    ) -> Option<DISPLAYCONFIG_DEVICE_INFO_HEADER> {
        Some(DISPLAYCONFIG_DEVICE_INFO_HEADER {
            r#type: kind,
            size: u32::try_from(size_of::<Packet>()).ok()?,
            adapterId: adapter_id,
            id,
        })
    }

    /// The GDI name of a path's source: `\\.\DISPLAY1`.
    pub fn source_device_name(source: &DISPLAYCONFIG_PATH_SOURCE_INFO) -> Option<String> {
        let mut packet = DISPLAYCONFIG_SOURCE_DEVICE_NAME {
            header: header::<DISPLAYCONFIG_SOURCE_DEVICE_NAME>(
                DISPLAYCONFIG_DEVICE_INFO_GET_SOURCE_NAME,
                source.adapterId,
                source.id,
            )?,
            ..Default::default()
        };

        // SAFETY: the header heads the packet it sits in, and its size field
        // is that packet's size.
        let status = unsafe { DisplayConfigGetDeviceInfo(&mut packet.header) };

        (status == 0).then(|| wide_to_string(&packet.viewGdiDeviceName))
    }

    /// The EDID friendly name of a path's target.
    pub fn target_model(target: &DISPLAYCONFIG_PATH_TARGET_INFO) -> Option<String> {
        let mut packet = DISPLAYCONFIG_TARGET_DEVICE_NAME {
            header: header::<DISPLAYCONFIG_TARGET_DEVICE_NAME>(
                DISPLAYCONFIG_DEVICE_INFO_GET_TARGET_NAME,
                target.adapterId,
                target.id,
            )?,
            ..Default::default()
        };

        // SAFETY: the header heads the packet it sits in, and its size field
        // is that packet's size.
        let status = unsafe { DisplayConfigGetDeviceInfo(&mut packet.header) };

        (status == 0).then(|| wide_to_string(&packet.monitorFriendlyDeviceName))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_wide_string_ends_at_its_first_nul() {
        let mut wide = [0u16; 16];

        for (slot, unit) in wide.iter_mut().zip("DELL U2723".encode_utf16()) {
            *slot = unit;
        }

        assert_eq!(wide_to_string(&wide), "DELL U2723");
    }

    #[test]
    fn an_all_nul_buffer_is_empty() {
        assert_eq!(wide_to_string(&[0u16; 8]), "");
    }
}
