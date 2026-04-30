import { canAccessCapability, type OperatorDiscountCode } from "../model.js";
import { isAllLocationsSelected, state } from "../state.js";
import { escapeHtml, formatDateTime, formatMoney } from "../ui/format.js";
import { renderLocationSelectionNotice, renderSectionHeading } from "./common.js";

function formatDiscountValue(code: OperatorDiscountCode) {
  return code.type === "percent" ? `${code.value}%` : formatMoney(code.value);
}

function formatEligibility(value: OperatorDiscountCode["eligibility"]) {
  switch (value) {
    case "first_order_only":
      return "First order only";
    case "existing_customers_only":
      return "Returning customers only";
    case "everyone":
    default:
      return "Everyone";
  }
}

function toDateTimeInputValue(value: string | undefined) {
  if (!value) {
    return "";
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }
  const local = new Date(parsed.getTime() - parsed.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function renderDiscountRuleFields(code?: OperatorDiscountCode) {
  const type = code?.type ?? "percent";
  const eligibility = code?.eligibility ?? "everyone";
  return `
    <label>
      <span>Name</span>
      <input name="name" value="${escapeHtml(code?.name ?? "")}" placeholder="Launch week 10% off" required />
    </label>
    <label>
      <span>Type</span>
      <select name="type">
        <option value="percent" ${type === "percent" ? "selected" : ""}>Percent off</option>
        <option value="fixed_cents" ${type === "fixed_cents" ? "selected" : ""}>Fixed amount off</option>
      </select>
    </label>
    <label>
      <span>Value ${type === "percent" ? "(percent)" : "(cents)"}</span>
      <input name="value" type="number" min="1" step="1" value="${escapeHtml(code?.value ?? "")}" required />
    </label>
    <label>
      <span>Max discount cents</span>
      <input name="maxDiscountCents" type="number" min="1" step="1" value="${escapeHtml(code?.maxDiscountCents ?? "")}" placeholder="Percent codes only" />
    </label>
    <label>
      <span>Minimum subtotal cents</span>
      <input name="minSubtotalCents" type="number" min="0" step="1" value="${escapeHtml(code?.minSubtotalCents ?? 0)}" />
    </label>
    <label>
      <span>Eligibility</span>
      <select name="eligibility">
        <option value="everyone" ${eligibility === "everyone" ? "selected" : ""}>Everyone</option>
        <option value="first_order_only" ${eligibility === "first_order_only" ? "selected" : ""}>First order only</option>
        <option value="existing_customers_only" ${eligibility === "existing_customers_only" ? "selected" : ""}>Returning customers only</option>
      </select>
    </label>
    <label>
      <span>Max total redemptions</span>
      <input name="maxTotalRedemptions" type="number" min="1" step="1" value="${escapeHtml(code?.maxTotalRedemptions ?? "")}" placeholder="Unlimited" />
    </label>
    <label>
      <span>Starts at</span>
      <input name="startsAt" type="datetime-local" value="${escapeHtml(toDateTimeInputValue(code?.startsAt))}" />
    </label>
    <label>
      <span>Expires at</span>
      <input name="expiresAt" type="datetime-local" value="${escapeHtml(toDateTimeInputValue(code?.expiresAt))}" />
    </label>
    <label class="dash-checkbox-row">
      <input name="oncePerCustomer" type="checkbox" ${code?.oncePerCustomer ? "checked" : ""} />
      <span>Limit to once per customer</span>
    </label>
    <label class="dash-checkbox-row">
      <input name="active" type="checkbox" ${code?.active ?? true ? "checked" : ""} />
      <span>Active</span>
    </label>
  `;
}

function renderCreateDiscountForm(canWrite: boolean) {
  if (!canWrite) {
    return `<article class="dash-surface dash-empty-surface"><p class="muted-copy">Your account can review discount codes, but editing is disabled for this role.</p></article>`;
  }

  return `
    <article class="dash-surface">
      <div class="dash-surface-header">
        <div>
          <h3 class="dash-surface-title">Create discount code</h3>
          <p class="muted-copy">Codes are scoped to the selected store and validated again at payment time.</p>
        </div>
      </div>
      <form class="dash-grid-form" data-form="discount-code-create">
        <label>
          <span>Code</span>
          <input name="code" placeholder="LAUNCH10" required />
        </label>
        ${renderDiscountRuleFields()}
        <div class="dash-form-actions">
          <button class="button button--primary" type="submit" ${state.creatingDiscountCode ? "disabled" : ""}>
            ${state.creatingDiscountCode ? "Creating..." : "Create code"}
          </button>
        </div>
      </form>
    </article>
  `;
}

function renderDiscountCodeRow(code: OperatorDiscountCode, canWrite: boolean) {
  const busy = state.busyDiscountCodeId === code.discountCodeId;
  return `
    <form class="dash-data-row" data-form="discount-code" data-discount-code-id="${escapeHtml(code.discountCodeId)}">
      <div class="dash-data-row__header">
        <div>
          <div class="dash-data-row__title">${escapeHtml(code.code)} · ${escapeHtml(formatDiscountValue(code))}</div>
          <div class="dash-data-row__meta">
            ${escapeHtml(formatEligibility(code.eligibility))}
            · ${code.oncePerCustomer ? "Once per customer" : "Multi-use per customer"}
            · ${code.redeemedCount} redeemed
            · ${code.reservedCount} reserved
          </div>
        </div>
        <span class="dash-status-badge dash-status-badge--${code.active ? "success" : "neutral"}">${code.active ? "Active" : "Inactive"}</span>
      </div>
      <div class="dash-grid-form">
        ${renderDiscountRuleFields(code)}
      </div>
      <div class="dash-data-row__footer">
        <span class="muted-copy">Created ${escapeHtml(formatDateTime(code.createdAt))}${code.expiresAt ? ` · Expires ${escapeHtml(formatDateTime(code.expiresAt))}` : ""}</span>
        ${
          canWrite
            ? `<button class="button button--secondary" type="submit" ${busy ? "disabled" : ""}>${busy ? "Saving..." : "Save"}</button>`
            : ""
        }
      </div>
    </form>
  `;
}

export function renderDiscountsSection() {
  if (isAllLocationsSelected()) {
    return renderLocationSelectionNotice("Select a specific location before managing discount codes.");
  }

  const canRead = canAccessCapability(state.session?.operator ?? null, "menu:read");
  const canWrite = canAccessCapability(state.session?.operator ?? null, "menu:write");
  if (!canRead) {
    return renderLocationSelectionNotice("Discount code management is unavailable for your current role.");
  }

  return `
    <section class="dash-section">
      ${renderSectionHeading({
        eyebrow: "Promotions",
        title: "Discount codes",
        description: "Create checkout codes with redemption caps, customer eligibility, and active windows."
      })}
      ${renderCreateDiscountForm(canWrite)}
      <article class="dash-surface">
        <div class="dash-surface-header">
          <div>
            <h3 class="dash-surface-title">${state.discountCodes.length} configured codes</h3>
            <p class="muted-copy">Reserved codes are held by unpaid checkout attempts and released if payment fails or the order is canceled.</p>
          </div>
        </div>
        <div class="dash-data-list">
          ${
            state.discountCodes.length > 0
              ? state.discountCodes.map((code) => renderDiscountCodeRow(code, canWrite)).join("")
              : `<div class="dash-empty-surface"><p class="muted-copy">No discount codes are configured yet.</p></div>`
          }
        </div>
      </article>
    </section>
  `;
}
