fn main() {
    let env_path = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join(".env");
    let _ = dotenvy::from_path(&env_path);

    if let Ok(key) = std::env::var("APTABASE_KEY") {
        println!("cargo:rustc-env=APTABASE_KEY={key}");
    }

    // Twitch client id is public by Twitch's own definition, so baking it in is
    // safe. It lives in .env only so it is not copy-pasted out of the repo and
    // so release builds pick it up from CI the same way the analytics key does.
    if let Ok(client_id) = std::env::var("TWITCH_CLIENT_ID") {
        println!("cargo:rustc-env=TWITCH_CLIENT_ID={client_id}");
    }

    println!("cargo:rerun-if-env-changed=APTABASE_KEY");
    println!("cargo:rerun-if-env-changed=TWITCH_CLIENT_ID");
    println!("cargo:rerun-if-changed={}", env_path.display());

    tauri_build::build()
}
