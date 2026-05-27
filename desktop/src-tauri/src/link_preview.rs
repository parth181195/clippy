use crate::db::{Db, DbError};
use rusqlite::params;
use scraper::{Html, Selector};
use std::net::IpAddr;
use std::time::Duration;
use thiserror::Error;
use url::Url;

#[derive(Debug, Error)]
pub enum FetchError {
    #[error(transparent)]
    Network(#[from] reqwest::Error),
    #[error(transparent)]
    Url(#[from] url::ParseError),
    #[error(transparent)]
    Db(#[from] DbError),
}

#[derive(Debug)]
pub struct PreviewRow {
    pub title: Option<String>,
    pub description: Option<String>,
    pub og_image: Option<Vec<u8>>,
    pub favicon: Option<Vec<u8>>,
    pub status: String,
}

pub async fn fetch_and_cache(db: &Db, clip_id: i64, url_str: &str) -> Result<PreviewRow, FetchError> {
    let url = Url::parse(url_str)?;
    if let Some(host) = url.host_str() {
        if host.eq_ignore_ascii_case("localhost") {
            return Ok(reject(db, clip_id, "blocked").await?);
        }
        if let Ok(ip) = host.parse::<IpAddr>() {
            if is_private_or_loopback(&ip) {
                return Ok(reject(db, clip_id, "blocked").await?);
            }
        }
    }
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(3))
        .user_agent("ClippyPreviewBot/0.1")
        .build()?;
    let body = match tokio::time::timeout(Duration::from_secs(3), client.get(url.clone()).send()).await {
        Err(_) => return Ok(reject(db, clip_id, "timeout").await?),
        Ok(Err(e)) => return Err(e.into()),
        Ok(Ok(r)) => r.text().await.unwrap_or_default(),
    };
    let title;
    let description;
    let og_image_url;
    {
        let doc = Html::parse_document(&body);
        let title_sel = Selector::parse("title").unwrap();
        let og_image_sel = Selector::parse(r#"meta[property="og:image"]"#).unwrap();
        let desc_sel = Selector::parse(r#"meta[name="description"]"#).unwrap();
        title = doc.select(&title_sel).next().map(|n| n.text().collect::<String>());
        description = doc
            .select(&desc_sel)
            .next()
            .and_then(|n| n.value().attr("content").map(|s| s.to_string()));
        og_image_url = doc
            .select(&og_image_sel)
            .next()
            .and_then(|n| n.value().attr("content").map(|s| s.to_string()));
    }
    let og_image = match og_image_url.and_then(|s| url.join(&s).ok()) {
        Some(u) => match client.get(u).send().await {
            Ok(r) => r.bytes().await.ok().map(|b| b.to_vec()),
            Err(_) => None,
        },
        None => None,
    };
    let favicon = match url.join("/favicon.ico").ok() {
        Some(u) => match client.get(u).send().await {
            Ok(r) => r.bytes().await.ok().map(|b| b.to_vec()),
            Err(_) => None,
        },
        None => None,
    };
    let row = PreviewRow {
        title,
        description,
        og_image,
        favicon,
        status: "ok".into(),
    };
    persist(db, clip_id, &row)?;
    Ok(row)
}

async fn reject(db: &Db, clip_id: i64, status: &str) -> Result<PreviewRow, DbError> {
    let status = status.to_string();
    db.conn().execute(
        "INSERT OR REPLACE INTO link_previews(clip_id, fetched_at, status) VALUES (?1, ?2, ?3)",
        params![clip_id, ms_now(), &status],
    )?;
    Ok(PreviewRow {
        title: None,
        description: None,
        og_image: None,
        favicon: None,
        status,
    })
}

fn persist(db: &Db, clip_id: i64, row: &PreviewRow) -> Result<(), DbError> {
    db.conn().execute(
        "INSERT OR REPLACE INTO link_previews(clip_id, title, description, favicon_png, og_image, fetched_at, status)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        params![clip_id, row.title, row.description, row.favicon, row.og_image, ms_now(), row.status],
    )?;
    Ok(())
}

fn ms_now() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_millis() as i64
}

fn is_private_or_loopback(ip: &IpAddr) -> bool {
    match ip {
        IpAddr::V4(v4) => v4.is_loopback() || v4.is_private() || v4.is_link_local(),
        IpAddr::V6(v6) => v6.is_loopback() || v6.is_unique_local() || v6.is_unicast_link_local(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::params;
    fn seed_link(db: &Db) {
        db.conn()
            .execute(
                "INSERT INTO clips(content_type, content, mime, content_hash, preview, created_at)
                 VALUES ('link', X'00', 'text/plain', 'h', 'p', 1)",
                params![],
            )
            .unwrap();
    }
    #[tokio::test]
    async fn rejects_localhost() {
        let db = Db::open_in_memory().unwrap();
        seed_link(&db);
        let r = fetch_and_cache(&db, 1, "http://localhost:1/x").await.unwrap();
        assert_eq!(r.status, "blocked");
    }
    #[tokio::test]
    async fn rejects_private_ip() {
        let db = Db::open_in_memory().unwrap();
        seed_link(&db);
        let r = fetch_and_cache(&db, 1, "http://192.168.1.1/").await.unwrap();
        assert_eq!(r.status, "blocked");
    }
}
