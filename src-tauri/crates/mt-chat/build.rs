// The Twitch client id is read with `option_env!` in this crate, and
// `cargo:rustc-env` reaches only the crate whose build script prints it, so the
// app's `build.rs` cannot hand it over. Same `.env` as the app: `src-tauri/.env`.
fn main() {
    let env_path = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("../../.env");
    let _ = dotenvy::from_path(&env_path);

    // Twitch client id is public by Twitch's own definition, so baking it in is
    // safe. It lives in .env only so it is not copy-pasted out of the repo and
    // so release builds pick it up from CI the same way the analytics key does.
    if let Ok(client_id) = std::env::var("TWITCH_CLIENT_ID") {
        println!("cargo:rustc-env=TWITCH_CLIENT_ID={client_id}");
    }

    println!("cargo:rerun-if-env-changed=TWITCH_CLIENT_ID");
    println!("cargo:rerun-if-changed={}", env_path.display());
}
