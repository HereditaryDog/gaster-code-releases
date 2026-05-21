// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::{fs, path::PathBuf};

fn main() {
    if let Some(portable_dir) = determine_startup_portable_dir() {
        std::env::set_var(
            "CLAUDE_CONFIG_DIR",
            portable_dir.to_string_lossy().to_string(),
        );
        std::env::set_var("GASTER_CODE_APP_PORTABLE_DIR", "1");
    }

    if let Ok(config_dir) = std::env::var("CLAUDE_CONFIG_DIR") {
        let webview_data = PathBuf::from(&config_dir).join("EBWebView");
        if let Err(err) = fs::create_dir_all(&webview_data) {
            eprintln!("[desktop] failed to create EBWebView dir: {err}");
        }
        std::env::set_var("WEBVIEW2_USER_DATA_FOLDER", &webview_data);
    }

    gaster_code_desktop_lib::run()
}

fn determine_startup_portable_dir() -> Option<PathBuf> {
    if std::env::var("CLAUDE_CONFIG_DIR").is_ok() {
        return None;
    }

    let exe = std::env::current_exe().ok()?;
    let exe_dir = exe.parent()?;
    let default_portable = exe_dir.join("GASTER_CODE_CONFIG_DIR");

    if let Some((mode, portable_dir)) = read_mode_from_config(&default_portable) {
        return if mode == "portable" {
            Some(portable_dir.unwrap_or(default_portable.clone()))
        } else {
            None
        };
    }

    if let Some(system_config) = system_config_root() {
        let app_subdir = system_config.join("com.gastercode.desktop");
        if let Some((mode, portable_dir)) = read_mode_from_config(&app_subdir) {
            return if mode == "portable" {
                Some(portable_dir.unwrap_or(default_portable.clone()))
            } else {
                None
            };
        }
    }

    dir_has_portable_data(&default_portable).then_some(default_portable)
}

fn read_mode_from_config(dir: &std::path::Path) -> Option<(String, Option<PathBuf>)> {
    let data = std::fs::read_to_string(dir.join("app-mode.json")).ok()?;
    let parsed: serde_json::Value = serde_json::from_str(&data).ok()?;
    let mode = parsed
        .get("mode")
        .and_then(|value| value.as_str())
        .unwrap_or("default")
        .to_ascii_lowercase();
    let portable_dir = parsed
        .get("portable_dir")
        .and_then(|value| value.as_str())
        .map(PathBuf::from);
    Some((mode, portable_dir))
}

fn system_config_root() -> Option<PathBuf> {
    #[cfg(target_os = "windows")]
    {
        std::env::var_os("APPDATA").map(PathBuf::from)
    }
    #[cfg(target_os = "macos")]
    {
        std::env::var_os("HOME")
            .map(PathBuf::from)
            .map(|home| home.join("Library").join("Application Support"))
    }
    #[cfg(target_os = "linux")]
    {
        std::env::var_os("XDG_CONFIG_HOME")
            .map(PathBuf::from)
            .or_else(|| std::env::var_os("HOME").map(|home| PathBuf::from(home).join(".config")))
    }
}

fn dir_has_portable_data(dir: &std::path::Path) -> bool {
    if !dir.is_dir() {
        return false;
    }

    ["window-state.json", "terminal-config.json", "app-mode.json"]
        .iter()
        .any(|file| dir.join(file).is_file())
        || dir.join("Cache").is_dir()
        || dir.join("EBWebView").is_dir()
}
