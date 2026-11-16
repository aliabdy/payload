mod http;
mod models;
mod storage;

use models::{RequestError, RequestSpec, ResponseData};
use reqwest::cookie::Jar;
use serde_json::Value;
use std::collections::HashMap;
use std::sync::{Arc, RwLock};
use tauri::{AppHandle, State};
use tokio::sync::{oneshot, Mutex};

struct AppState {
    jar: RwLock<Arc<Jar>>,
    cancels: Mutex<HashMap<String, oneshot::Sender<()>>>,
}

#[tauri::command]
async fn send_request(
    state: State<'_, AppState>,
    spec: RequestSpec,
) -> Result<ResponseData, RequestError> {
    let (sender, receiver) = oneshot::channel();
    state
        .cancels
        .lock()
        .await
        .insert(spec.id.clone(), sender);
    let jar = state
        .jar
        .read()
        .map_err(|error| RequestError::new("other", error.to_string()))?
        .clone();
    let result = http::execute(spec.clone(), jar, receiver).await;
    state.cancels.lock().await.remove(&spec.id);
    result
}

#[tauri::command]
async fn cancel_request(state: State<'_, AppState>, id: String) -> Result<(), String> {
    if let Some(sender) = state.cancels.lock().await.remove(&id) {
        let _ = sender.send(());
    }
    Ok(())
}

#[tauri::command]
fn clear_cookies(state: State<'_, AppState>) -> Result<(), String> {
    let mut jar = state.jar.write().map_err(|error| error.to_string())?;
    *jar = Arc::new(Jar::default());
    Ok(())
}

#[tauri::command]
fn load_app_data(app: AppHandle) -> Result<Option<Value>, String> {
    storage::load(&app)
}

#[tauri::command]
fn save_app_data(app: AppHandle, data: Value) -> Result<(), String> {
    storage::save(&app, data)
}

#[tauri::command]
fn read_text_file(path: String) -> Result<String, String> {
    storage::read_text(&path)
}

#[tauri::command]
fn write_text_file(path: String, contents: String) -> Result<(), String> {
    storage::write_text(&path, &contents)
}

#[tauri::command]
fn app_data_path(app: AppHandle) -> Result<String, String> {
    storage::data_path(&app).map(|path| path.to_string_lossy().into_owned())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(AppState {
            jar: RwLock::new(Arc::new(Jar::default())),
            cancels: Mutex::new(HashMap::new()),
        })
        .invoke_handler(tauri::generate_handler![
            send_request,
            cancel_request,
            clear_cookies,
            load_app_data,
            save_app_data,
            read_text_file,
            write_text_file,
            app_data_path
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
