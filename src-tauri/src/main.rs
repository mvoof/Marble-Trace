// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
#![warn(clippy::all, clippy::pedantic)]

#[tokio::main]
async fn main() {
    marble_trace_lib::run();
}
