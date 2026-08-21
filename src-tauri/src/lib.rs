use tauri::{
    image::Image,
    menu::{MenuBuilder, MenuItemBuilder},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    ActivationPolicy, Manager, PhysicalPosition,
};

/// Écrit dans le presse-papiers à la fois du HTML (noms de plateformes
/// cliquables, URL masquée) et un repli texte brut.
#[tauri::command]
fn copy_rich(html: String, text: String) -> Result<(), String> {
    use arboard::Clipboard;
    let mut cb = Clipboard::new().map_err(|e| e.to_string())?;
    cb.set_html(html, Some(text)).map_err(|e| e.to_string())
}

/// Affiche la fenêtre centrée sous l'icône de la barre de menus.
fn show_under_tray(app: &tauri::AppHandle, tray_rect: tauri::Rect) {
    if let Some(win) = app.get_webview_window("main") {
        let scale = win.scale_factor().unwrap_or(1.0);
        // rect de l'icône (physique) : on centre la fenêtre dessous
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_opener::init())
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
                        toggle_window(tray.app_handle(), rect);
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
        .invoke_handler(tauri::generate_handler![copy_rich])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
