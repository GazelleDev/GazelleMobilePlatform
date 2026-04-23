import { state } from "../state.js";
import { escapeHtml } from "../ui/format.js";

export function renderMenuCreateWizard() {
  if (!state.menuCreateWizardOpen) {
    return "";
  }

  const selectedCategoryTitle =
    state.menuCategories.find((category) => category.categoryId === state.menuCreateDraft.categoryId)?.title ?? "Unassigned";
  const step = state.menuCreateWizardStep;
  const canGoBack = step > 1;

  return `
    <div class="dash-modal" role="presentation">
      <button
        class="dash-modal__backdrop"
        type="button"
        data-action="close-menu-create-wizard"
        aria-label="Close add menu item wizard"
        ${state.creatingMenuItem ? "disabled" : ""}
      ></button>
      <div class="dash-modal__dialog dash-modal__dialog--wizard" role="dialog" aria-modal="true" aria-labelledby="menu-create-wizard-title">
        <div class="dash-modal__header">
          <div>
            <div class="dash-panel-title">Add menu item</div>
            <h3 class="dash-surface-title" id="menu-create-wizard-title">Create a new menu item</h3>
          </div>
          <button class="button button--ghost" type="button" data-action="close-menu-create-wizard" ${state.creatingMenuItem ? "disabled" : ""}>
            Close
          </button>
        </div>
        <div class="dash-wizard-steps" aria-label="Wizard progress">
          <div class="dash-wizard-step ${step === 1 ? "dash-wizard-step--active" : step > 1 ? "dash-wizard-step--complete" : ""}">
            <span>1</span>
            <strong>Placement</strong>
          </div>
          <div class="dash-wizard-step ${step === 2 ? "dash-wizard-step--active" : step > 2 ? "dash-wizard-step--complete" : ""}">
            <span>2</span>
            <strong>Details</strong>
          </div>
          <div class="dash-wizard-step ${step === 3 ? "dash-wizard-step--active" : ""}">
            <span>3</span>
            <strong>Pricing</strong>
          </div>
        </div>
        <form class="dash-wizard-form" data-form="menu-create">
          ${
            step === 1
              ? `
                  <div class="dash-wizard-body">
                    <label class="field">
                      <span>Category</span>
                      <select name="categoryId" required>
                        ${state.menuCategories
                          .map(
                            (category) =>
                              `<option value="${escapeHtml(category.categoryId)}" ${
                                category.categoryId === state.menuCreateDraft.categoryId ? "selected" : ""
                              }>${escapeHtml(category.title)}</option>`
                          )
                          .join("")}
                      </select>
                    </label>
                    <label class="toggle dash-toggle-inline dash-toggle-inline--wizard">
                      <input type="checkbox" name="visible" ${state.menuCreateDraft.visible ? "checked" : ""} />
                      <span>Make this item visible as soon as it is created</span>
                    </label>
                    <div class="dash-wizard-note">
                      The item will be created inside <strong>${escapeHtml(selectedCategoryTitle)}</strong>.
                    </div>
                  </div>
                `
              : ""
          }
          ${
            step === 2
              ? `
                  <div class="dash-wizard-body dash-wizard-body--stacked">
                    <label class="field">
                      <span>Name</span>
                      <input name="name" placeholder="Honey Cardamom Cold Brew" value="${escapeHtml(state.menuCreateDraft.name)}" required />
                    </label>
                    <label class="field">
                      <span>Description</span>
                      <textarea name="description" rows="4" placeholder="Short item description for the customer menu.">${escapeHtml(state.menuCreateDraft.description)}</textarea>
                    </label>
                  </div>
                `
              : ""
          }
          ${
            step === 3
              ? `
                  <div class="dash-wizard-review">
                    <div class="dash-wizard-body dash-wizard-body--split">
                      <label class="field">
                        <span>Price (cents)</span>
                        <input name="priceCents" type="number" min="0" step="1" value="${escapeHtml(state.menuCreateDraft.priceCents)}" required />
                      </label>
                      <div class="dash-wizard-summary">
                        <div class="dash-panel-title">Review</div>
                        <dl class="dash-wizard-summary-list">
                          <div><dt>Category</dt><dd>${escapeHtml(selectedCategoryTitle)}</dd></div>
                          <div><dt>Name</dt><dd>${escapeHtml(state.menuCreateDraft.name || "Not provided")}</dd></div>
                          <div><dt>Description</dt><dd>${escapeHtml(state.menuCreateDraft.description || "No description")}</dd></div>
                          <div><dt>Price</dt><dd>${escapeHtml(state.menuCreateDraft.priceCents || "0")} cents</dd></div>
                          <div><dt>Visibility</dt><dd>${state.menuCreateDraft.visible ? "Visible" : "Hidden"}</dd></div>
                        </dl>
                      </div>
                    </div>
                  </div>
                `
              : ""
          }
          <div class="dash-wizard-actions">
            <button class="button button--ghost" type="button" data-action="close-menu-create-wizard" ${state.creatingMenuItem ? "disabled" : ""}>
              Cancel
            </button>
            <div class="dash-wizard-actions__group">
              ${
                canGoBack
                  ? `<button class="button button--secondary" type="button" data-action="menu-create-prev" ${state.creatingMenuItem ? "disabled" : ""}>Back</button>`
                  : ""
              }
              ${
                step < 3
                  ? `<button class="button button--primary" type="button" data-action="menu-create-next" ${state.creatingMenuItem ? "disabled" : ""}>Continue</button>`
                  : `<button class="button button--primary" type="submit" ${state.creatingMenuItem ? "disabled" : ""}>${state.creatingMenuItem ? "Creating…" : "Create item"}</button>`
              }
            </div>
          </div>
        </form>
      </div>
    </div>
  `;
}
