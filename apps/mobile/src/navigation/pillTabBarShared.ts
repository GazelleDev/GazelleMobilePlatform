import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import type { ComponentProps } from "react";

export type PillTabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>["tabBar"]>>[0];

export const labelMap: Record<string, string> = {
  home: "Home",
  menu: "Menu",
  orders: "Orders",
  account: "Account"
};

export const iconMap: Record<
  string,
  { default: keyof typeof Ionicons.glyphMap; active: keyof typeof Ionicons.glyphMap }
> = {
  home: { default: "home-outline", active: "home" },
  menu: { default: "cafe-outline", active: "cafe" },
  orders: { default: "receipt-outline", active: "receipt" },
  account: { default: "person-outline", active: "person" }
};

export const iconSizeMap: Record<string, number> = {
  menu: 28
};
