export const TAB_BAR_HEIGHT = 62;
export const TAB_BAR_BOTTOM_WITH_SAFE_AREA = 22;
export const TAB_BAR_BOTTOM_WITHOUT_SAFE_AREA = 28;

export function getTabBarBottomOffset(hasBottomInset: boolean) {
  return hasBottomInset ? TAB_BAR_BOTTOM_WITH_SAFE_AREA : TAB_BAR_BOTTOM_WITHOUT_SAFE_AREA;
}
