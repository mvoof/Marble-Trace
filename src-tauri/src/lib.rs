#[tauri::command]
fn get_lang_from_rust(lang: String) -> String {
    lang
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![get_lang_from_rust])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
