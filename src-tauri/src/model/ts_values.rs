//! The generator behind the two `.ts` value files.
//!
//! Specta writes `bindings.ts` and handles types. A default and an event name
//! are *values*, and the frontend needs them as compile-time literals — the
//! shipped widget defaults are read while `manifest.ts` is still being
//! imported, long before anything could `await` a command. So they are declared
//! in Rust and written out from here.
//!
//! [`ts_values!`] takes the declaration and the export from **one** list. A
//! hand-written exporter would restate every name and doc comment beside the
//! `const` it exports, which is the same two-places-to-edit problem this whole
//! module exists to remove — one list further down the file instead of one in
//! each language.

/// Declares Rust constants and, in a dev build, the function that writes them
/// out as TypeScript.
///
/// ```ignore
/// ts_values! {
///     export_constants => "the header comment";
///     /// Doc comment, reused verbatim as the TSDoc of the exported constant.
///     pub const DEFAULT_CAR_LENGTH_M: f32 = 4.4 => DEFAULT_CAR_LENGTH_M;
/// }
/// ```
///
/// The name after `=>` is what the frontend imports, which is not always the
/// Rust name: `EVENT_SESSION_INFO` is `SIM_SESSION` over there, and renaming
/// one of the two to match would make the other read wrong in its own file.
///
/// Values are emitted with `{:?}`, which is a valid TypeScript literal for
/// every type used here — numbers print as themselves, `&str` prints quoted and
/// escaped.
macro_rules! ts_values {
    (
        $exporter:ident => $header:expr;
        $(
            $(#[doc = $doc:expr])+
            pub const $name:ident: $ty:ty = $value:expr => $ts_name:ident;
        )*
    ) => {
        $(
            $(#[doc = $doc])+
            pub const $name: $ty = $value;
        )*

        #[cfg(feature = "dev")]
        pub fn $exporter(path: &str) -> std::io::Result<()> {
            let mut out = String::new();

            out.push_str($header);
            out.push('\n');

            $(
                out.push_str("\n/**");
                $(
                    out.push_str("\n *");
                    out.push_str($doc);
                )+
                out.push_str("\n */\n");
                out.push_str(&format!(
                    "export const {} = {:?};\n",
                    stringify!($ts_name),
                    $name
                ));
            )*

            std::fs::write(path, out)
        }

        /// Every exported name paired with the literal the generator writes for
        /// it, so a test can check the checked-in file without being sensitive
        /// to how `oxfmt` laid it out.
        #[cfg(all(test, feature = "dev"))]
        pub fn exported_pairs() -> Vec<(&'static str, String)> {
            vec![
                $((stringify!($ts_name), format!("{:?}", $name)),)*
            ]
        }
    };
}

pub(crate) use ts_values;

/// The header every generated value file opens with.
///
/// Only the generator reads it, and the generator is dev-only — in a release
/// build `ts_values!` expands to the constants alone.
#[cfg(feature = "dev")]
pub const GENERATED_HEADER: &str = "\
// Generated from Rust by `ts_values!` (src-tauri/src/model/ts_values.rs), the
// value generator that runs alongside specta's type export. Specta writes
// `bindings.ts` and only handles types; these are values, so they come from
// here. Edit the Rust declaration, not this file.";

/// Asserts that a checked-in generated file still carries every name and value
/// the Rust side declares.
///
/// Deliberately a containment check rather than a byte comparison: the
/// generated files are `oxfmt`-formatted after generation like `bindings.ts`
/// is, so an exact match would fail on whitespace. Formatting cannot move a
/// string literal or rename an export, which is the whole of what matters here.
#[cfg(all(test, feature = "dev"))]
pub fn assert_exported(path: &str, pairs: Vec<(&'static str, String)>) {
    // `oxfmt` rewrites the generated file's double quotes as single ones, so
    // the comparison is made quote-blind rather than pinning the formatter.
    let checked_in = std::fs::read_to_string(path)
        .unwrap_or_else(|_| panic!("{path} is missing — regenerate with UPDATE_BINDINGS=1"))
        .replace('\'', "\"");

    for (name, value) in pairs {
        let expected = format!("export const {name} = {value}");

        assert!(
            checked_in.contains(&expected),
            "{path} is stale: expected `{expected}`.\n\
             Rerun with UPDATE_BINDINGS=1 cargo test --features dev, then npm run format."
        );
    }
}
