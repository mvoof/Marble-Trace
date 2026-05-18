fn main() {
    if std::env::var("APTABASE_KEY").is_err() {
        if let Some(value) = read_dotenv_key(".env", "APTABASE_KEY") {
            println!("cargo:rustc-env=APTABASE_KEY={}", value);
        }
    }

    println!("cargo:rerun-if-changed=.env");

    tauri_build::build()
}

fn read_dotenv_key(path: &str, key: &str) -> Option<String> {
    let contents = std::fs::read_to_string(path).ok()?;
    let prefix = format!("{}=", key);

    for line in contents.lines() {
        if let Some(value) = line.strip_prefix(&prefix) {
            return Some(value.to_string());
        }
    }

    None
}
