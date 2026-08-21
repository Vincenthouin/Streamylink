import React from "react";
import ReactDOM from "react-dom/client";
import { fetch as tauriFetch } from "@tauri-apps/plugin-http";
import { setFetch } from "../../src/core/resolver";
import App from "./App";
import "./styles.css";

// Le resolver utilisera le fetch de Tauri (exécuté côté Rust, sans CORS),
// ce qui permet d'appeler directement Qobuz/Deezer/iTunes/Odesli comme le
// faisait le main process Electron.
setFetch((input, init) => tauriFetch(input, init as any));

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
