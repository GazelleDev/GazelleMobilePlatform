import { renderAuthScreen } from "./views/auth";
import { renderDashboard } from "./views/layout";
import { renderToasts } from "./views/toasts";
import { state } from "./state";
import { setToastRenderHandler } from "./toast-runtime";

const appRoot = document.querySelector<HTMLDivElement>("#app");
if (!appRoot) {
  throw new Error("Client dashboard root element was not found.");
}

export const root: HTMLDivElement = appRoot;

export function render() {
  const prevRail = root.querySelector<HTMLElement>(".dash-store-summary__rail");
  const prevIndex = prevRail?.style.getPropertyValue("--store-summary-active-index").trim() ?? null;

  root.innerHTML = (state.session ? renderDashboard() : renderAuthScreen()) + renderToasts();

  if (prevIndex !== null) {
    const nextRail = root.querySelector<HTMLElement>(".dash-store-summary__rail");
    if (nextRail) {
      const nextIndex = nextRail.style.getPropertyValue("--store-summary-active-index").trim();
      if (prevIndex !== nextIndex) {
        nextRail.style.setProperty("--store-summary-active-index", prevIndex);
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            nextRail.style.setProperty("--store-summary-active-index", nextIndex);
          });
        });
      }
    }
  }
}

setToastRenderHandler(render);
