import "./styles.css";
import type { AdminMenuCategory, AdminStoreConfig, AppConfig } from "@gazelle/contracts-catalog";
import {
  fetchOperatorSnapshot,
  resolveDefaultApiBaseUrl,
  updateOperatorMenuItem,
  updateOperatorOrderStatus,
  updateOperatorStoreConfig,
  type OperatorSession
} from "./api.js";
import {
  canManageOrderStatus,
  filterOrdersByView,
  formatOrderStatus,
  getAppConfigCapabilityLabels,
  getOrderActions,
  getOrderCustomerLabel,
  isActiveOrder,
  type OperatorOrderFilter,
  type OperatorOrder
} from "./model.js";
import {
  clearStoredSession,
  loadStoredSection,
  loadStoredSession,
  persistSection,
  persistSession
} from "./storage.js";

type DashboardSection = "orders" | "menu" | "store";

type AppState = {
  section: DashboardSection;
  session: OperatorSession | null;
  loading: boolean;
  errorMessage: string | null;
  notice: string | null;
  selectedOrderId: string | null;
  appConfig: AppConfig | null;
  orders: OperatorOrder[];
  orderFilter: OperatorOrderFilter;
  menuCategories: AdminMenuCategory[];
  storeConfig: AdminStoreConfig | null;
  busyOrderId: string | null;
  busyMenuItemId: string | null;
  savingStore: boolean;
  lastRefreshedAt: number | null;
  autoRefreshHandle: ReturnType<typeof setInterval> | null;
  pendingCancelOrderId: string | null;
  pendingCancelTimeoutHandle: ReturnType<typeof setTimeout> | null;
};

const ordersRefreshIntervalMs = 30_000;
const cancelConfirmTimeoutMs = 10_000;

const appRoot = document.querySelector<HTMLDivElement>("#app");
if (!appRoot) {
  throw new Error("Operator root element was not found.");
}
const root: HTMLDivElement = appRoot;

const state: AppState = {
  section: loadStoredSection(),
  session: loadStoredSession(),
  loading: false,
  errorMessage: null,
  notice: null,
  selectedOrderId: null,
  appConfig: null,
  orders: [],
  orderFilter: "active",
  menuCategories: [],
  storeConfig: null,
  busyOrderId: null,
  busyMenuItemId: null,
  savingStore: false,
  lastRefreshedAt: null,
  autoRefreshHandle: null,
  pendingCancelOrderId: null,
  pendingCancelTimeoutHandle: null
};

function escapeHtml(value: string | undefined | null) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatMoney(amountCents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD"
  }).format(amountCents / 100);
}

function formatDateTime(value: string) {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    return value;
  }

  return new Date(parsed).toLocaleString();
}

function setNotice(message: string | null) {
  state.notice = message;
}

function setError(message: string | null) {
  state.errorMessage = message;
}

function getVisibleOrders() {
  return filterOrdersByView(state.orders, state.orderFilter);
}

function renderRefreshMeta() {
  const refreshedLabel =
    state.lastRefreshedAt === null
      ? state.loading
        ? "refreshing..."
        : "not yet refreshed"
      : `refreshed ${Math.max(0, Math.floor((Date.now() - state.lastRefreshedAt) / 1000))}s ago`;

  return `
    <div class="metric-stack">
      <span class="metric">${state.orders.length} total loaded</span>
      <span class="metric">${escapeHtml(refreshedLabel)}</span>
    </div>
  `;
}

function stopAutoRefresh() {
  if (state.autoRefreshHandle !== null) {
    clearInterval(state.autoRefreshHandle);
    state.autoRefreshHandle = null;
  }
}

function startAutoRefresh() {
  if (typeof window === "undefined" || state.autoRefreshHandle !== null) {
    return;
  }

  if (!state.session || state.section !== "orders" || state.loading) {
    return;
  }

  state.autoRefreshHandle = setInterval(() => {
    if (state.section === "orders" && state.session && !state.loading) {
      void loadDashboard();
    }
  }, ordersRefreshIntervalMs);
}

function clearPendingCancel() {
  if (state.pendingCancelTimeoutHandle !== null) {
    clearTimeout(state.pendingCancelTimeoutHandle);
    state.pendingCancelTimeoutHandle = null;
  }

  state.pendingCancelOrderId = null;
}

