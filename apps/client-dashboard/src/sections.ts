import { state } from "./state.js";
import { getAvailableSections, type DashboardSection } from "./model.js";
import { persistSection } from "./storage.js";

export const dashboardSectionLabels: Record<DashboardSection, string> = {
  overview: "Overview",
  orders: "Orders",
  menu: "Menu",
  cards: "News cards",
  team: "Team",
  store: "Settings"
};

export function getDashboardSectionLabel(section: DashboardSection) {
  return dashboardSectionLabels[section];
}

export function getAvailableDashboardSections() {
  return getAvailableSections(state.session?.operator ?? null, state.appConfig ?? undefined);
}

export function ensureSectionIsAvailable() {
  const availableSections = getAvailableDashboardSections();
  if (!availableSections.includes(state.section)) {
    state.section = availableSections[0] ?? "overview";
    persistSection(state.section);
  }
}
