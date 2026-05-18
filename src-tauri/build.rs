fn main() {
    let env_path = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join(".env");
    let _ = dotenvy::from_path(&env_path);

    if let Ok(key) = std::env::var("APTABASE_KEY") {
        println!("cargo:rustc-env=APTABASE_KEY={key}");
    }

    println!("cargo:rerun-if-env-changed=APTABASE_KEY");
    println!("cargo:rerun-if-changed={}", env_path.display());

    tauri_build::build()
}
