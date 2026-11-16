import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import "./lib/agent";
import App from "./App";
import { restoreCachedAppearance } from "./lib/appearance";

restoreCachedAppearance();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
