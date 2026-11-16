use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KeyValue {
    #[serde(default = "enabled_default")]
    pub enabled: bool,
    #[serde(default)]
    pub key: String,
    #[serde(default)]
    pub value: String,
}

fn enabled_default() -> bool {
    true
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BodySpec {
    #[serde(default)]
    pub mode: String,
    #[serde(default)]
    pub content: String,
    #[serde(default)]
    pub fields: Vec<KeyValue>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RequestSpec {
    pub id: String,
    #[serde(default = "method_default")]
    pub method: String,
    #[serde(default)]
    pub url: String,
    #[serde(default)]
    pub params: Vec<KeyValue>,
    #[serde(default)]
    pub headers: Vec<KeyValue>,
    #[serde(default)]
    pub body: Option<BodySpec>,
    #[serde(default = "timeout_default")]
    pub timeout_ms: u64,
    #[serde(default)]
    pub follow_redirects: bool,
    #[serde(default)]
    pub verify_tls: bool,
    #[serde(default)]
    pub proxy: Option<String>,
}

fn method_default() -> String {
    "GET".into()
}

fn timeout_default() -> u64 {
    30_000
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HeaderPair {
    pub name: String,
    pub value: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ResponseData {
    pub status: u16,
    pub status_text: String,
    pub http_version: String,
    pub final_url: String,
    pub content_type: Option<String>,
    pub headers: Vec<HeaderPair>,
    pub body_text: Option<String>,
    pub body_base64: Option<String>,
    pub size_bytes: u64,
    pub truncated: bool,
    pub ttfb_ms: u64,
    pub total_ms: u64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RequestError {
    pub kind: String,
    pub message: String,
}

impl RequestError {
    pub fn new(kind: &str, message: impl Into<String>) -> Self {
        Self {
            kind: kind.into(),
            message: message.into(),
        }
    }
}
