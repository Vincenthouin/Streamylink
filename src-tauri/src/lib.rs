use std::sync::Mutex;
use tauri::{
    image::Image,
    menu::{MenuBuilder, MenuItemBuilder},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    ActivationPolicy, Manager, PhysicalPosition,
};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};

/// Dernière position connue de l'icône de la barre de menus, pour pouvoir
/// afficher la fenêtre au bon endroit quand elle est ouverte au clavier.
struct TrayRect(Mutex<Option<tauri::Rect>>);

/// Écrit dans le presse-papiers à la fois du HTML (noms de plateformes
/// cliquables, URL masquée) et un repli texte brut.
#[tauri::command]
fn copy_rich(html: String, text: String) -> Result<(), String> {
    use arboard::Clipboard;
    let mut cb = Clipboard::new().map_err(|e| e.to_string())?;
    cb.set_html(html, Some(text)).map_err(|e| e.to_string())
}

/// Ouvre une URL via `open` de macOS : navigateur pour http(s), app de
/// bureau pour les schémas de plateforme. Liste blanche de schémas pour
/// éviter d'ouvrir n'importe quoi (file://, etc.).
#[tauri::command]
fn open_external(url: String) -> Result<(), String> {
    const ALLOWED: &[&str] = &["https:", "http:", "spotify:", "music:", "deezer:", "itmss:"];
    let ok = ALLOWED.iter().any(|s| url.starts_with(s));
    if !ok {
        return Err("scheme not allowed".into());
    }
    std::process::Command::new("open")
        .arg(&url)
        .spawn()
        .map_err(|e| e.to_string())?;
    Ok(())
}

/// Affiche la fenêtre centrée sous l'icône de la barre de menus.
fn show_under_tray(app: &tauri::AppHandle, tray_rect: tauri::Rect) {
    if let Some(win) = app.get_webview_window("main") {
        let scale = win.scale_factor().unwrap_or(1.0);
        let pos = tray_rect.position.to_physical::<f64>(scale);
        let size = tray_rect.size.to_physical::<f64>(scale);
        let win_size = win.outer_size().map(|s| s.width as f64).unwrap_or(440.0);
        let x = pos.x + size.width / 2.0 - win_size / 2.0;
        let y = pos.y + size.height + 2.0;
        let _ = win.set_position(PhysicalPosition::new(x.max(8.0), y));
        let _ = win.show();
        let _ = win.set_focus();
    }
}

fn toggle_window(app: &tauri::AppHandle, tray_rect: tauri::Rect) {
    if let Some(win) = app.get_webview_window("main") {
        if win.is_visible().unwrap_or(false) {
            let _ = win.hide();
        } else {
            show_under_tray(app, tray_rect);
        }
    }
}

/// Bascule la fenêtre depuis le raccourci clavier : sous l'icône du tray si
/// on connaît sa position, sinon centrée.
fn toggle_from_shortcut(app: &tauri::AppHandle) {
    if let Some(win) = app.get_webview_window("main") {
        if win.is_visible().unwrap_or(false) {
            let _ = win.hide();
            return;
        }
    }
    let rect = app.state::<TrayRect>().0.lock().unwrap().clone();
    match rect {
        Some(rect) => show_under_tray(app, rect),
        None => {
            if let Some(win) = app.get_webview_window("main") {
                let _ = win.center();
                let _ = win.show();
                let _ = win.set_focus();
            }
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let hotkey = Shortcut::new(Some(Modifiers::CONTROL | Modifiers::SUPER), Code::KeyM);

    tauri::Builder::default()
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(move |app, sc, event| {
                    if event.state() == ShortcutState::Pressed && sc == &hotkey {
                        toggle_from_shortcut(app);
                    }
                })
                .build(),
        )
        .manage(TrayRect(Mutex::new(None)))
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            // utilitaire de barre de menus : pas d'icône dans le Dock
            app.set_activation_policy(ActivationPolicy::Accessory);

            // raccourci global ⌃⌘M pour ouvrir/masquer l'app (non bloquant :
            // si le combo est déjà pris ailleurs, l'app démarre quand même)
            if let Err(e) = app
                .global_shortcut()
                .register(Shortcut::new(Some(Modifiers::CONTROL | Modifiers::SUPER), Code::KeyM))
            {
                eprintln!("global shortcut ⌃⌘M register failed: {e}");
            }

            // icône template (noir + alpha), adaptée aux barres claires/sombres
            let icon = Image::from_bytes(include_bytes!(concat!(
                env!("CARGO_MANIFEST_DIR"),
                "/../resources/trayTemplate@2x.png"
            )))?;

            let quit = MenuItemBuilder::with_id("quit", "Quit Music Share").build(app)?;
            let menu = MenuBuilder::new(app).item(&quit).build()?;

            TrayIconBuilder::with_id("main-tray")
                .icon(icon)
                .icon_as_template(true)
                .tooltip("Music Share")
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| {
                    if event.id() == "quit" {
                        app.exit(0);
                    }
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        rect,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        *app.state::<TrayRect>().0.lock().unwrap() = Some(rect.clone());
                        toggle_window(app, rect);
                    }
                })
                .build(app)?;

            // masquer la fenêtre quand elle perd le focus (clic extérieur)
            if let Some(win) = app.get_webview_window("main") {
                let w = win.clone();
                win.on_window_event(move |event| {
                    if let tauri::WindowEvent::Focused(false) = event {
                        let _ = w.hide();
                    }
                });
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![copy_rich, open_external])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
