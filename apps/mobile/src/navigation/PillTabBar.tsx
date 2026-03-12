import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { useEffect, useMemo, useRef, useState, type ComponentProps, type ReactNode } from "react";
import { Tabs } from "expo-router";
import Constants from "expo-constants";
import { Animated, Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCart } from "../cart/store";

const labelMap: Record<string, string> = {
  home: "Home",
  menu: "Menu",
  cart: "Cart",
  account: "Account"
};

const iconMap: Record<string, keyof typeof Ionicons.glyphMap> = {
  home: "home",
  menu: "cafe",
  cart: "bag",
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
      intensity={Platform.OS === "ios" ? 78 : 62}
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
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { itemCount } = useCart();
  const [tabRowWidth, setTabRowWidth] = useState(0);
  const indicatorTranslateX = useRef(new Animated.Value(0)).current;
  const routeCount = Math.max(state.routes.length, 1);
  const indicatorTrackWidth = Math.max(tabRowWidth - TAB_ROW_HORIZONTAL_PADDING * 2, 0);
  const tabSlotWidth = indicatorTrackWidth / routeCount;
  const indicatorWidth = Math.max(tabSlotWidth - TAB_INDICATOR_INSET * 2, 0);
  const bottomOffset = insets.bottom > 0 ? 22 : 20;
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
                        color={isFocused ? "#1F2937" : "rgba(31, 41, 55, 0.62)"}
                        style={styles.tabIcon}
                      />
                      <Text numberOfLines={1} style={[styles.tabLabel, isFocused ? styles.tabLabelActive : null]}>
                        {label}
                      </Text>
                    </View>

                    {route.name === "cart" && itemCount > 0 ? (
                      <View style={styles.badge}>
                        <Text style={styles.badgeText}>{itemCount > 99 ? "99+" : String(itemCount)}</Text>
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
  container: {
    borderRadius: 999,
    shadowColor: "#1E1E24",
    shadowOpacity: 0.13,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12
  },
  tabRow: {
    height: 70,
    position: "relative",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: "rgba(243, 243, 246, 0.54)",
    backgroundColor: "rgba(213, 214, 219, 0.56)",
    paddingHorizontal: TAB_ROW_HORIZONTAL_PADDING
  },
  activeIndicator: {
    position: "absolute",
    top: 7,
    height: 56,
    borderRadius: 999,
    backgroundColor: "rgba(247, 247, 250, 0.58)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.78)"
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
    color: "rgba(31, 41, 55, 0.64)"
  },
  tabLabelActive: {
    color: "#1F2937"
  },
  badge: {
    position: "absolute",
    top: 8,
    right: 10,
    minWidth: 18,
    height: 18,
    borderRadius: 999,
    backgroundColor: "#007AFF",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 4
  },
  badgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "700"
  }
});
