import { state } from "../state";
import { escapeHtml } from "../ui/format";

export type HomeState = "loading" | "empty" | "no-connection" | "no-api" | "error" | "all";

const homeStateNames: Exclude<HomeState, "all">[] = ["loading", "empty", "no-connection", "no-api", "error"];

function getHomeState(): HomeState {
  if (typeof window !== "undefined") {
    const previewState = new URLSearchParams(window.location.search).get("homeState");
    if (previewState === "all") {
      return previewState;
    }
    if (previewState && homeStateNames.includes(previewState as Exclude<HomeState, "all">)) {
      return previewState as Exclude<HomeState, "all">;
    }
  }

  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return "no-connection";
  }

  if (state.loading || state.initializing) {
    return "loading";
  }

  if (!state.authApiBaseUrl.trim() || state.errorMessage === "Unable to reach backend.") {
    return "no-api";
  }

  if (state.errorMessage) {
    return "error";
  }

  return "empty";
}

const homeStateContent: Record<Exclude<HomeState, "all">, { icon: string; title: string; copy: string; action?: string }> = {
  loading: {
    icon: "",
    title: "Loading your home",
    copy: "We’re getting the latest store activity ready."
  },
  empty: {
    icon: "—",
    title: "Nothing here yet",
    copy: "Your store activity will appear here once data starts coming in."
  },
  "no-connection": {
    icon: "↯",
    title: "No connection",
    copy: "Check your internet connection, then try again.",
    action: "Try again"
  },
  "no-api": {
    icon: "↗",
    title: "API unavailable",
    copy: "We couldn’t connect to the Nomly API. Try again in a moment.",
    action: "Retry connection"
  },
  error: {
    icon: "!",
    title: "Something went wrong",
    copy: "The Home screen couldn’t load right now. Try again.",
    action: "Try again"
  }
};

export function renderHomeState(
  stateName: Exclude<HomeState, "all">,
  loadingIconPath = "/icons/operator-v3/home.svg"
) {
  const content = homeStateContent[stateName];
  const isLoading = stateName === "loading";
  const copy = stateName === "error" && state.errorMessage ? state.errorMessage : content.copy;
  const iconMarkup = isLoading
    ? '<span class="dash-home-state__loading-icon" aria-hidden="true"></span>'
    : escapeHtml(content.icon);
  const iconStyle = isLoading ? ` style="--dash-loading-icon: url('${loadingIconPath}')"` : "";

  return `
    <article class="dash-home-state dash-home-state--${stateName}" data-home-state="${stateName}" aria-busy="${isLoading}">
      <div class="dash-home-state__icon"${iconStyle} aria-hidden="true">${iconMarkup}</div>
      ${isLoading ? "" : `<h2 class="dash-home-state__title">${escapeHtml(content.title)}</h2>`}
      ${isLoading ? "" : `<p class="dash-home-state__copy">${escapeHtml(copy)}</p>`}
      ${content.action ? '<button class="button button--secondary" type="button" data-action="refresh">' + escapeHtml(content.action) + "</button>" : ""}
    </article>
  `;
}

export function renderOverviewSection() {
  const currentState = getHomeState();
  const states: Exclude<HomeState, "all">[] =
    currentState === "all" ? homeStateNames : [currentState as Exclude<HomeState, "all">];

  return `
    <section class="dash-overview${currentState === "all" ? " dash-overview--preview" : ""}" aria-label="Home">
      ${states.map((stateName) => renderHomeState(stateName)).join("")}
    </section>
  `;
}
