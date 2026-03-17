import { isLiquidGlassAvailable } from "expo-glass-effect";
import { Platform } from "react-native";
import { ClassicPillTabBar } from "./ClassicPillTabBar";
import { LiquidGlassPillTabBar } from "./LiquidGlassPillTabBar";
import type { PillTabBarProps } from "./pillTabBarShared";

function canUseLiquidGlassDock() {
  if (Platform.OS !== "ios") return false;

  try {
    return isLiquidGlassAvailable();
  } catch {
    return false;
  }
}

export function PillTabBar(props: PillTabBarProps) {
  return canUseLiquidGlassDock() ? <LiquidGlassPillTabBar {...props} /> : <ClassicPillTabBar {...props} />;
}
