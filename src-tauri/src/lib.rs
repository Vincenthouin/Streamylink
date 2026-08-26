use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use tauri::{
    image::Image,
    menu::{MenuBuilder, MenuItemBuilder},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    ActivationPolicy, Manager, PhysicalPosition, RunEvent, WindowEvent,
};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};

/// Vrai seulement quand l'utilisateur a demandé « Quit » : sinon on empêche
/// l'app de se terminer (utilitaire de barre de menus qui doit rester vivant
/// même si sa fenêtre est fermée/détruite).
static QUITTING: AtomicBool = AtomicBool::new(false);

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

/// Masque la fenêtre au clic extérieur / à la demande de fermeture, au lieu
/// de la détruire — l'app reste vivante en barre de menus.
fn attach_window_events(win: &tauri::WebviewWindow) {
    let w = win.clone();
    win.on_window_event(move |event| match event {
        WindowEvent::Focused(false) => {
            let _ = w.hide();
        }
        WindowEvent::CloseRequested { api, .. } => {
            api.prevent_close();
            let _ = w.hide();
        }
        _ => {}
    });
}

/// (Re)crée la fenêtre principale (frameless, transparente, masquée).
fn build_main_window(app: &tauri::AppHandle) -> tauri::Result<tauri::WebviewWindow> {
    let win = tauri::WebviewWindowBuilder::new(app, "main", tauri::WebviewUrl::default())
        .title("Music Share")
        .inner_size(440.0, 480.0)
        .resizable(false)
        .decorations(false)
        .transparent(true)
        .always_on_top(true)
        .visible(false)
        .build()?;
    attach_window_events(&win);
    Ok(win)
}

/// Récupère la fenêtre, ou la recrée si elle a été détruite.
fn ensure_window(app: &tauri::AppHandle) -> Option<tauri::WebviewWindow> {
    if let Some(win) = app.get_webview_window("main") {
        return Some(win);
    }
    log::warn!("fenêtre absente — recréation");
    build_main_window(app)
        .map_err(|e| log::error!("recréation fenêtre échouée: {e}"))
        .ok()
}

/// Affiche la fenêtre centrée sous l'icône de la barre de menus.
fn show_under_tray(app: &tauri::AppHandle, tray_rect: tauri::Rect) {
    if let Some(win) = ensure_window(app) {
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
    let visible = app
        .get_webview_window("main")
        .and_then(|w| w.is_visible().ok())
        .unwrap_or(false);
    if visible {
        let _ = app.get_webview_window("main").map(|w| w.hide());
    } else {
        show_under_tray(app, tray_rect);
    }
}

/// Bascule la fenêtre depuis le raccourci clavier : sous l'icône du tray si
/// on connaît sa position, sinon centrée. Les opérations de fenêtre sont
/// forcées sur le thread principal (obligatoire sur macOS).
fn toggle_from_shortcut(app: &tauri::AppHandle) {
    let app = app.clone();
    let _ = app.clone().run_on_main_thread(move || {
        log::info!("toggle_from_shortcut (main thread)");
        if let Some(win) = app.get_webview_window("main") {
            if win.is_visible().unwrap_or(false) {
                let _ = win.hide();
                return;
            }
        }
        let rect = app.state::<TrayRect>().0.lock().unwrap().clone();
        match rect {
            Some(rect) => show_under_tray(&app, rect),
            None => {
                if let Some(win) = ensure_window(&app) {
                    let _ = win.center();
                    let _ = win.show();
                    let _ = win.set_focus();
                }
            }
        }
    });
}

fn ctrl_cmd_m() -> Shortcut {
    Shortcut::new(Some(Modifiers::CONTROL | Modifiers::SUPER), Code::KeyM)
}
fn ctrl_alt_cmd_m() -> Shortcut {
    Shortcut::new(Some(Modifiers::CONTROL | Modifiers::ALT | Modifiers::SUPER), Code::KeyM)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let hk_a = ctrl_cmd_m();
    let hk_b = ctrl_alt_cmd_m();

    let app = tauri::Builder::default()
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        // log fichier (release incluse) : ~/Library/Logs/com.uxteam.musicshare/Music Share.log
        .plugin(tauri_plugin_log::Builder::default().level(log::LevelFilter::Info).build())
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(move |app, sc, event| {
                    if event.state() == ShortcutState::Pressed {
                        let which = if sc == &hk_a {
                            "⌃⌘M"
                        } else if sc == &hk_b {
                            "⌃⌥⌘M"
                        } else {
                            "?"
                        };
                        log::info!("shortcut pressed: {which}");
                        if sc == &hk_a || sc == &hk_b {
                            toggle_from_shortcut(app);
                        }
                    }
                })
                .build(),
        )
        .manage(TrayRect(Mutex::new(None)))
        .setup(|app| {
            // TEST : activation « normale » (icône Dock) pour voir si les
            // raccourcis globaux Carbon sont alors livrés à l'app.
            // app.set_activation_policy(ActivationPolicy::Accessory);
            let _ = ActivationPolicy::Accessory; // évite le warning d'import inutilisé

            // fenêtre créée en Rust (pour pouvoir la recréer si elle est détruite)
            build_main_window(&app.handle())?;

            // deux raccourcis globaux (diagnostic) : ⌃⌘M et ⌃⌥⌘M
            for (name, hk) in [("⌃⌘M", ctrl_cmd_m()), ("⌃⌥⌘M", ctrl_alt_cmd_m())] {
                match app.global_shortcut().register(hk) {
                    Ok(_) => log::info!("global shortcut {name} registered OK"),
                    Err(e) => log::error!("global shortcut {name} register FAILED: {e}"),
                }
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
                        QUITTING.store(true, Ordering::SeqCst);
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

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![copy_rich, open_external])
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    app.run(|_app, event| {
        // empêche l'app de se terminer quand sa fenêtre disparaît (sauf « Quit »)
        if let RunEvent::ExitRequested { api, .. } = event {
            if !QUITTING.load(Ordering::SeqCst) {
                log::warn!("ExitRequested intercepté — l'app reste en barre de menus");
                api.prevent_exit();
            }
        }
    });
}
