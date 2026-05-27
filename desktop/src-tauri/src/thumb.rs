use image::{imageops::FilterType, ImageReader};
use std::io::Cursor;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum ThumbError {
    #[error(transparent)]
    Image(#[from] image::ImageError),
    #[error(transparent)]
    Io(#[from] std::io::Error),
}

/// Decode any supported image and re-encode as max-200x200 PNG.
pub fn make_thumbnail(bytes: &[u8]) -> Result<Vec<u8>, ThumbError> {
    let img = ImageReader::new(Cursor::new(bytes)).with_guessed_format()?.decode()?;
    let thumb = img.resize(200, 200, FilterType::Triangle);
    let mut out = Vec::with_capacity(8192);
    thumb.write_to(&mut Cursor::new(&mut out), image::ImageFormat::Png)?;
    Ok(out)
}

#[cfg(test)]
mod tests {
    use super::*;
    fn fake_png() -> Vec<u8> {
        let img = image::RgbaImage::from_pixel(4, 4, image::Rgba([255, 0, 0, 255]));
        let mut bytes = Vec::new();
        img.write_to(&mut std::io::Cursor::new(&mut bytes), image::ImageFormat::Png)
            .unwrap();
        bytes
    }
    #[test]
    fn produces_non_empty_png() {
        let t = make_thumbnail(&fake_png()).unwrap();
        assert!(t.len() > 50);
        assert_eq!(&t[0..8], &[0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
    }
}
