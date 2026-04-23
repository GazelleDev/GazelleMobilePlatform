import { state } from "../state.js";
import { escapeHtml, formatDashboardDate, getOperatorInitials } from "../ui/format.js";
import { filterOrdersByView, getOperatorRoleLabel } from "../model.js";
import {
  isOrderTrackingEnabled,
  isStaffDashboardEnabled
} from "@lattelink/contracts-catalog";
import {
  ensureSectionIsAvailable,
  getAvailableDashboardSections,
  getDashboardSectionLabel
} from "../sections.js";
import { reconcileMenuCreateDraft } from "../menu-wizard.js";
import { renderBanner } from "./common.js";
import { renderOverviewSection } from "./overview.js";
import { renderOrdersSection } from "./orders.js";
import { renderMenuSection } from "./menu.js";
import { renderMenuCreateWizard } from "./menu-wizard.js";
import { renderCardsSection } from "./cards.js";
import { renderStoreSection } from "./store.js";
import { renderTeamSection } from "./team.js";

function renderNavItems() {
  const availableSections = getAvailableDashboardSections();
  const activeOrders = filterOrdersByView(state.orders, "active").length;
  return availableSections
    .map((section) => {
      const badge =
        section === "orders" && activeOrders > 0
          ? `<span class="dash-nav-badge">${activeOrders}</span>`
          : "";
      return `
        <button
          class="dash-nav-item ${state.section === section ? "dash-nav-item--active" : ""}"
          type="button"
          data-action="set-section"
          data-section="${section}"
        >
          <span class="dash-nav-item__content">
            <span class="dash-nav-dot" aria-hidden="true"></span>
            <span>${escapeHtml(getDashboardSectionLabel(section))}</span>
          </span>
          ${badge}
        </button>
      `;
    })
    .join("");
}

function renderDashboardContent() {
  switch (state.section) {
    case "orders":
      return renderOrdersSection();
    case "menu":
      return renderMenuSection();
    case "cards":
      return renderCardsSection();
    case "store":
      return renderStoreSection();
    case "team":
      return renderTeamSection();
    case "overview":
    default:
      return renderOverviewSection();
  }
}

export function renderDashboard() {
  ensureSectionIsAvailable();
  reconcileMenuCreateDraft();
  const locationLabel =
    state.appConfig?.brand.locationName ?? state.storeConfig?.storeName ?? "Operator dashboard";
  const marketLabel = state.appConfig?.brand.marketLabel ?? "Store operations";
  const liveEnabled = isStaffDashboardEnabled(state.appConfig) && isOrderTrackingEnabled(state.appConfig);

  return `
    <div class="dash-shell">
      <aside class="dash-sidebar">
        <div class="dash-logo-area">
          <div class="dash-lockup">
            <span class="dash-wordmark">LatteLink<span> by Nomly</span></span>
          </div>
          <div class="dash-shop-block">
            <div>
              <div class="dash-shop-name">${escapeHtml(locationLabel)}</div>
              <div class="dash-shop-sub">${escapeHtml(marketLabel)} · 1 location</div>
            </div>
            <div class="dash-chevron">▾</div>
          </div>
        </div>

        <nav class="dash-nav" aria-label="Dashboard sections">
          ${renderNavItems()}
        </nav>

        <div class="dash-sidebar-footer">
          <div class="dash-user-row">
            <div class="dash-avatar">${escapeHtml(getOperatorInitials(state.session?.operator.displayName))}</div>
            <div>
              <div class="dash-user-name">${escapeHtml(state.session?.operator.displayName ?? "Operator")}</div>
              <div class="dash-user-role">${escapeHtml(getOperatorRoleLabel(state.session?.operator.role ?? "staff"))}</div>
            </div>
          </div>
          <button class="dash-signout" type="button" data-action="sign-out">Sign out</button>
        </div>
      </aside>

      <div class="dash-main">
        <div class="dash-topbar">
          <div class="dash-page-title">${escapeHtml(getDashboardSectionLabel(state.section))}</div>
          <div class="dash-date">${escapeHtml(formatDashboardDate())}</div>
          <div class="dash-live-pill ${liveEnabled ? "" : "dash-live-pill--muted"}">
            <div class="dash-live-dot"></div>
            ${liveEnabled ? "Live" : "Paused"}
          </div>
        </div>

        <div class="dash-content">
          ${renderBanner()}
          ${renderDashboardContent()}
        </div>
      </div>
      ${renderMenuCreateWizard()}
    </div>
  `;
}
