import { state, setError } from "./state.js";
import { render } from "./render.js";

export function getDefaultMenuCreateDraft() {
  return {
    categoryId: state.menuCategories[0]?.categoryId ?? "",
    name: "",
    description: "",
    priceCents: "675",
    visible: true
  };
}

export function resetMenuCreateWizard() {
  state.menuCreateWizardOpen = false;
  state.menuCreateWizardStep = 1;
  state.menuCreateDraft = getDefaultMenuCreateDraft();
}

export function openMenuCreateWizard() {
  state.menuCreateWizardOpen = true;
  state.menuCreateWizardStep = 1;
  state.menuCreateDraft = getDefaultMenuCreateDraft();
}

export function reconcileMenuCreateDraft() {
  const fallbackCategoryId = state.menuCategories[0]?.categoryId ?? "";
  if (!state.menuCategories.some((category) => category.categoryId === state.menuCreateDraft.categoryId)) {
    state.menuCreateDraft.categoryId = fallbackCategoryId;
  }
  if (state.menuCategories.length === 0) {
    state.menuCreateWizardOpen = false;
    state.menuCreateWizardStep = 1;
  }
}

export function syncMenuCreateDraft(target: EventTarget | null) {
  if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement)) {
    return;
  }
  const form = target.closest<HTMLFormElement>('form[data-form="menu-create"]');
  if (!form) {
    return;
  }

  if (target.name === "visible" && target instanceof HTMLInputElement) {
    state.menuCreateDraft.visible = target.checked;
    return;
  }
  if (target.name === "categoryId") {
    state.menuCreateDraft.categoryId = target.value;
    return;
  }
  if (target.name === "name") {
    state.menuCreateDraft.name = target.value;
    return;
  }
  if (target.name === "description") {
    state.menuCreateDraft.description = target.value;
    return;
  }
  if (target.name === "priceCents") {
    state.menuCreateDraft.priceCents = target.value;
  }
}

export function advanceMenuCreateWizard() {
  if (state.menuCreateWizardStep === 1) {
    if (!state.menuCreateDraft.categoryId) {
      setError("Choose a menu category before continuing.");
      render();
      return;
    }
    state.menuCreateWizardStep = 2;
  } else if (state.menuCreateWizardStep === 2) {
    if (!state.menuCreateDraft.name.trim()) {
      setError("Add an item name before continuing.");
      render();
      return;
    }
    state.menuCreateWizardStep = 3;
  }
  setError(null);
  render();
}

export function retreatMenuCreateWizard() {
  if (state.menuCreateWizardStep > 1) {
    state.menuCreateWizardStep = (state.menuCreateWizardStep - 1) as 1 | 2 | 3;
    setError(null);
    render();
  }
}
