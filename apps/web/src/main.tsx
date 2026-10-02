/*
 * Self-hosted, so a shared static build makes no external request for its type.
 * Latin subsets only: importing the package root ships Cyrillic, Greek and
 * Vietnamese cuts of every weight, which no page here can use.
 */
import "@fontsource-variable/archivo/wght.css";
import "@fontsource/ibm-plex-mono/latin-400.css";
import "@fontsource/ibm-plex-mono/latin-500.css";
import { RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { createAppRouter } from "./router.js";

const root = document.getElementById("root");
if (root === null) {
  throw new Error("index.html is missing its #root element");
}

createRoot(root).render(
  <StrictMode>
    <RouterProvider router={createAppRouter()} />
  </StrictMode>,
);
