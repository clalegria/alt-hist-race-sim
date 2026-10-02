import { createRootRoute } from "@tanstack/react-router";
import { App } from "../App.js";

/** The layout every route renders inside: the top nav and an outlet for the page. */
export const Route = createRootRoute({ component: App });
