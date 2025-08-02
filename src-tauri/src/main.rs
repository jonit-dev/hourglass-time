// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::sync::{Arc, Mutex};
use std::time::Duration;
use tauri::{Manager, State};
use tokio::time::{interval, Instant};

#[derive(Clone)]
struct NotificationState {
    is_enabled: Arc<Mutex<bool>>,
    last_notification: Arc<Mutex<Option<Instant>>>,
}

impl Default for NotificationState {
    fn default() -> Self {
        Self {
            is_enabled: Arc::new(Mutex::new(true)), // Enabled by default
            last_notification: Arc::new(Mutex::new(None)),
        }
    }
}

#[tauri::command]
async fn start_notifications(state: State<'_, NotificationState>) -> Result<(), String> {
    let is_enabled = state.is_enabled.clone();
    let last_notification = state.last_notification.clone();
    
    *is_enabled.lock().unwrap() = true;
    *last_notification.lock().unwrap() = Some(Instant::now());
    
    Ok(())
}

#[tauri::command]
async fn stop_notifications(state: State<'_, NotificationState>) -> Result<(), String> {
    *state.is_enabled.lock().unwrap() = false;
    Ok(())
}

#[tauri::command]
async fn get_notification_status(state: State<'_, NotificationState>) -> Result<bool, String> {
    Ok(*state.is_enabled.lock().unwrap())
}

async fn notification_loop(app_handle: tauri::AppHandle, state: NotificationState) {
    let mut interval = interval(Duration::from_secs(60)); // Check every minute
    
    loop {
        interval.tick().await;
        
        let is_enabled = *state.is_enabled.lock().unwrap();
        if !is_enabled {
            continue;
        }
        
        let mut last_notification_guard = state.last_notification.lock().unwrap();
        let should_notify = match *last_notification_guard {
            Some(last) => last.elapsed() >= Duration::from_secs(6 * 60 * 60), // 6 hours
            None => true,
        };
        
        if should_notify {
            if let Err(e) = tauri_plugin_notification::NotificationExt::notification(&app_handle)
                .builder()
                .title("Hourglass Reminder")
                .body("Time check: How much time do you have left?")
                .show()
            {
                eprintln!("Failed to show notification: {}", e);
            } else {
                *last_notification_guard = Some(Instant::now());
            }
        }
    }
}

fn main() {
    let notification_state = NotificationState::default();
    
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_notification::init())
        .manage(notification_state)
        .invoke_handler(tauri::generate_handler![
            start_notifications,
            stop_notifications,
            get_notification_status
        ])
        .setup(|app| {
            let app_handle = app.handle().clone();
            let state = app.state::<NotificationState>().inner().clone();
            
            tokio::spawn(async move {
                notification_loop(app_handle, state).await;
            });
            
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}