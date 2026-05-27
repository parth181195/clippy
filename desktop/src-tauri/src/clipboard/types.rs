use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ContentType {
    Text,
    Link,
    Code,
    Color,
    Emoji,
    File,
    Image,
}

impl ContentType {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Text => "text",
            Self::Link => "link",
            Self::Code => "code",
            Self::Color => "color",
            Self::Emoji => "emoji",
            Self::File => "file",
            Self::Image => "image",
        }
    }
    pub fn is_text_shaped(&self) -> bool {
        matches!(
            self,
            Self::Text | Self::Link | Self::Code | Self::Color | Self::Emoji
        )
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Clip {
    pub id: i64,
    pub content_type: ContentType,
    pub content: Vec<u8>,
    pub mime: String,
    pub content_hash: String,
    pub preview: String,
    pub source_app: Option<String>,
    pub is_favorite: bool,
    pub is_pinned: bool,
    pub created_at: i64,
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn text_shaped_excludes_image_and_file() {
        assert!(ContentType::Text.is_text_shaped());
        assert!(ContentType::Link.is_text_shaped());
        assert!(ContentType::Code.is_text_shaped());
        assert!(ContentType::Color.is_text_shaped());
        assert!(ContentType::Emoji.is_text_shaped());
        assert!(!ContentType::Image.is_text_shaped());
        assert!(!ContentType::File.is_text_shaped());
    }
    #[test]
    fn serializes_lowercase() {
        let s = serde_json::to_string(&ContentType::Link).unwrap();
        assert_eq!(s, "\"link\"");
    }
}
