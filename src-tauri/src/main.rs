// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::sync::{Arc, Mutex};
use tauri::{AppHandle, State, Manager};
use tokio::time::{interval, Duration};
use tauri_plugin_notification::NotificationExt;
use tauri::tray::{TrayIconBuilder, TrayIconEvent};

struct NotificationState {
    is_enabled: Arc<Mutex<bool>>,
    handle: Arc<Mutex<Option<tokio::task::JoinHandle<()>>>>,
}

impl Default for NotificationState {
    fn default() -> Self {
        Self {
            is_enabled: Arc::new(Mutex::new(true)), // Enable by default
            handle: Arc::new(Mutex::new(None)),
        }
    }
}

#[tauri::command]
async fn get_notification_status(state: State<'_, NotificationState>) -> Result<bool, String> {
    let is_enabled = state.is_enabled.lock().unwrap();
    Ok(*is_enabled)
}

#[tauri::command]
async fn start_notifications(
    app: AppHandle,
    state: State<'_, NotificationState>,
) -> Result<(), String> {
    let mut is_enabled = state.is_enabled.lock().unwrap();
    if *is_enabled {
        return Ok(()); // Already enabled
    }
    
    *is_enabled = true;
    drop(is_enabled);

    // Stop any existing notification task
    {
        let mut handle = state.handle.lock().unwrap();
        if let Some(task) = handle.take() {
            task.abort();
        }
    }

    // Start new notification task
    let app_clone = app.clone();
    let is_enabled_clone = state.is_enabled.clone();
    
    let task = tokio::spawn(async move {
        let mut interval = interval(Duration::from_secs(6 * 60 * 60)); // 6 hours
        
        loop {
            interval.tick().await;
            
            // Check if notifications are still enabled
            {
                let enabled = is_enabled_clone.lock().unwrap();
                if !*enabled {
                    break;
                }
            }
            
            // Send notification
            if let Err(e) = app_clone
                .notification()
                .builder()
                .title("Hourglass Reminder")
                .body("Time keeps flowing... Check your hourglass progress!")
                .show()
            {
                eprintln!("Failed to send notification: {}", e);
            }
        }
    });

    // Store the task handle
    {
        let mut handle = state.handle.lock().unwrap();
        *handle = Some(task);
    }

    Ok(())
}

#[tauri::command]
async fn stop_notifications(state: State<'_, NotificationState>) -> Result<(), String> {
    let mut is_enabled = state.is_enabled.lock().unwrap();
    *is_enabled = false;
    drop(is_enabled);

    // Stop the notification task
    let mut handle = state.handle.lock().unwrap();
    if let Some(task) = handle.take() {
        task.abort();
    }

    Ok(())
}

#[tauri::command]
async fn send_test_notification(app: AppHandle) -> Result<(), String> {
    app.notification()
        .builder()
        .title("Test Notification")
        .body("This is a test notification from Hourglass!")
        .show()
        .map_err(|e| e.to_string())?;
    
    Ok(())
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_notification::init())
        .manage(NotificationState::default())
        .invoke_handler(tauri::generate_handler![
            get_notification_status,
            start_notifications,
            stop_notifications,
            send_test_notification
        ])
        .setup(|app| {
            // Setup system tray only if we have a default icon
            if let Some(icon) = app.default_window_icon() {
                let _tray = TrayIconBuilder::new()
                    .icon(icon.clone())
                    .title("Hourglass")
                    .tooltip("Hourglass - Time Tracker")
                    .on_tray_icon_event(|tray, event| {
                        if let TrayIconEvent::Click { .. } = event {
                            let app = tray.app_handle();
                            // Get the first available window since no specific label is set
                            if let Some(window) = app.webview_windows().values().next() {
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                    })
                    .build(app)?;
            }

            // Configure window close behavior to minimize to tray
            if let Some(window) = app.webview_windows().values().next() {
                let window_clone = window.clone();
                window.on_window_event(move |event| {
                    if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                        api.prevent_close();
                        let _ = window_clone.hide();
                    }
                });
            }

            // Auto-start notifications on app launch
            let app_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                // Wait a moment for the app to fully initialize
                tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;
                
                // Get the state from the app handle
                let state = app_handle.state::<NotificationState>();
                if let Err(e) = start_notifications(app_handle.clone(), state).await {
                    eprintln!("Failed to auto-start notifications: {}", e);
                }
            });
            
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}