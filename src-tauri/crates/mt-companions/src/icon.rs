//! The executable's own icon, as a PNG data URL.
//!
//! The settings list is a list of programs the user recognises by their icon
//! long before they read the name, so the row shows the real one rather than a
//! generic placeholder. Extraction is done once per path and cached by the
//! frontend — this walks GDI bitmaps and is not something to do at 4 Hz.

#[cfg(windows)]
use windows::core::Owned;
#[cfg(windows)]
use windows::Win32::Graphics::Gdi::{HBITMAP, HDC};

/// No shell icon is larger; anything past this is refused rather than sized.
#[cfg(windows)]
const MAX_ICON_SIDE: u32 = 256;

#[cfg(windows)]
const BYTES_PER_PIXEL: usize = 4;

#[cfg(windows)]
pub fn icon_data_url(path: &str) -> Option<String> {
    use std::os::windows::ffi::OsStrExt;

    use windows::core::PCWSTR;
    use windows::Win32::UI::Shell::{SHGetFileInfoW, SHFILEINFOW, SHGFI_ICON, SHGFI_LARGEICON};
    use windows::Win32::UI::WindowsAndMessaging::{GetIconInfo, ICONINFO};

    let wide: Vec<u16> = std::path::Path::new(path)
        .as_os_str()
        .encode_wide()
        .chain(std::iter::once(0))
        .collect();

    let mut info = SHFILEINFOW::default();

    // SAFETY: `wide` is NUL-terminated and outlives the call; `info` is a local
    // of exactly the size passed.
    let result = unsafe {
        SHGetFileInfoW(
            PCWSTR(wide.as_ptr()),
            Default::default(),
            Some(&mut info),
            std::mem::size_of::<SHFILEINFOW>() as u32,
            SHGFI_ICON | SHGFI_LARGEICON,
        )
    };

    if result == 0 || info.hIcon.is_invalid() {
        return None;
    }

    // SAFETY: `SHGFI_ICON` hands the icon to the caller, who must destroy it;
    // nothing else holds it.
    let icon = unsafe { Owned::new(info.hIcon) };

    let mut icon_info = ICONINFO::default();

    // SAFETY: `icon` is live (owned above); `icon_info` is a local out-parameter.
    unsafe { GetIconInfo(*icon, &mut icon_info) }.ok()?;

    // SAFETY: `GetIconInfo` hands both bitmaps to the caller, who must delete
    // them. A monochrome icon has no colour bitmap; `Free` skips a null one.
    let color = unsafe { Owned::new(icon_info.hbmColor) };
    // SAFETY: as for the colour bitmap above.
    let _mask = unsafe { Owned::new(icon_info.hbmMask) };

    if color.is_invalid() {
        return None;
    }

    let (width, height, rgba) = read_color_bitmap(&color)?;

    encode_png(width, height, &rgba).map(|png| {
        use base64::Engine;

        format!(
            "data:image/png;base64,{}",
            base64::engine::general_purpose::STANDARD.encode(png)
        )
    })
}

/// The screen's device context, released on drop.
#[cfg(windows)]
struct ScreenDc(HDC);

#[cfg(windows)]
impl ScreenDc {
    fn get() -> Option<Self> {
        use windows::Win32::Graphics::Gdi::GetDC;

        // SAFETY: `None` asks for the whole screen's DC; no pointers are passed.
        let device_context = unsafe { GetDC(None) };

        if device_context.is_invalid() {
            return None;
        }

        Some(Self(device_context))
    }
}

#[cfg(windows)]
impl Drop for ScreenDc {
    fn drop(&mut self) {
        use windows::Win32::Graphics::Gdi::ReleaseDC;

        // SAFETY: `self.0` came from `GetDC(None)` and is released once, here.
        unsafe { ReleaseDC(None, self.0) };
    }
}

/// The bitmap's pixels as top-down RGBA. Borrowing the guard keeps the bitmap
/// alive for every GDI call on it.
#[cfg(windows)]
fn read_color_bitmap(bitmap: &Owned<HBITMAP>) -> Option<(u32, u32, Vec<u8>)> {
    use windows::Win32::Graphics::Gdi::{
        GetDIBits, GetObjectW, BITMAP, BITMAPINFO, BITMAPINFOHEADER, BI_RGB, DIB_RGB_COLORS,
        HGDIOBJ,
    };

    let mut description = BITMAP::default();

    // SAFETY: the bitmap is live (borrowed from its guard); `description` is a
    // local of exactly the size passed.
    let read = unsafe {
        GetObjectW(
            HGDIOBJ(bitmap.0),
            std::mem::size_of::<BITMAP>() as i32,
            Some(&mut description as *mut BITMAP as *mut std::ffi::c_void),
        )
    };

    if read == 0 || description.bmWidth <= 0 || description.bmHeight <= 0 {
        return None;
    }

    let width = description.bmWidth as u32;
    let height = description.bmHeight as u32;

    if width > MAX_ICON_SIDE || height > MAX_ICON_SIDE {
        return None;
    }

    let byte_count = (width as usize)
        .checked_mul(height as usize)?
        .checked_mul(BYTES_PER_PIXEL)?;

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

    let mut buffer = vec![0u8; byte_count];
    let screen = ScreenDc::get()?;

    // SAFETY: `buffer` holds `height` rows of `width` 32-bit pixels — exactly
    // what `header` asks for — and the DC and the bitmap are live guards.
    let copied = unsafe {
        GetDIBits(
            screen.0,
            **bitmap,
            0,
            height,
            Some(buffer.as_mut_ptr() as *mut std::ffi::c_void),
            &mut header,
            DIB_RGB_COLORS,
        )
    };

    if copied == 0 {
        return None;
    }

    let alpha_missing = buffer.as_chunks::<4>().0.iter().all(|pixel| pixel[3] == 0);

    for pixel in buffer.as_chunks_mut::<4>().0 {
        pixel.swap(0, 2);

        // A 24-bit icon carries no alpha channel at all, and the buffer
        // comes back fully transparent rather than fully opaque.
        if alpha_missing {
            pixel[3] = 255;
        }
    }

    Some((width, height, buffer))
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
