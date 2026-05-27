use super::ContentType;
use once_cell::sync::Lazy;
use url::Url;

static COLOR_RE: Lazy<regex_lite::Regex> = Lazy::new(|| {
    regex_lite::Regex::new(r"^\s*(#[0-9a-fA-F]{3,8}|rgba?\([^)]+\)|hsla?\([^)]+\))\s*$").unwrap()
});

pub fn detect_text(text: &str, source_app: Option<&str>) -> ContentType {
    let trimmed = text.trim();
    if trimmed.is_empty() {
        return ContentType::Text;
    }
    if !trimmed.contains('\n') && std::path::Path::new(trimmed).exists() {
        return ContentType::File;
    }
    if !trimmed.contains(char::is_whitespace)
        && Url::parse(trimmed)
            .map(|u| matches!(u.scheme(), "http" | "https" | "ftp" | "ftps"))
            .unwrap_or(false)
    {
        return ContentType::Link;
    }
    if COLOR_RE.is_match(trimmed) {
        return ContentType::Color;
    }
    let stripped: String = trimmed.chars().filter(|c| !c.is_whitespace()).collect();
    if !stripped.is_empty()
        && stripped
            .chars()
            .all(|c| emojis::get(&c.to_string()).is_some())
    {
        return ContentType::Emoji;
    }
    if let Some(app) = source_app {
        const CODE_APPS: &[&str] = &[
            "code", "code-insiders", "vscode", "Code",
            "jetbrains-idea", "jetbrains-pycharm", "jetbrains-webstorm", "jetbrains-rustrover",
            "gnome-terminal", "kitty", "alacritty", "wezterm",
            "neovim", "nvim", "vim", "sublime_text", "zed",
        ];
        if CODE_APPS.iter().any(|a| app.eq_ignore_ascii_case(a)) {
            return ContentType::Code;
        }
    }
    if trimmed.contains('\n') {
        let code_hints = ["{", "}", ";", "fn ", "def ", "function ", "import ", "class ", "<?", "</"];
        if code_hints.iter().any(|h| trimmed.contains(h)) {
            return ContentType::Code;
        }
    }
    ContentType::Text
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test] fn detects_http_url() { assert_eq!(detect_text("https://example.com", None), ContentType::Link); }
    #[test] fn detects_hex_color() { assert_eq!(detect_text("#1A2B3C", None), ContentType::Color); }
    #[test] fn detects_rgb_color() { assert_eq!(detect_text("rgb(10, 20, 30)", None), ContentType::Color); }
    #[test] fn detects_emoji_only() { assert_eq!(detect_text("🫠", None), ContentType::Emoji); }
    #[test] fn detects_emoji_string() { assert_eq!(detect_text("🚀  ✨", None), ContentType::Emoji); }
    #[test] fn detects_code_by_source_app() { assert_eq!(detect_text("just words", Some("code")), ContentType::Code); }
    #[test] fn detects_code_by_heuristic() { assert_eq!(detect_text("fn main() {\n  println!();\n}", None), ContentType::Code); }
    #[test] fn plain_text_default() { assert_eq!(detect_text("hello world", None), ContentType::Text); }
    #[test] fn url_with_spaces_is_text() { assert_eq!(detect_text("see https://a.b for more", None), ContentType::Text); }
}
