//! The few pages the server renders itself.
//!
//! Everything a widget draws comes from the frontend bundle; this is only what
//! a browser needs before it gets there — the landing page listing the screens,
//! and the message shown when a link arrives without its token.
use axum::http::{header, HeaderMap, StatusCode};
use axum::response::{IntoResponse, Response};

/// Dark, because every device that opens this is about to show an overlay, and
/// a white flash on a tablet strapped to a wheel is unpleasant.
const PAGE_STYLE: &str =
    "*{box-sizing:border-box}body{margin:0;min-height:100vh;display:flex;align-items:center;\
justify-content:center;background:#0f1013;color:#e8e8ea;line-height:1.5;text-align:center;\
padding:2rem;font-family:system-ui,-apple-system,sans-serif}\
h1{font-size:1.4rem;margin:0 0 .75rem}p{margin:0 0 1rem;color:#9a9aa2}\
ul{list-style:none;padding:0;margin:0}li{margin:.5rem 0}\
a{display:inline-block;padding:.75rem 1.5rem;border-radius:.5rem;background:#1d1f26;\
color:#e8e8ea;text-decoration:none;font-size:1.1rem}\
form{display:flex;gap:.5rem;justify-content:center;flex-wrap:wrap}\
input{padding:.7rem 1rem;border-radius:.5rem;border:1px solid #2c2f39;background:#15171d;\
color:#e8e8ea;font-size:1.1rem;min-width:16ch}\
button{padding:.7rem 1.4rem;border-radius:.5rem;border:0;background:#3b6ef5;color:#fff;\
font-size:1.1rem;cursor:pointer}";

/// Wraps a fragment in a self-contained page. No bundle, no fonts, no requests
/// beyond this one response — these pages have to work before anything else does.
pub fn html_page(status: StatusCode, language: &str, body: &str) -> Response {
    let html = format!(
        "<!doctype html><html lang=\"{language}\"><head><meta charset=\"utf-8\">\
<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">\
<title>Marble Trace</title><style>{PAGE_STYLE}</style></head>\
<body><main>{body}</main></body></html>"
    );

    let mut headers = HeaderMap::new();

    if let Ok(value) = "text/html; charset=utf-8".parse() {
        headers.insert(header::CONTENT_TYPE, value);
    }

    (status, headers, html).into_response()
}

/// The strings these pages need, in the language the app itself runs in.
///
/// A table here rather than the frontend's translation files: these pages are
/// what a browser sees *before* it loads the bundle, so they cannot depend on
/// anything in it.
struct Strings {
    unauthorized_title: &'static str,
    unauthorized_body: &'static str,
    empty_title: &'static str,
    empty_body: &'static str,
    pick: &'static str,
    token_placeholder: &'static str,
    token_submit: &'static str,
}

const EN: Strings = Strings {
    unauthorized_title: "Access token required",
    unauthorized_body: "Scan the QR code in the app under Settings &rarr; Remote screens, \
or type the token shown next to it here.",
    empty_title: "No screens yet",
    empty_body: "Add a remote screen to the active layout in the app's layout editor, \
next to the monitors.",
    pick: "Pick a screen:",
    token_placeholder: "Access token",
    token_submit: "Open",
};

const RU: Strings = Strings {
    unauthorized_title: "Нужен токен доступа",
    unauthorized_body: "Отсканируйте QR-код в приложении, в разделе «Настройки → Внешние \
экраны», либо введите здесь токен, показанный рядом с ним.",
    empty_title: "Экранов пока нет",
    empty_body: "Добавьте внешний экран в активную раскладку — в редакторе раскладок, \
рядом с мониторами.",
    pick: "Выберите экран:",
    token_placeholder: "Токен доступа",
    token_submit: "Открыть",
};

const ZH: Strings = Strings {
    unauthorized_title: "需要访问令牌",
    unauthorized_body: "请扫描应用「设置 → 远程屏幕」中的二维码，或在此输入其旁边显示的令牌。",
    empty_title: "尚无屏幕",
    empty_body: "请在应用的布局编辑器中，在显示器旁边为当前布局添加一个远程屏幕。",
    pick: "选择屏幕：",
    token_placeholder: "访问令牌",
    token_submit: "打开",
};

/// Falls back to English for anything unrecognised — including `system`, which
/// the frontend has already resolved by the time it reaches here.
fn strings(language: &str) -> &'static Strings {
    match language {
        "ru" => &RU,
        "zh" => &ZH,
        _ => &EN,
    }
}

/// Shown when a link arrives without a usable token.
///
/// Carries a form back to `action`, so a device that cannot scan the QR code
/// has a way in: the token is short enough to read off the screen and type. A
/// plain GET form, because this page must work before any script does.
pub fn unauthorized_page(language: &str, action: &str) -> Response {
    let text = strings(language);

    html_page(
        StatusCode::UNAUTHORIZED,
        language,
        &format!(
            "<h1>{}</h1><p>{}</p>\
<form method=\"get\" action=\"{}\">\
<input name=\"t\" autocapitalize=\"off\" autocorrect=\"off\" spellcheck=\"false\" \
placeholder=\"{}\" aria-label=\"{}\">\
<button type=\"submit\">{}</button></form>",
            text.unauthorized_title,
            text.unauthorized_body,
            escape(action),
            text.token_placeholder,
            text.token_placeholder,
            text.token_submit
        ),
    )
}

/// The landing page. A bare address is the first thing anyone types, and a 404
/// there reads as a broken server.
pub fn index_page(screens: &[(String, String)], token: &str, language: &str) -> Response {
    let text = strings(language);

    if screens.is_empty() {
        return html_page(
            StatusCode::OK,
            language,
            &format!("<h1>{}</h1><p>{}</p>", text.empty_title, text.empty_body),
        );
    }

    let query = if token.is_empty() {
        String::new()
    } else {
        format!("?t={}", escape(token))
    };

    let links: String = screens
        .iter()
        .map(|(slug, name)| {
            format!(
                "<li><a href=\"/r/{}{}\">{}</a></li>",
                escape(slug),
                query,
                escape(name)
            )
        })
        .collect();

    html_page(
        StatusCode::OK,
        language,
        &format!("<h1>Marble Trace</h1><p>{}</p><ul>{links}</ul>", text.pick),
    )
}

/// Screen names come from the user's own settings rather than from the network,
/// so they are not hostile — but they land in HTML, and a name with an angle
/// bracket in it should read as text instead of as markup.
fn escape(value: &str) -> String {
    value
        .replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
}

#[cfg(test)]
mod tests {
    use super::{escape, strings};

    #[test]
    fn escapes_markup_in_a_screen_name() {
        assert_eq!(escape("<b>Tablet</b>"), "&lt;b&gt;Tablet&lt;/b&gt;");
    }

    #[test]
    fn escapes_quotes_so_a_name_cannot_break_out_of_an_attribute() {
        assert_eq!(escape("a\"b"), "a&quot;b");
    }

    #[test]
    fn leaves_an_ordinary_name_alone() {
        assert_eq!(escape("Планшет на руле"), "Планшет на руле");
    }

    #[test]
    fn falls_back_to_english_for_an_unknown_language() {
        assert_eq!(strings("system").pick, strings("en").pick);
        assert_eq!(strings("pt-BR").pick, strings("en").pick);
    }

    #[test]
    fn serves_each_supported_language() {
        assert_ne!(strings("ru").pick, strings("en").pick);
        assert_ne!(strings("zh").pick, strings("en").pick);
    }
}