function armPendingCancel(orderId: string) {
  clearPendingCancel();
  state.pendingCancelOrderId = orderId;
  state.pendingCancelTimeoutHandle = setTimeout(() => {
    if (state.pendingCancelOrderId === orderId) {
      clearPendingCancel();
      render();
    }
  }, cancelConfirmTimeoutMs);
}

function getSelectedOrder() {
  if (state.selectedOrderId) {
    return state.orders.find((order) => order.id === state.selectedOrderId) ?? null;
  }

  return state.orders.find(isActiveOrder) ?? null;
}

function selectOrder(orderId: string | null) {
  clearPendingCancel();
  state.selectedOrderId = orderId;
}

function reconcileSelectedOrder() {
  if (state.selectedOrderId && state.orders.some((order) => order.id === state.selectedOrderId)) {
    return;
  }

  state.selectedOrderId = state.orders.find(isActiveOrder)?.id ?? null;
}

async function loadDashboard() {
  if (!state.session) {
    state.loading = false;
    stopAutoRefresh();
    render();
    return;
  }

  if (state.loading) {
    return;
  }

  state.loading = true;
  setError(null);
  render();

  try {
    const snapshot = await fetchOperatorSnapshot(state.session);
    state.appConfig = snapshot.appConfig;
    state.orders = snapshot.orders;
    state.menuCategories = snapshot.menu.categories;
    state.storeConfig = snapshot.storeConfig;
    state.lastRefreshedAt = Date.now();
    reconcileSelectedOrder();

    if (state.pendingCancelOrderId && !state.orders.some((order) => order.id === state.pendingCancelOrderId)) {
      clearPendingCancel();
    }
  } catch (error) {
    setError(error instanceof Error ? error.message : "Unable to load operator data.");
  } finally {
    state.loading = false;
    startAutoRefresh();
    render();
  }
}

function renderUnlockScreen() {
  const defaultApiBaseUrl = state.session?.apiBaseUrl ?? resolveDefaultApiBaseUrl();

  return `
    <main class="shell shell--locked">
      <section class="hero hero--locked">
        <p class="eyebrow">Gazelle Operator</p>
        <h1>Store controls belong in the browser.</h1>
        <p class="hero-copy">
          This internal console runs order progression, menu editing, and store configuration against the gateway admin routes.
          It is intentionally separate from the customer mobile app.
        </p>
      </section>

      <section class="panel panel--auth">
        <div class="panel-header">
          <p class="eyebrow">Secure Access</p>
          <h2>Connect to the operator workspace</h2>
        </div>

        ${renderMessageBanner()}

        <form data-form="unlock" class="stack-form">
          <label class="field">
            <span>API base URL</span>
            <input name="apiBaseUrl" type="url" value="${escapeHtml(defaultApiBaseUrl)}" placeholder="http://127.0.0.1:8080/v1" required />
          </label>

          <label class="field">
            <span>Staff token</span>
            <input name="staffToken" type="password" placeholder="Paste operator token" required />
          </label>

          <button class="button button--primary" type="submit">Unlock console</button>
        </form>
      </section>
    </main>
  `;
}

function renderMessageBanner() {
  if (!state.errorMessage && !state.notice) {
    return "";
  }

  const toneClass = state.errorMessage ? "banner banner--error" : "banner banner--notice";
  const message = state.errorMessage ?? state.notice ?? "";
  return `<div class="${toneClass}">${escapeHtml(message)}</div>`;
}

function renderRuntimeSummary(appConfig: AppConfig | null) {
  if (!appConfig) {
    return `
      <section class="panel panel--summary">
        <p class="eyebrow">Runtime Config</p>
        <p class="loading-copy">Loading runtime brand and feature configuration…</p>
      </section>
    `;
  }

  const capabilityLabels = getAppConfigCapabilityLabels(appConfig);
  const badges = capabilityLabels.map((label) => `<span class="pill">${escapeHtml(label)}</span>`).join("");

  return `
    <section class="panel panel--summary">
      <div class="panel-header">
        <div>
          <p class="eyebrow">Runtime Config</p>
          <h2>${escapeHtml(appConfig.brand.brandName)}</h2>
          <p class="subtle-copy">${escapeHtml(appConfig.brand.locationName)} · ${escapeHtml(appConfig.brand.marketLabel)}</p>
        </div>
        <div class="metric-stack">
          <span class="metric">${appConfig.loyaltyEnabled ? "Loyalty on" : "Loyalty off"}</span>
          <span class="metric">${appConfig.featureFlags.staffDashboard ? "Staff routes ready" : "Staff routes off"}</span>
          <span class="metric">${appConfig.fulfillment.mode === "staff" ? "Staff fulfillment" : "Time-based fulfillment"}</span>
        </div>
      </div>
      <div class="pill-row">${badges}</div>
    </section>
  `;
}

