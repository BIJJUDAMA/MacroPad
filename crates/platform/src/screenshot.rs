use image::RgbaImage;
use screenshots::Screen;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum ScreenshotError {
    #[error("no screen found")]
    NoScreen,
    #[error("capture failed: {0}")]
    CaptureFailed(String),
    #[error("coordinates out of bounds: ({0}, {1})")]
    OutOfBounds(i32, i32),
    #[error("image load failed: {0}")]
    ImageLoad(String),
}

#[derive(Debug, Clone)]
pub struct Rgba {
    pub r: u8,
    pub g: u8,
    pub b: u8,
    pub a: u8,
}

impl Rgba {
    pub fn from_hex(hex: &str) -> Option<Self> {
        let hex = hex.trim_start_matches('#');
        if hex.len() != 6 {
            return None;
        }
        let r = u8::from_str_radix(&hex[0..2], 16).ok()?;
        let g = u8::from_str_radix(&hex[2..4], 16).ok()?;
        let b = u8::from_str_radix(&hex[4..6], 16).ok()?;
        Some(Self { r, g, b, a: 255 })
    }

    pub fn distance(&self, other: &Rgba) -> u32 {
        let dr = (self.r as i32 - other.r as i32).abs() as u32;
        let dg = (self.g as i32 - other.g as i32).abs() as u32;
        let db = (self.b as i32 - other.b as i32).abs() as u32;
        dr + dg + db
    }
}

pub struct PixelChecker;

impl PixelChecker {
    pub fn check_pixel(
        x: i32,
        y: i32,
        expected: &Rgba,
        tolerance: u32,
    ) -> Result<bool, ScreenshotError> {
        let actual = Self::get_pixel(x, y)?;
        Ok(actual.distance(expected) <= tolerance)
    }

    pub fn get_pixel(x: i32, y: i32) -> Result<Rgba, ScreenshotError> {
        let screens = Screen::all().map_err(|e| ScreenshotError::CaptureFailed(e.to_string()))?;

        let screen = screens.first().ok_or(ScreenshotError::NoScreen)?;
        let info = screen.display_info;

        if x < info.x
            || y < info.y
            || x >= info.x + info.width as i32
            || y >= info.y + info.height as i32
        {
            return Err(ScreenshotError::OutOfBounds(x, y));
        }

        let image = screen
            .capture()
            .map_err(|e| ScreenshotError::CaptureFailed(e.to_string()))?;

        let px = (x - info.x) as u32;
        let py = (y - info.y) as u32;

        let rgba_image =
            image::RgbaImage::from_raw(image.width(), image.height(), image.as_raw().to_vec())
                .ok_or_else(|| ScreenshotError::CaptureFailed("buffer size mismatch".into()))?;

        let pixel = rgba_image.get_pixel(px, py);
        Ok(Rgba {
            r: pixel[0],
            g: pixel[1],
            b: pixel[2],
            a: pixel[3],
        })
    }

    pub fn capture_region(
        x: i32,
        y: i32,
        width: u32,
        height: u32,
    ) -> Result<RgbaImage, ScreenshotError> {
        let screens = Screen::all().map_err(|e| ScreenshotError::CaptureFailed(e.to_string()))?;

        let screen = screens.first().ok_or(ScreenshotError::NoScreen)?;

        let image = screen
            .capture_area(x, y, width, height)
            .map_err(|e| ScreenshotError::CaptureFailed(e.to_string()))?;

        let rgba =
            image::RgbaImage::from_raw(image.width(), image.height(), image.as_raw().to_vec())
                .ok_or_else(|| ScreenshotError::CaptureFailed("buffer size mismatch".into()))?;

        Ok(rgba)
    }

    pub fn image_match(
        x: i32,
        y: i32,
        width: u32,
        height: u32,
        template_path: &str,
        tolerance: u32,
    ) -> Result<bool, ScreenshotError> {
        let region = Self::capture_region(x, y, width, height)?;

        let template = image::open(template_path)
            .map_err(|e| ScreenshotError::ImageLoad(e.to_string()))?
            .to_rgba8();

        if region.width() != template.width() || region.height() != template.height() {
            return Ok(false);
        }

        let total_diff: u32 = region
            .pixels()
            .zip(template.pixels())
            .map(|(a, b)| {
                let ra = Rgba {
                    r: a[0],
                    g: a[1],
                    b: a[2],
                    a: a[3],
                };
                let rb = Rgba {
                    r: b[0],
                    g: b[1],
                    b: b[2],
                    a: b[3],
                };
                ra.distance(&rb)
            })
            .sum();

        let pixel_count = region.width() * region.height();
        let avg_diff = total_diff / pixel_count.max(1);

        Ok(avg_diff <= tolerance)
    }
}
