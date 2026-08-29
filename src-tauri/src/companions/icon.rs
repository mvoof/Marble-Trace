//! The executable's own icon, as a PNG data URL.
//!
//! The settings list is a list of programs the user recognises by their icon
//! long before they read the name, so the row shows the real one rather than a
//! generic placeholder. Extraction is done once per path and cached by the
//! frontend — this walks GDI bitmaps and is not something to do at 4 Hz.

#[cfg(windows)]
pub fn icon_data_url(path: &str) -> Option<String> {
    use std::os::windows::ffi::OsStrExt;

    use windows::core::PCWSTR;
    use windows::Win32::Graphics::Gdi::{DeleteObject, HGDIOBJ};
    use windows::Win32::UI::Shell::{SHGetFileInfoW, SHFILEINFOW, SHGFI_ICON, SHGFI_LARGEICON};
    use windows::Win32::UI::WindowsAndMessaging::{DestroyIcon, GetIconInfo, ICONINFO};

    let wide: Vec<u16> = std::path::Path::new(path)
        .as_os_str()
        .encode_wide()
        .chain(std::iter::once(0))
        .collect();

    // SAFETY: every handle taken here is released on the way out, and the
    // pixel buffer handed to `GetDIBits` is sized from the header it is given.
    unsafe {
        let mut info = SHFILEINFOW::default();

        let result = SHGetFileInfoW(
            PCWSTR(wide.as_ptr()),
            Default::default(),
            Some(&mut info),
            std::mem::size_of::<SHFILEINFOW>() as u32,
            SHGFI_ICON | SHGFI_LARGEICON,
        );

        if result == 0 || info.hIcon.is_invalid() {
            return None;
        }

        let mut icon_info = ICONINFO::default();
        let extracted = GetIconInfo(info.hIcon, &mut icon_info).is_ok();

        let pixels = if extracted {
            read_color_bitmap(icon_info.hbmColor)
        } else {
            None
        };

        if extracted {
            let _ = DeleteObject(HGDIOBJ(icon_info.hbmColor.0));
            let _ = DeleteObject(HGDIOBJ(icon_info.hbmMask.0));
        }

        let _ = DestroyIcon(info.hIcon);

        let (width, height, rgba) = pixels?;

        return encode_png(width, height, &rgba).map(|png| {
            use base64::Engine;

            format!(
                "data:image/png;base64,{}",
                base64::engine::general_purpose::STANDARD.encode(png)
            )
        });
    }

    // Nested so the unsafe GDI reading stays next to its only caller.
    #[allow(unsafe_op_in_unsafe_fn)]
    unsafe fn read_color_bitmap(
        bitmap: windows::Win32::Graphics::Gdi::HBITMAP,
    ) -> Option<(u32, u32, Vec<u8>)> {
        use windows::Win32::Graphics::Gdi::{
            GetDC, GetDIBits, GetObjectW, ReleaseDC, BITMAP, BITMAPINFO, BITMAPINFOHEADER, BI_RGB,
            DIB_RGB_COLORS,
        };

        let mut description = BITMAP::default();

        let read = GetObjectW(
            windows::Win32::Graphics::Gdi::HGDIOBJ(bitmap.0),
            std::mem::size_of::<BITMAP>() as i32,
            Some(&mut description as *mut BITMAP as *mut std::ffi::c_void),
        );

        if read == 0 || description.bmWidth <= 0 || description.bmHeight <= 0 {
            return None;
        }

        let width = description.bmWidth as u32;
        let height = description.bmHeight as u32;

        let mut header = BITMAPINFO {
            bmiHeader: BITMAPINFOHEADER {
                biSize: std::mem::size_of::<BITMAPINFOHEADER>() as u32,
                biWidth: description.bmWidth,
                // Negative height asks for a top-down buffer, so the rows come out
                // in the order PNG wants them.
                biHeight: -description.bmHeight,
                biPlanes: 1,
                biBitCount: 32,
                biCompression: BI_RGB.0,
                ..Default::default()
            },
            ..Default::default()
        };

        let mut buffer = vec![0u8; (width * height * 4) as usize];

        let device_context = GetDC(None);

        let copied = GetDIBits(
            device_context,
            bitmap,
            0,
            height,
            Some(buffer.as_mut_ptr() as *mut std::ffi::c_void),
            &mut header,
            DIB_RGB_COLORS,
        );

        ReleaseDC(None, device_context);

        if copied == 0 {
            return None;
        }

        let opaque = buffer.chunks_exact(4).all(|pixel| pixel[3] == 0);

        for pixel in buffer.chunks_exact_mut(4) {
            pixel.swap(0, 2);

            // A 24-bit icon carries no alpha channel at all, and the buffer
            // comes back fully transparent rather than fully opaque.
            if opaque {
                pixel[3] = 255;
            }
        }

        Some((width, height, buffer))
    }
}

#[cfg(windows)]
fn encode_png(width: u32, height: u32, rgba: &[u8]) -> Option<Vec<u8>> {
    let mut out = Vec::new();

    {
        let mut encoder = png::Encoder::new(&mut out, width, height);

        encoder.set_color(png::ColorType::Rgba);
        encoder.set_depth(png::BitDepth::Eight);

        let mut writer = encoder.write_header().ok()?;

        writer.write_image_data(rgba).ok()?;
    }

    Some(out)
}

#[cfg(not(windows))]
pub fn icon_data_url(_path: &str) -> Option<String> {
    None
}
