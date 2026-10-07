//! Content Security Policy for everything the remote server answers with HTML.
//!
//! The app windows take theirs from `tauri.conf.json`; a browser on the LAN
//! never sees that file, so the server sends its own header. Two policies:
//!
//! - the **remote page** (`remote.html` and any other bundle HTML) — the widget
//!   bundle, its fonts, the chat images a stream screen draws, and the socket
//!   back to this server. Nothing inline: the build ships no inline script and,
//!   unlike the main window, no CSS-in-JS (Ant Design never reaches this entry).
//! - the **server's own pages** (`pages.rs`) — one inline stylesheet and a GET
//!   form, nothing else at all.
//!
//! In development the page is Vite's, proxied: React Refresh's preamble is an
//! inline script (`@vitejs/plugin-react`), styles arrive as `<style>` tags, and
//! the HMR client opens a socket of its own. Those three are allowed in a debug
//! build only.
use axum::extract::Request;
use axum::http::{header, HeaderValue};
use axum::middleware::Next;
use axum::response::Response;

use crate::chat::CHAT_IMAGE_SOURCES;

/// The server's own pages: an inline `<style>`, a GET form back to this server.
pub const SERVER_PAGE_POLICY: &str =
    "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'";

/// The policy for the bundle's HTML, served to a browser that reached this
/// server as `host` (the request's `Host` header).
///
/// `'self'` already covers a same-origin `ws://` in every current browser; the
/// socket is spelled out as well because older WebKit — a tablet that stopped
/// getting updates — does not treat the scheme change as same-origin.
pub fn remote_page_policy(host: Option<&str>, dev: bool) -> String {
    let script = if dev {
        "'self' 'unsafe-inline'"
    } else {
        "'self'"
    };
    let style = if dev {
        "'self' 'unsafe-inline'"
    } else {
        "'self'"
    };

    let mut connect = String::from("'self'");

    if let Some(host) = host.filter(|value| is_plain_host(value)) {
        connect.push_str(&format!(" ws://{host}"));
    }

    if dev {
        // Vite's HMR socket, on its own port of whichever host served the page.
        connect.push_str(" ws:");
    }

    format!(
        "default-src 'self'; script-src {script}; style-src {style}; \
img-src 'self' data: {images}; font-src 'self'; connect-src {connect}; \
object-src 'none'; base-uri 'self'; form-action 'none'",
        images = CHAT_IMAGE_SOURCES.join(" ")
    )
}

/// A `Host` header is the client's to write. Only a hostname or address with an
/// optional port goes into the policy — anything else could add a directive.
fn is_plain_host(value: &str) -> bool {
    !value.is_empty()
        && value.chars().all(|character| {
            character.is_ascii_alphanumeric() || matches!(character, '.' | '-' | ':' | '[' | ']')
        })
}

/// Adds the remote page's policy to every HTML response that does not carry
/// one already — the bundle's entry and the fallback alike, so no HTML leaves
/// this server without a policy.
pub async fn apply(request: Request, next: Next) -> Response {
    let host = request
        .headers()
        .get(header::HOST)
        .and_then(|value| value.to_str().ok())
        .map(str::to_string);

    let mut response = next.run(request).await;
    let headers = response.headers_mut();

    let is_html = headers
        .get(header::CONTENT_TYPE)
        .and_then(|value| value.to_str().ok())
        .is_some_and(|value| value.starts_with("text/html"));

    if is_html && !headers.contains_key(header::CONTENT_SECURITY_POLICY) {
        let policy = remote_page_policy(host.as_deref(), cfg!(debug_assertions));

        if let Ok(value) = HeaderValue::from_str(&policy) {
            headers.insert(header::CONTENT_SECURITY_POLICY, value);
        }
    }

    response
}

#[cfg(test)]
mod tests {
    use super::*;

    const TAURI_CONF: &str = include_str!("../../tauri.conf.json");

    fn directive<'a>(policy: &'a str, name: &str) -> Vec<&'a str> {
        policy
            .split(';')
            .map(str::trim)
            .find_map(|part| part.strip_prefix(name)?.strip_prefix(' '))
            .map(|sources| sources.split_whitespace().collect())
            .unwrap_or_default()
    }

    fn conf_policy(key: &str) -> String {
        let conf: serde_json::Value = serde_json::from_str(TAURI_CONF).expect("tauri.conf.json");

        let directives = conf["app"]["security"][key]
            .as_object()
            .unwrap_or_else(|| panic!("app.security.{key} is not a directive map"));

        directives
            .iter()
            .map(|(name, sources)| {
                let sources = match sources {
                    serde_json::Value::Array(list) => list
                        .iter()
                        .filter_map(serde_json::Value::as_str)
                        .collect::<Vec<_>>()
                        .join(" "),
                    other => other.as_str().unwrap_or_default().to_string(),
                };

                format!("{name} {sources}")
            })
            .collect::<Vec<_>>()
            .join("; ")
    }

    #[test]
    fn release_page_runs_no_inline_script_or_eval() {
        let policy = remote_page_policy(Some("192.168.1.5:8787"), false);
        let script = directive(&policy, "script-src");

        assert_eq!(script, vec!["'self'"]);
        assert!(!policy.contains("unsafe-eval"));
        assert!(!policy.contains("unsafe-inline"));
    }

    #[test]
    fn release_page_connects_back_to_the_host_it_was_served_from() {
        let policy = remote_page_policy(Some("192.168.1.5:8787"), false);

        assert_eq!(
            directive(&policy, "connect-src"),
            vec!["'self'", "ws://192.168.1.5:8787"]
        );
    }

    #[test]
    fn a_crafted_host_cannot_add_a_directive() {
        let policy = remote_page_policy(Some("evil; script-src *"), false);

        assert_eq!(directive(&policy, "connect-src"), vec!["'self'"]);
        assert_eq!(directive(&policy, "script-src"), vec!["'self'"]);
    }

    #[test]
    fn remote_page_allows_every_chat_image_host() {
        let policy = remote_page_policy(None, false);
        let images = directive(&policy, "img-src");

        for source in CHAT_IMAGE_SOURCES {
            assert!(images.contains(&source), "remote img-src lacks {source}");
        }
    }

    #[test]
    fn app_windows_allow_every_chat_image_host() {
        for key in ["csp", "devCsp"] {
            let policy = conf_policy(key);
            let images = directive(&policy, "img-src");

            for source in CHAT_IMAGE_SOURCES {
                assert!(images.contains(&source), "{key} img-src lacks {source}");
            }
        }
    }

    #[test]
    fn app_windows_run_no_inline_script_or_eval_in_release() {
        let policy = conf_policy("csp");

        assert!(!directive(&policy, "script-src").contains(&"'unsafe-inline'"));
        assert!(!policy.contains("unsafe-eval"));
    }
}