function renderOrdersSection() {
  const activeOrders = filterOrdersByView(state.orders, "active");
  const completedOrders = filterOrdersByView(state.orders, "completed");
  const visibleOrders = getVisibleOrders();
  const selectedOrder = getSelectedOrder();
  const emptyMessage =
    state.orderFilter === "active"
      ? "No active orders right now."
      : state.orderFilter === "completed"
        ? "No completed or canceled orders are loaded yet."
        : "No orders are loaded yet.";
  const orderRows =
    visibleOrders.length > 0
      ? visibleOrders
          .map(
            (order) => `
            <button class="list-row ${selectedOrder?.id === order.id ? "list-row--selected" : ""}" type="button" data-action="select-order" data-order-id="${order.id}">
              <span>
                <strong>${escapeHtml(order.pickupCode)}</strong>
                <span class="list-subtitle">${escapeHtml(formatOrderStatus(order.status))} · ${escapeHtml(getOrderCustomerLabel(order))}</span>
              </span>
              <span class="list-amount">${formatMoney(order.total.amountCents)}</span>
            </button>
          `
          )
          .join("")
      : `<p class="empty-copy">${escapeHtml(emptyMessage)}</p>`;

  const orderDetail = selectedOrder
    ? renderOrderDetail(selectedOrder, state.appConfig)
    : `<p class="empty-copy">Select an order to inspect its line items and timeline.</p>`;

  return `
    <section class="content-grid content-grid--orders">
      <article class="panel">
        <div class="panel-header">
          <div>
            <p class="eyebrow">Orders</p>
            <h2>${visibleOrders.length} in view</h2>
          </div>
          ${renderRefreshMeta()}
        </div>
        <div class="filter-row">${renderOrderFilterRow(activeOrders.length, completedOrders.length)}</div>
        <div class="list-stack">${orderRows}</div>
      </article>

      <article class="panel">
        ${orderDetail}
      </article>
    </section>
  `;
}

function renderOrderFilterRow(activeOrderCount: number, completedOrderCount: number) {
  return (
    [
      { key: "active", label: "Active", count: activeOrderCount },
      { key: "all", label: "All", count: state.orders.length },
      { key: "completed", label: "Completed", count: completedOrderCount }
    ] as const
  )
    .map(
      (filter) => `
        <button
          class="filter-btn ${state.orderFilter === filter.key ? "filter-btn--active" : ""}"
          type="button"
          data-action="set-order-filter"
          data-order-filter="${filter.key}"
        >
          ${escapeHtml(filter.label)} (${filter.count})
        </button>
      `
    )
    .join("");
}

function renderCancelButton(order: OperatorOrder, manualStatusControlsEnabled: boolean) {
  if (!manualStatusControlsEnabled || order.status === "COMPLETED" || order.status === "CANCELED") {
    return "";
  }

  const disabled = state.busyOrderId === order.id ? "disabled" : "";
  if (state.pendingCancelOrderId === order.id) {
    return `
      <div class="cancel-confirm-row">
        <button
          class="button button--danger"
          type="button"
          data-action="confirm-cancel-order"
          data-order-id="${order.id}"
          ${disabled}
        >
          Confirm cancel
        </button>
        <button
          class="button button--secondary"
          type="button"
          data-action="dismiss-cancel-order"
          data-order-id="${order.id}"
          ${disabled}
        >
          Go back
        </button>
      </div>
    `;
  }

  return `
    <button
      class="button button--danger"
      type="button"
      data-action="cancel-order"
      data-order-id="${order.id}"
      ${disabled}
    >
      Cancel order
    </button>
  `;
}

