use arboard::Clipboard;
use enigo::{Direction, Enigo, Key, Keyboard, Settings};
use std::time::Duration;

/// Set the system clipboard to the given content and synthesise Ctrl+V
/// (or Ctrl+Shift+V if `shift_for_terminal` is true).
pub fn paste_to_active(content: &[u8], mime: &str, shift_for_terminal: bool) -> Result<(), String> {
    let mut cb = Clipboard::new().map_err(|e| e.to_string())?;
    if mime.starts_with("text/") {
        let s = std::str::from_utf8(content).map_err(|e| e.to_string())?;
        cb.set_text(s.to_string()).map_err(|e| e.to_string())?;
    } else if mime.starts_with("image/") {
        let img = image::load_from_memory(content).map_err(|e| e.to_string())?.to_rgba8();
        cb.set_image(arboard::ImageData {
            width: img.width() as usize,
            height: img.height() as usize,
            bytes: img.into_raw().into(),
        })
        .map_err(|e| e.to_string())?;
    }
    // Give the target app a beat to notice the new clipboard owner.
    std::thread::sleep(Duration::from_millis(60));

    let mut enigo = Enigo::new(&Settings::default()).map_err(|e| e.to_string())?;
    enigo.key(Key::Control, Direction::Press).map_err(|e| e.to_string())?;
    if shift_for_terminal {
        enigo.key(Key::Shift, Direction::Press).map_err(|e| e.to_string())?;
    }
    enigo.key(Key::Unicode('v'), Direction::Click).map_err(|e| e.to_string())?;
    if shift_for_terminal {
        enigo.key(Key::Shift, Direction::Release).map_err(|e| e.to_string())?;
    }
    enigo.key(Key::Control, Direction::Release).map_err(|e| e.to_string())?;
    Ok(())
}
