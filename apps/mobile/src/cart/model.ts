import type { MenuItemCustomizationGroup, MenuItemCustomizationOption } from "../menu/catalog";

export type CartCustomizationOptionSelection = {
  groupId: string;
  groupLabel: string;
  optionId: string;
  optionLabel: string;
  priceDeltaCents: number;
};

export type CartCustomization = {
  selectedOptions: CartCustomizationOptionSelection[];
  notes?: string;
};

export type CartItemInput = {
  menuItemId: string;
  name: string;
  basePriceCents: number;
  customization: CartCustomization;
  quantity?: number;
};

export type CartItem = {
  lineId: string;
  menuItemId: string;
  name: string;
  basePriceCents: number;
  unitPriceCents: number;
  quantity: number;
  customization: CartCustomization;
};

export type CartPricingSummary = {
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
};

export const DEFAULT_CUSTOMIZATION: CartCustomization = {
  selectedOptions: [],
  notes: ""
};

function compareSelections(a: CartCustomizationOptionSelection, b: CartCustomizationOptionSelection) {
  return a.groupId.localeCompare(b.groupId) || a.optionId.localeCompare(b.optionId);
}

export function normalizeCustomization(input: CartCustomization): CartCustomization {
  const uniqueSelections = new Map<string, CartCustomizationOptionSelection>();
  for (const selection of input.selectedOptions) {
    uniqueSelections.set(`${selection.groupId}:${selection.optionId}`, selection);
  }

  return {
    selectedOptions: Array.from(uniqueSelections.values()).sort(compareSelections),
    notes: input.notes?.trim() ?? ""
  };
}

export function toCustomizationSelection(
  group: Pick<MenuItemCustomizationGroup, "id" | "label">,
  option: Pick<MenuItemCustomizationOption, "id" | "label" | "priceDeltaCents">
): CartCustomizationOptionSelection {
  return {
    groupId: group.id,
    groupLabel: group.label,
    optionId: option.id,
    optionLabel: option.label,
    priceDeltaCents: option.priceDeltaCents
  };
}

export function buildDefaultCustomization(groups: MenuItemCustomizationGroup[]): CartCustomization {
  const selectedOptions = groups.flatMap((group) => {
    const defaultOptions = group.options.filter((option) => option.default);

    if (group.selectionType === "single") {
      const option = defaultOptions[0] ?? (group.required ? group.options[0] : undefined);
      return option ? [toCustomizationSelection(group, option)] : [];
    }

    if (group.selectionType === "boolean") {
      const option = defaultOptions[0];
      return option ? [toCustomizationSelection(group, option)] : [];
    }

    return defaultOptions.map((option) => toCustomizationSelection(group, option));
  });

  return normalizeCustomization({
    selectedOptions,
    notes: ""
  });
}

export function isCustomizationOptionSelected(
  customization: CartCustomization,
  groupId: string,
  optionId: string
): boolean {
  return customization.selectedOptions.some(
    (selection) => selection.groupId === groupId && selection.optionId === optionId
  );
}

export function getCustomizationDeltaCents(customization: CartCustomization): number {
  return customization.selectedOptions.reduce((sum, selection) => sum + selection.priceDeltaCents, 0);
}

export function getUnitPriceCents(basePriceCents: number, customization: CartCustomization): number {
  return basePriceCents + getCustomizationDeltaCents(customization);
}

type CustomizationDescribeOptions = {
  includeNotes?: boolean;
  fallback?: string;
};

export function describeCustomization(
  customization: CartCustomization,
  options: CustomizationDescribeOptions = {}
): string {
  const { includeNotes = true, fallback = "Standard" } = options;
  const normalized = normalizeCustomization(customization);
  const groupedSelections = new Map<string, { label: string; options: string[] }>();

  for (const selection of normalized.selectedOptions) {
    const existing = groupedSelections.get(selection.groupId);
    if (existing) {
      existing.options.push(selection.optionLabel);
      continue;
    }

    groupedSelections.set(selection.groupId, {
      label: selection.groupLabel,
      options: [selection.optionLabel]
    });
  }

  const parts = Array.from(groupedSelections.values()).map((group) => group.options.join(", "));
  if (includeNotes && normalized.notes) {
    parts.push(`note: ${normalized.notes}`);
  }

  return parts.length > 0 ? parts.join(" · ") : fallback;
}

export function toCartLineId(input: CartItemInput): string {
  const customization = normalizeCustomization(input.customization);
  const optionMarker =
    customization.selectedOptions.length > 0
      ? customization.selectedOptions
          .map((selection) => `${selection.groupId}:${selection.optionId}`)
          .join(",")
      : "-";
  const noteMarker = customization.notes && customization.notes.length > 0 ? customization.notes : "-";

  return [input.menuItemId, optionMarker, noteMarker].join("|");
}

export function createCartItem(input: CartItemInput): CartItem {
  const customization = normalizeCustomization(input.customization);
  const quantity = Math.max(1, input.quantity ?? 1);

  return {
    lineId: toCartLineId(input),
    menuItemId: input.menuItemId,
    name: input.name,
    basePriceCents: input.basePriceCents,
    unitPriceCents: getUnitPriceCents(input.basePriceCents, customization),
    quantity,
    customization
  };
}

export function addCartItem(items: CartItem[], input: CartItemInput): CartItem[] {
  const lineId = toCartLineId(input);
  const quantity = Math.max(1, input.quantity ?? 1);
  const existing = items.find((entry) => entry.lineId === lineId);
  if (!existing) {
    return [...items, createCartItem(input)];
  }

  return items.map((entry) =>
    entry.lineId === lineId ? { ...entry, quantity: entry.quantity + quantity } : entry
  );
}

export function setCartItemQuantity(items: CartItem[], lineId: string, quantity: number): CartItem[] {
  if (quantity <= 0) {
    return items.filter((entry) => entry.lineId !== lineId);
  }

  return items.map((entry) => (entry.lineId === lineId ? { ...entry, quantity } : entry));
}

export function removeCartItem(items: CartItem[], lineId: string): CartItem[] {
  return items.filter((entry) => entry.lineId !== lineId);
}

export function calculateSubtotalCents(items: CartItem[]): number {
  return items.reduce((sum, item) => sum + item.unitPriceCents * item.quantity, 0);
}

export function calculateItemCount(items: CartItem[]): number {
  return items.reduce((sum, item) => sum + item.quantity, 0);
}

export function calculateTaxCents(subtotalCents: number, taxRateBasisPoints: number): number {
  return Math.round((subtotalCents * taxRateBasisPoints) / 10_000);
}

export function buildPricingSummary(subtotalCents: number, taxRateBasisPoints: number): CartPricingSummary {
  const taxCents = calculateTaxCents(subtotalCents, taxRateBasisPoints);
  return {
    subtotalCents,
    taxCents,
    totalCents: subtotalCents + taxCents
  };
}