function renderOrderDetail(order: OperatorOrder, appConfig: AppConfig | null) {
  const manualStatusControlsEnabled = canManageOrderStatus(appConfig);
  const fulfillmentMode = appConfig?.fulfillment.mode ?? "time_based";
  const actions = getOrderActions(order, fulfillmentMode);
  const timeline = order.timeline
    .map(
      (entry) => `
        <div class="timeline-row">
          <strong>${escapeHtml(formatOrderStatus(entry.status))}</strong>
          <span>${escapeHtml(formatDateTime(entry.occurredAt))}</span>
          ${entry.note ? `<p>${escapeHtml(entry.note)}</p>` : ""}
        </div>
      `
    )
    .join("");
  const items = order.items
    .map((item) => {
      const selectedOptions = item.customization?.selectedOptions?.map((option) => option.optionLabel).join(" · ");
      return `
        <div class="line-item">
          <div>
            <strong>${item.quantity}x ${escapeHtml(item.itemName ?? item.itemId)}</strong>
            ${selectedOptions ? `<p>${escapeHtml(selectedOptions)}</p>` : ""}
            ${item.customization?.notes ? `<p>Note: ${escapeHtml(item.customization.notes)}</p>` : ""}
          </div>
          <span>${formatMoney(item.lineTotalCents ?? item.unitPriceCents * item.quantity)}</span>
        </div>
      `;
    })
    .join("");

  const actionButtons = actions
    .map(
      (action) => `
        <button
          class="button ${action.tone === "primary" ? "button--primary" : "button--secondary"}"
          type="button"
          data-action="advance-order"
          data-order-id="${order.id}"
          data-order-status="${action.status}"
          data-order-note="${escapeHtml(action.note ?? "")}"
          ${state.busyOrderId === order.id ? "disabled" : ""}
        >
          ${escapeHtml(action.label)}
        </button>
      `
    )
    .join("");
  const fulfillmentMessage = manualStatusControlsEnabled
    ? ""
    : `<p class="subtle-copy">Time-based fulfillment is active. Manual order status controls are disabled.</p>`;

  return `
    <div class="panel-header">
      <div>
        <p class="eyebrow">Order Detail</p>
        <h2>${escapeHtml(order.pickupCode)}</h2>
        <p class="subtle-copy">${escapeHtml(getOrderCustomerLabel(order))}</p>
      </div>
      <span class="metric">${escapeHtml(formatOrderStatus(order.status))}</span>
    </div>

    <p class="detail-meta">${escapeHtml(order.locationId)} · ${formatMoney(order.total.amountCents)}</p>
    <div class="detail-stack">${items}</div>
    ${fulfillmentMessage}
    <div class="button-row">${actionButtons}${renderCancelButton(order, manualStatusControlsEnabled)}</div>
    <div class="timeline-stack">${timeline}</div>
  `;
}

function renderMenuSection() {
  const categoryCards = state.menuCategories
    .map(
      (category) => `
        <article class="panel">
          <div class="panel-header">
            <div>
              <p class="eyebrow">Menu Category</p>
              <h2>${escapeHtml(category.title)}</h2>
            </div>
            <span class="metric">${category.items.length} items</span>
          </div>
          <div class="card-stack">
            ${category.items
              .map(
                (item) => `
                  <form class="editor-card" data-form="menu-item" data-item-id="${item.itemId}">
                    <div class="editor-card__header">
                      <div>
                        <strong>${escapeHtml(item.name)}</strong>
                        <p>${escapeHtml(item.itemId)}</p>
                      </div>
                      <label class="toggle">
                        <input type="checkbox" name="visible" ${item.visible ? "checked" : ""} />
                        <span>${item.visible ? "Visible" : "Hidden"}</span>
                      </label>
                    </div>

                    <label class="field">
                      <span>Name</span>
                      <input name="name" value="${escapeHtml(item.name)}" required />
                    </label>

                    <label class="field">
                      <span>Price (cents)</span>
                      <input name="priceCents" type="number" min="0" step="1" value="${item.priceCents}" required />
                    </label>

                    <button class="button button--secondary" type="submit" ${state.busyMenuItemId === item.itemId ? "disabled" : ""}>
                      ${state.busyMenuItemId === item.itemId ? "Saving…" : "Save item"}
                    </button>
                  </form>
                `
              )
              .join("")}
          </div>
        </article>
      `
    )
    .join("");

  return categoryCards || `<section class="panel"><p class="empty-copy">No admin menu data is available yet.</p></section>`;
}

