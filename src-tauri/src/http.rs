use crate::models::{BodySpec, HeaderPair, RequestError, RequestSpec, ResponseData};
use base64::Engine;
use encoding_rs::Encoding;
use futures_util::StreamExt;
use reqwest::cookie::Jar;
use reqwest::header::{HeaderName, HeaderValue, CONTENT_TYPE};
use reqwest::{redirect, ClientBuilder, Method, Proxy};
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::oneshot;
use url::Url;

const MAX_BODY_BYTES: usize = 5 * 1024 * 1024;

pub async fn execute(
    spec: RequestSpec,
    jar: Arc<Jar>,
    mut cancel: oneshot::Receiver<()>,
) -> Result<ResponseData, RequestError> {
    let mut url = Url::parse(spec.url.trim())
        .map_err(|error| RequestError::new("invalid_url", format!("Invalid URL: {error}")))?;
    {
        let mut query = url.query_pairs_mut();
        for param in spec.params.iter().filter(|param| param.enabled && !param.key.is_empty()) {
            query.append_pair(&param.key, &param.value);
        }
    }

    let mut builder = ClientBuilder::new()
        .cookie_provider(jar)
        .timeout(Duration::from_millis(spec.timeout_ms.max(1)))
        .danger_accept_invalid_certs(!spec.verify_tls);
    builder = if spec.follow_redirects {
        builder.redirect(redirect::Policy::limited(10))
    } else {
        builder.redirect(redirect::Policy::none())
    };
    if let Some(proxy) = spec.proxy.as_deref().map(str::trim).filter(|value| !value.is_empty()) {
        let proxy = Proxy::all(proxy)
            .map_err(|error| RequestError::new("other", format!("Invalid proxy: {error}")))?;
        builder = builder.no_proxy().proxy(proxy);
    }
    let client = builder
        .build()
        .map_err(|error| RequestError::new("other", error.to_string()))?;

    let method = Method::from_bytes(spec.method.to_uppercase().as_bytes())
        .map_err(|_| RequestError::new("other", format!("Invalid method: {}", spec.method)))?;

    let mut header_pairs: Vec<(HeaderName, HeaderValue)> = Vec::new();
    for header in spec.headers.iter().filter(|header| header.enabled && !header.key.is_empty()) {
        let name = HeaderName::from_bytes(header.key.trim().as_bytes()).map_err(|_| {
            RequestError::new("other", format!("Invalid header name: {}", header.key))
        })?;
        let value = HeaderValue::from_str(&header.value).map_err(|_| {
            RequestError::new(
                "other",
                format!("Invalid value for header {}: control characters are not allowed", header.key),
            )
        })?;
        header_pairs.push((name, value));
    }
    let has_content_type = header_pairs.iter().any(|(name, _)| *name == CONTENT_TYPE);

    let body = spec.body.unwrap_or(BodySpec {
        mode: "none".into(),
        content: String::new(),
        fields: Vec::new(),
    });
    let mut request = client.request(method, url);
    if !has_content_type {
        match body.mode.as_str() {
            "json" => {
                request = request.header(CONTENT_TYPE, "application/json");
            }
            "text" => {
                request = request.header(CONTENT_TYPE, "text/plain; charset=utf-8");
            }
            _ => {}
        }
    }
    match body.mode.as_str() {
        "json" | "text" => {
            request = request.body(body.content.clone());
        }
        "form" => {
            let fields: Vec<(String, String)> = body
                .fields
                .iter()
                .filter(|field| field.enabled && !field.key.is_empty())
                .map(|field| (field.key.clone(), field.value.clone()))
                .collect();
            request = request.form(&fields);
        }
        _ => {}
    }
    for (name, value) in header_pairs {
        request = request.header(name, value);
    }

    let start = Instant::now();
    let send = request.send();
    tokio::pin!(send);
    let response = tokio::select! {
        _ = &mut cancel => {
            return Err(RequestError::new("cancelled", "The request was cancelled."));
        }
        result = &mut send => {
            result.map_err(map_reqwest_error)?
        }
    };
    let ttfb_ms = start.elapsed().as_millis() as u64;

    let status = response.status();
    let status_text = status.canonical_reason().unwrap_or("").to_string();
    let http_version = format!("{:?}", response.version());
    let final_url = response.url().to_string();
    let headers: Vec<HeaderPair> = response
        .headers()
        .iter()
        .map(|(name, value)| HeaderPair {
            name: name.to_string(),
            value: value.to_str().unwrap_or("<binary>").to_string(),
        })
        .collect();
    let content_type = response
        .headers()
        .get(CONTENT_TYPE)
        .and_then(|value| value.to_str().ok())
        .map(str::to_string);

    let mut body_bytes: Vec<u8> = Vec::new();
    let mut truncated = false;
    let mut stream = response.bytes_stream();
    loop {
        let next = tokio::select! {
            _ = &mut cancel => {
                return Err(RequestError::new("cancelled", "The request was cancelled."));
            }
            chunk = stream.next() => chunk
        };
        let Some(chunk) = next else { break };
        let chunk = chunk.map_err(|error| {
            RequestError::new(
                if error.is_timeout() { "timeout" } else { "other" },
                format!("Could not read the response body: {error}"),
            )
        })?;
        if body_bytes.len() + chunk.len() > MAX_BODY_BYTES {
            let remaining = MAX_BODY_BYTES - body_bytes.len();
            body_bytes.extend_from_slice(&chunk[..remaining]);
            truncated = true;
            break;
        }
        body_bytes.extend_from_slice(&chunk);
    }

    let total_ms = start.elapsed().as_millis() as u64;
    let size_bytes = body_bytes.len() as u64;
    let mime = content_type
        .as_deref()
        .map(|value| value.split(';').next().unwrap_or("").trim().to_ascii_lowercase())
        .unwrap_or_default();
    let binary = mime.starts_with("image/")
        || mime.starts_with("audio/")
        || mime.starts_with("video/")
        || mime.starts_with("font/")
        || matches!(
            mime.as_str(),
            "application/octet-stream"
                | "application/pdf"
                | "application/zip"
                | "application/gzip"
                | "application/x-protobuf"
                | "application/wasm"
        );
    let (body_text, body_base64) = if binary {
        (
            None,
            Some(base64::engine::general_purpose::STANDARD.encode(&body_bytes)),
        )
    } else {
        (Some(decode_text(&body_bytes, content_type.as_deref())), None)
    };

    Ok(ResponseData {
        status: status.as_u16(),
        status_text,
        http_version,
        final_url,
        content_type,
        headers,
        body_text,
        body_base64,
        size_bytes,
        truncated,
        ttfb_ms,
        total_ms,
    })
}

