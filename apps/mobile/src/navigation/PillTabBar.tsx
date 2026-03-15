import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { useEffect, useMemo, useRef, useState, type ComponentProps, type ReactNode } from "react";
import { Tabs } from "expo-router";
import { useRouter } from "expo-router";
import Constants from "expo-constants";
import { Animated, Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCart } from "../cart/store";
import { useAuthSession } from "../auth/session";
import { findActiveOrder, useOrderHistoryQuery } from "../account/data";
import { formatUsd } from "../menu/catalog";
import { uiPalette } from "../ui/system";

const labelMap: Record<string, string> = {
  home: "Home",
  menu: "Menu",
  orders: "Orders",
  account: "Account"
};

const iconMap: Record<string, keyof typeof Ionicons.glyphMap> = {
  home: "home",
  menu: "cafe",
  orders: "receipt",
  account: "person"
};

type PillTabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>["tabBar"]>>[0];

type LiquidGlassViewProps = {
  children: ReactNode;
  style: {
    borderRadius: number;
    overflow: "hidden";
  };
  effect?: "clear" | "regular" | "none";
  colorScheme?: "light" | "dark" | "system";
};

const isExpoGo = Constants.appOwnership === "expo";
const TAB_ROW_HORIZONTAL_PADDING = 6;
const TAB_INDICATOR_INSET = 3;

function renderGlassShell(children: ReactNode) {
  if (Platform.OS === "ios" && !isExpoGo) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { LiquidGlassView, isLiquidGlassSupported } = require("@callstack/liquid-glass") as {
        LiquidGlassView: React.ComponentType<LiquidGlassViewProps>;
        isLiquidGlassSupported: boolean;
      };

      if (isLiquidGlassSupported) {
        return (
          <LiquidGlassView
            effect="regular"
            colorScheme="system"
            style={{
              borderRadius: 999,
              overflow: "hidden"
            }}
          >
            {children}
          </LiquidGlassView>
        );
      }
    } catch {
      // Fall through to expo-blur when the native module is unavailable.
    }
  }

  return (
    <BlurView
      tint="light"
      intensity={Platform.OS === "ios" ? 68 : 56}
      style={{
        borderRadius: 999,
        overflow: "hidden"
      }}
    >
      {children}
    </BlurView>
  );
}

