// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::sync::{Arc, Mutex};
use tauri::{AppHandle, State, Manager};
use tokio::time::{interval, Duration};
use tauri_plugin_notification::NotificationExt;
use tauri::tray::{TrayIconBuilder, TrayIconEvent};
use auto_launch::AutoLaunchBuilder;
use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};

struct NotificationState {
    is_enabled: Arc<Mutex<bool>>,
    handle: Arc<Mutex<Option<tokio::task::JoinHandle<()>>>>,
    start_date: Arc<Mutex<Option<String>>>,
    end_date: Arc<Mutex<Option<String>>>,
}

#[derive(Serialize, Deserialize, Clone)]
struct TimeRemaining {
    days: i64,
    hours: i64,
    minutes: i64,
    seconds: i64,
    total_ms: i64,
    is_expired: bool,
}

impl Default for NotificationState {
    fn default() -> Self {
        Self {
            is_enabled: Arc::new(Mutex::new(true)), // Enable by default
            handle: Arc::new(Mutex::new(None)),
            start_date: Arc::new(Mutex::new(None)),
            end_date: Arc::new(Mutex::new(None)),
        }
    }
}

fn calculate_time_components(time_remaining_ms: i64) -> (i64, i64, i64, i64) {
    let total_seconds = time_remaining_ms / 1000;
    let days = total_seconds / (24 * 60 * 60);
    let hours = (total_seconds % (24 * 60 * 60)) / (60 * 60);
    let minutes = (total_seconds % (60 * 60)) / 60;
    let seconds = total_seconds % 60;
    (days, hours, minutes, seconds)
}

#[tauri::command]
async fn get_notification_status(state: State<'_, NotificationState>) -> Result<bool, String> {
    let is_enabled = state.is_enabled.lock().map_err(|e| format!("Failed to lock notification state: {}", e))?;
    Ok(*is_enabled)
}

#[tauri::command]
async fn set_timer_dates(
    state: State<'_, NotificationState>,
    start_date: String,
    end_date: String
) -> Result<(), String> {
    // Validate date formats before storing
    chrono::DateTime::parse_from_rfc3339(&start_date)
        .map_err(|e| format!("Invalid start date format: {}", e))?;
    chrono::DateTime::parse_from_rfc3339(&end_date)
        .map_err(|e| format!("Invalid end date format: {}", e))?;
    
    {
        let mut start = state.start_date.lock().map_err(|e| format!("Failed to lock start date: {}", e))?;
        *start = Some(start_date);
    }
    {
        let mut end = state.end_date.lock().map_err(|e| format!("Failed to lock end date: {}", e))?;
        *end = Some(end_date);
    }
    Ok(())
}

#[tauri::command]
async fn get_time_remaining(state: State<'_, NotificationState>) -> Result<TimeRemaining, String> {
    let start_date = state.start_date.lock().map_err(|e| format!("Failed to lock start date: {}", e))?.clone();
    let end_date = state.end_date.lock().map_err(|e| format!("Failed to lock end date: {}", e))?.clone();
    
    if let (Some(_), Some(end)) = (start_date, end_date) {
        let now = chrono::Utc::now();
        let end_time = chrono::DateTime::parse_from_rfc3339(&end)
            .map_err(|e| format!("Invalid end date: {}", e))?;
        
        let time_remaining = (end_time.with_timezone(&Utc) - now).num_milliseconds();
        
        if time_remaining <= 0 {
            return Ok(TimeRemaining {
                days: 0,
                hours: 0,
                minutes: 0,
                seconds: 0,
                total_ms: 0,
                is_expired: true,
            });
        }
        
        let (days, hours, minutes, seconds) = calculate_time_components(time_remaining);
        
        Ok(TimeRemaining {
            days,
            hours,
            minutes,
            seconds,
            total_ms: time_remaining,
            is_expired: false,
        })
    } else {
        Err("Timer dates not set".to_string())
    }
}