fn decode_text(bytes: &[u8], content_type: Option<&str>) -> String {
    let charset = content_type
        .and_then(|value| {
            value.split(';').find_map(|part| {
                let part = part.trim();
                part.strip_prefix("charset=")
                    .map(|label| label.trim_matches('"').trim().to_string())
            })
        });
    if let Some(label) = charset {
        if let Some(encoding) = Encoding::for_label(label.as_bytes()) {
            let (text, _, _) = encoding.decode(bytes);
            return text.into_owned();
        }
    }
    String::from_utf8_lossy(bytes).into_owned()
}

fn map_reqwest_error(error: reqwest::Error) -> RequestError {
    use std::error::Error as _;
    let mut message = error.to_string();
    let mut source = error.source();
    while let Some(next) = source {
        message.push_str(": ");
        message.push_str(&next.to_string());
        source = next.source();
    }
    let lower = message.to_ascii_lowercase();
    let kind = if error.is_timeout() {
        "timeout"
    } else if error.is_connect() && (lower.contains("certificate") || lower.contains("tls") || lower.contains("ssl")) {
        "tls"
    } else if error.is_connect()
        && (lower.contains("dns")
            || lower.contains("resolve")
            || lower.contains("lookup")
            || lower.contains("name or service"))
    {
        "dns"
    } else if error.is_connect() {
        "connect"
    } else if error.is_builder() || lower.contains("invalid url") {
        "invalid_url"
    } else {
        "other"
    };
    RequestError::new(kind, message)
}
