import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { App } from "./App";
import "./styles.css";
import "./form-fields.css";
import "./tabletop-destruction.css";
import "./combat-polish.css";

const routerBase = import.meta.env.BASE_URL === "/" ? "/" : import.meta.env.BASE_URL.replace(/\/$/, "");

createRoot(document.getElementById("root")!).render(
  <StrictMode><BrowserRouter basename={routerBase}><App /></BrowserRouter></StrictMode>,
);