#[tauri::command]
async fn start_notifications(
    app: AppHandle,
    state: State<'_, NotificationState>,
) -> Result<(), String> {
    // Check and set enabled status atomically to prevent race conditions
    {
        let mut is_enabled = state.is_enabled.lock().map_err(|e| format!("Failed to lock notification state: {}", e))?;
        if *is_enabled {
            return Ok(()); // Already enabled
        }
        *is_enabled = true;
    }

    // Stop any existing notification task
    {
        let mut handle = state.handle.lock().map_err(|e| format!("Failed to lock task handle: {}", e))?;
        if let Some(task) = handle.take() {
            task.abort();
        }
    }

    // Start new notification task
    let app_clone = app.clone();
    let is_enabled_clone = state.is_enabled.clone();
    let start_date_clone = state.start_date.clone();
    let end_date_clone = state.end_date.clone();
    
    let task = tokio::spawn(async move {
        let mut interval = interval(Duration::from_secs(6 * 60 * 60)); // 6 hours
        
        loop {
            interval.tick().await;
            
            // Check if notifications are still enabled
            {
                match is_enabled_clone.lock() {
                    Ok(enabled_guard) => {
                        if !*enabled_guard {
                            break;
                        }
                    }
                    Err(e) => {
                        eprintln!("Failed to lock notification state in task: {}", e);
                        break; // Exit on lock failure
                    }
                }
            }
            
            // Get time remaining for notification
            let notification_body = {
                let start_date = match start_date_clone.lock() {
                    Ok(guard) => guard.clone(),
                    Err(_) => {
                        eprintln!("Failed to lock start date in notification task");
                        continue;
                    }
                };
                let end_date = match end_date_clone.lock() {
                    Ok(guard) => guard.clone(),
                    Err(_) => {
                        eprintln!("Failed to lock end date in notification task");
                        continue;
                    }
                };
                
                if let (Some(_), Some(end)) = (start_date, end_date) {
                    if let Ok(end_time) = DateTime::parse_from_rfc3339(&end) {
                        let now = Utc::now();
                        let time_remaining = (end_time.with_timezone(&Utc) - now).num_milliseconds();
                        
                        if time_remaining <= 0 {
                            "⏰ Time's up! Your hourglass has run out of sand.".to_string()
                        } else {
                            let (days, hours, minutes, _) = calculate_time_components(time_remaining);
                            
                            if days > 0 {
                                format!("⏳ Time remaining: {} days, {} hours, {} minutes", days, hours, minutes)
                            } else if hours > 0 {
                                format!("⏳ Time remaining: {} hours, {} minutes", hours, minutes)
                            } else {
                                format!("⏳ Time remaining: {} minutes", minutes)
                            }
                        }
                    } else {
                        "⏳ Time keeps flowing... Check your hourglass progress!".to_string()
                    }
                } else {
                    "⏳ Time keeps flowing... Set your dates to see time remaining!".to_string()
                }
            };
            
            // Send notification
            if let Err(e) = app_clone
                .notification()
                .builder()
                .title("Hourglass Reminder")
                .body(&notification_body)
                .show()
            {
                eprintln!("Failed to send notification: {}", e);
            }
        }
    });

    // Store the task handle
    {
        let mut handle = state.handle.lock().map_err(|e| format!("Failed to lock task handle: {}", e))?;
        *handle = Some(task);
    }

    Ok(())
}

#[tauri::command]
async fn stop_notifications(state: State<'_, NotificationState>) -> Result<(), String> {
    {
        let mut is_enabled = state.is_enabled.lock().map_err(|e| format!("Failed to lock notification state: {}", e))?;
        *is_enabled = false;
    }

    // Stop the notification task
    {
        let mut handle = state.handle.lock().map_err(|e| format!("Failed to lock task handle: {}", e))?;
        if let Some(task) = handle.take() {
            task.abort();
        }
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

fn create_auto_launch() -> Result<auto_launch::AutoLaunch, String> {
    let exe_path = std::env::current_exe()
        .map_err(|e| format!("Failed to get executable path: {}", e))?
        .to_string_lossy()
        .to_string();
    
    AutoLaunchBuilder::new()
        .set_app_name("Hourglass")
        .set_app_path(&exe_path)
        .build()
        .map_err(|e| format!("Failed to create auto launch: {}", e))
}

#[tauri::command]
async fn get_startup_enabled() -> Result<bool, String> {
    let auto = create_auto_launch()?;
    auto.is_enabled().map_err(|e| e.to_string())
}

#[tauri::command]
async fn enable_startup() -> Result<(), String> {
    let auto = create_auto_launch()?;
    auto.enable().map_err(|e| e.to_string())
}

#[tauri::command]
async fn disable_startup() -> Result<(), String> {
    let auto = create_auto_launch()?;
    auto.disable().map_err(|e| e.to_string())
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
            send_test_notification,
            set_timer_dates,
            get_time_remaining,
            get_startup_enabled,
            enable_startup,
            disable_startup
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