export function PillTabBar({ state, descriptors, navigation }: PillTabBarProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { itemCount, subtotalCents } = useCart();
  const { isAuthenticated } = useAuthSession();
  const ordersQuery = useOrderHistoryQuery(isAuthenticated);
  const activeOrder = findActiveOrder(ordersQuery.data ?? []);
  const [tabRowWidth, setTabRowWidth] = useState(0);
  const indicatorTranslateX = useRef(new Animated.Value(0)).current;
  const routeCount = Math.max(state.routes.length, 1);
  const indicatorTrackWidth = Math.max(tabRowWidth - TAB_ROW_HORIZONTAL_PADDING * 2, 0);
  const tabSlotWidth = indicatorTrackWidth / routeCount;
  const indicatorWidth = Math.max(tabSlotWidth - TAB_INDICATOR_INSET * 2, 0);
  const bottomOffset = insets.bottom > 0 ? 22 : 20;
  const cartCtaBottomOffset = bottomOffset + 84;
  const pillWidth = Math.min(width - 30, 560);
  const horizontalOffset = Math.max((width - pillWidth) / 2, 15);
  const indicatorStyle = useMemo(
    () => ({
      width: indicatorWidth,
      transform: [{ translateX: indicatorTranslateX }]
    }),
    [indicatorTranslateX, indicatorWidth]
  );

  useEffect(() => {
    if (tabSlotWidth <= 0) {
      return;
    }

    const toValue = TAB_ROW_HORIZONTAL_PADDING + TAB_INDICATOR_INSET + state.index * tabSlotWidth;
    Animated.spring(indicatorTranslateX, {
      toValue,
      useNativeDriver: true,
      damping: 18,
      stiffness: 240,
      mass: 0.85
    }).start();
  }, [indicatorTranslateX, state.index, tabSlotWidth]);

  return (
    <View
      style={[styles.shell, { bottom: bottomOffset, left: horizontalOffset, width: pillWidth }]}
      pointerEvents="box-none"
    >
      {itemCount > 0 ? (
        <Pressable
          style={[styles.cartShortcut, { bottom: cartCtaBottomOffset }]}
          onPress={() => router.push("/cart")}
        >
          <Ionicons name="bag-check-outline" size={18} color={uiPalette.primaryText} />
          <Text style={styles.cartShortcutText}>{`Go to Cart (${itemCount}) • ${formatUsd(subtotalCents)}`}</Text>
        </Pressable>
      ) : null}

      <View style={styles.container}>
        {renderGlassShell(
          <View
            style={styles.tabRow}
            onLayout={(event) => {
              setTabRowWidth(event.nativeEvent.layout.width);
            }}
          >
            {indicatorWidth > 0 ? <Animated.View pointerEvents="none" style={[styles.activeIndicator, indicatorStyle]} /> : null}
            {state.routes.map((route, index) => {
              const descriptor = descriptors[route.key];
              const isFocused = state.index === index;
              const label =
                typeof descriptor.options.title === "string"
                  ? descriptor.options.title
                  : labelMap[route.name] ?? route.name;

              const onPress = () => {
                const event = navigation.emit({
                  type: "tabPress",
                  target: route.key,
                  canPreventDefault: true
                });

                if (!isFocused && !event.defaultPrevented) {
                  navigation.navigate(route.name, route.params);
                }
              };

              const icon = iconMap[route.name] ?? "ellipse";

              return (
                <View key={route.key} style={styles.tabSlot}>
                  <Pressable
                    style={({ pressed }) => [
                      styles.tabButton,
                      pressed ? styles.tabPressed : null
                    ]}
                    hitSlop={{ top: 2, bottom: 2, left: 18, right: 18 }}
                    pressRetentionOffset={{ top: 4, bottom: 4, left: 20, right: 20 }}
                    onPress={onPress}
                    accessibilityRole="button"
                    accessibilityState={isFocused ? { selected: true } : {}}
                    accessibilityLabel={descriptor.options.tabBarAccessibilityLabel}
                  >
                    <View style={styles.tabContent}>
                      <Ionicons
                        name={icon}
                        size={19}
                        color={isFocused ? uiPalette.text : uiPalette.textMuted}
                        style={styles.tabIcon}
                      />
                      <Text numberOfLines={1} style={[styles.tabLabel, isFocused ? styles.tabLabelActive : null]}>
                        {label}
                      </Text>
                    </View>

                    {route.name === "orders" && activeOrder ? (
                      <View style={styles.activityDot}>
                        <View style={styles.activityDotInner} />
                      </View>
                    ) : null}
                  </Pressable>
                </View>
              );
            })}
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    position: "absolute"
  },
  cartShortcut: {
    position: "absolute",
    left: 28,
    right: 28,
    height: 54,
    borderRadius: 18,
    backgroundColor: uiPalette.primary,
    borderWidth: 1,
    borderColor: "rgba(255, 248, 240, 0.22)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    shadowColor: uiPalette.primary,
    shadowOpacity: 0.24,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8
  },
  cartShortcutText: {
    fontSize: 15,
    fontWeight: "700",
    color: uiPalette.primaryText
  },
  container: {
    borderRadius: 999,
    shadowColor: uiPalette.walnut,
    shadowOpacity: 0.18,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 12
  },
  tabRow: {
    height: 70,
    position: "relative",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: "rgba(198, 156, 109, 0.3)",
    backgroundColor: "rgba(205, 178, 148, 0.32)",
    paddingHorizontal: TAB_ROW_HORIZONTAL_PADDING
  },
  activeIndicator: {
    position: "absolute",
    top: 7,
    height: 56,
    borderRadius: 999,
    backgroundColor: "rgba(255, 248, 240, 0.78)",
    borderWidth: 1,
    borderColor: "rgba(198, 156, 109, 0.28)"
  },
  tabSlot: {
    flex: 1,
    zIndex: 1,
    alignItems: "center",
    justifyContent: "center"
  },
  tabButton: {
    width: "100%",
    height: 56,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center"
  },
  tabContent: {
    alignItems: "center",
    justifyContent: "center",
    minWidth: 0
  },
  tabIcon: {
    marginBottom: 3
  },
  tabPressed: {
    opacity: 0.82
  },
  tabLabel: {
    fontSize: 11,
    lineHeight: 13,
    fontWeight: "700",
    color: uiPalette.textMuted
  },
  tabLabelActive: {
    color: uiPalette.text
  },
  activityDot: {
    position: "absolute",
    top: 8,
    right: 14,
    width: 18,
    height: 18,
    borderRadius: 999,
    backgroundColor: uiPalette.primary,
    justifyContent: "center",
    alignItems: "center"
  },
  activityDotInner: {
    width: 7,
    height: 7,
    borderRadius: 999,
    backgroundColor: "#FFFFFF"
  }
});