function renderStoreSection() {
  const storeConfig = state.storeConfig;
  if (!storeConfig) {
    return `<section class="panel"><p class="loading-copy">Loading store configuration…</p></section>`;
  }

  return `
    <section class="panel panel--store">
      <div class="panel-header">
        <div>
          <p class="eyebrow">Store Configuration</p>
          <h2>${escapeHtml(storeConfig.storeName)}</h2>
        </div>
        <span class="metric">${escapeHtml(storeConfig.locationId)}</span>
      </div>

      <form class="stack-form" data-form="store-config">
        <label class="field">
          <span>Store name</span>
          <input name="storeName" value="${escapeHtml(storeConfig.storeName)}" required />
        </label>

        <label class="field">
          <span>Hours</span>
          <input name="hours" value="${escapeHtml(storeConfig.hours)}" required />
        </label>

        <label class="field">
          <span>Pickup instructions</span>
          <textarea name="pickupInstructions" rows="4" required>${escapeHtml(storeConfig.pickupInstructions)}</textarea>
        </label>

        <button class="button button--primary" type="submit" ${state.savingStore ? "disabled" : ""}>
          ${state.savingStore ? "Saving…" : "Save store settings"}
        </button>
      </form>
    </section>
  `;
}

function renderDashboard() {
  const brandName = state.appConfig?.brand.brandName ?? "Gazelle";

  return `
    <main class="shell">
      <header class="hero">
        <div>
          <p class="eyebrow">Operator Web App</p>
          <h1>${escapeHtml(brandName)} operations console</h1>
          <p class="hero-copy">
            Progress paid orders, update the live menu, and change store pickup settings from a browser-based internal tool.
          </p>
        </div>

        <div class="hero-actions">
          <button class="button button--secondary" type="button" data-action="refresh" ${state.loading ? "disabled" : ""}>
            ${state.loading ? "Refreshing…" : "Refresh"}
          </button>
          <button class="button button--ghost" type="button" data-action="sign-out">Sign out</button>
        </div>
      </header>

      ${renderMessageBanner()}
      ${renderRuntimeSummary(state.appConfig)}

      <nav class="tab-row" aria-label="Operator sections">
        ${(["orders", "menu", "store"] as DashboardSection[])
          .map(
            (section) => `
              <button class="tab ${state.section === section ? "tab--active" : ""}" type="button" data-action="change-section" data-section="${section}">
                ${escapeHtml(section.toUpperCase())}
              </button>
            `
          )
          .join("")}
      </nav>

      ${
        state.section === "orders"
          ? renderOrdersSection()
          : state.section === "menu"
            ? renderMenuSection()
            : renderStoreSection()
      }
    </main>
  `;
}

function render() {
  root.innerHTML = state.session ? renderDashboard() : renderUnlockScreen();
}

async function handleUnlockSubmit(form: HTMLFormElement) {
  const formData = new FormData(form);
  const nextSession = {
    apiBaseUrl: String(formData.get("apiBaseUrl") ?? resolveDefaultApiBaseUrl()),
    staffToken: String(formData.get("staffToken") ?? "").trim()
  };

  if (!nextSession.staffToken) {
    setError("A staff token is required.");
    render();
    return;
  }

  state.session = nextSession;
  persistSession(nextSession);
  setNotice("Operator session stored locally for this browser.");
  setError(null);
  await loadDashboard();
}

async function handleMenuItemSubmit(form: HTMLFormElement) {
  if (!state.session) {
    return;
  }

  const itemId = form.dataset.itemId;
  if (!itemId) {
    return;
  }

  const formData = new FormData(form);
  const visibleField = form.elements.namedItem("visible");
  const visible = visibleField instanceof HTMLInputElement ? visibleField.checked : false;

  try {
    state.busyMenuItemId = itemId;
    setError(null);
    render();
    await updateOperatorMenuItem(state.session, itemId, {
      name: formData.get("name"),
      priceCents: formData.get("priceCents"),
      visible
    });
    setNotice(`Saved menu item ${itemId}.`);
    await loadDashboard();
  } catch (error) {
    setError(error instanceof Error ? error.message : "Unable to save menu item.");
  } finally {
    state.busyMenuItemId = null;
    render();
  }
}

