// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::env;
mod modules;

use modules::ssh_connection;

fn main() {
    tauri::Builder::default()
        .invoke_handler(
          tauri::generate_handler![
            ssh_connection::connect_to_pi,
            ssh_connection::download_files,
            ssh_connection::upload_files,
            ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}