async function handleStoreSubmit(form: HTMLFormElement) {
  if (!state.session) {
    return;
  }

  const formData = new FormData(form);
  try {
    state.savingStore = true;
    setError(null);
    render();
    await updateOperatorStoreConfig(state.session, {
      storeName: formData.get("storeName"),
      hours: formData.get("hours"),
      pickupInstructions: formData.get("pickupInstructions")
    });
    setNotice("Saved store settings.");
    await loadDashboard();
  } catch (error) {
    setError(error instanceof Error ? error.message : "Unable to save store configuration.");
  } finally {
    state.savingStore = false;
    render();
  }
}

async function handleOrderAdvance(orderId: string, status: "IN_PREP" | "READY" | "COMPLETED" | "CANCELED", note?: string) {
  if (!state.session) {
    return;
  }

  if (!canManageOrderStatus(state.appConfig)) {
    setError("Manual order status controls are disabled while time-based fulfillment is active.");
    render();
    return;
  }

  try {
    state.busyOrderId = orderId;
    clearPendingCancel();
    setError(null);
    render();
    await updateOperatorOrderStatus(state.session, orderId, {
      status,
      note
    });
    setNotice(`Updated order to ${formatOrderStatus(status)}.`);
    await loadDashboard();
  } catch (error) {
    setError(error instanceof Error ? error.message : "Unable to update order.");
  } finally {
    state.busyOrderId = null;
    render();
  }
}

root.addEventListener("submit", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLFormElement)) {
    return;
  }

  event.preventDefault();
  const formType = target.dataset.form;
  if (formType === "unlock") {
    void handleUnlockSubmit(target);
    return;
  }
  if (formType === "menu-item") {
    void handleMenuItemSubmit(target);
    return;
  }
  if (formType === "store-config") {
    void handleStoreSubmit(target);
  }
});

root.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) {
    return;
  }

  const actionElement = target.closest<HTMLElement>("[data-action]");
  if (!actionElement) {
    return;
  }

  const action = actionElement.dataset.action;
  if (action === "refresh") {
    void loadDashboard();
    return;
  }

  if (action === "sign-out") {
    stopAutoRefresh();
    clearPendingCancel();
    clearStoredSession();
    state.session = null;
    state.loading = false;
    state.appConfig = null;
    state.orders = [];
    state.menuCategories = [];
    state.storeConfig = null;
    state.selectedOrderId = null;
    state.lastRefreshedAt = null;
    state.busyOrderId = null;
    state.busyMenuItemId = null;
    state.savingStore = false;
    setError(null);
    setNotice("Signed out of the operator workspace.");
    render();
    return;
  }

  if (action === "change-section") {
    const section = actionElement.dataset.section;
    if (section === "orders" || section === "menu" || section === "store") {
      if (section !== "orders") {
        stopAutoRefresh();
        clearPendingCancel();
      }

      state.section = section;
      persistSection(section);
      render();

      if (section === "orders") {
        startAutoRefresh();
      }
    }
    return;
  }

  if (action === "set-order-filter") {
    const filter = actionElement.dataset.orderFilter;
    if (filter === "all" || filter === "active" || filter === "completed") {
      state.orderFilter = filter;
      render();
    }
    return;
  }

  if (action === "select-order") {
    const orderId = actionElement.dataset.orderId;
    if (orderId) {
      selectOrder(orderId);
      render();
    }
    return;
  }

  if (action === "advance-order") {
    const orderId = actionElement.dataset.orderId;
    const status = actionElement.dataset.orderStatus;
    const note = actionElement.dataset.orderNote;
    if (
      orderId &&
      (status === "IN_PREP" || status === "READY" || status === "COMPLETED" || status === "CANCELED")
    ) {
      void handleOrderAdvance(orderId, status, note);
    }
    return;
  }

  if (action === "cancel-order") {
    const orderId = actionElement.dataset.orderId;
    if (!orderId) {
      return;
    }

    armPendingCancel(orderId);
    render();
    return;
  }

  if (action === "confirm-cancel-order") {
    const orderId = actionElement.dataset.orderId;
    if (!orderId) {
      return;
    }

    clearPendingCancel();
    void handleOrderAdvance(orderId, "CANCELED", "Canceled by staff.");
    return;
  }

  if (action === "dismiss-cancel-order") {
    clearPendingCancel();
    render();
  }
});

render();
if (state.session) {
  void loadDashboard();
}
