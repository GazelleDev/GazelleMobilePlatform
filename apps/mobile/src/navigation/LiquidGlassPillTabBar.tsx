import { Ionicons } from "@expo/vector-icons";
import { GlassView } from "expo-glass-effect";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { findActiveOrder, useOrderHistoryQuery } from "../account/data";
import { useAuthSession } from "../auth/session";
import { useCart } from "../cart/store";
import { formatUsd } from "../menu/catalog";
import { uiPalette, uiShadow, uiTypography } from "../ui/system";
import { getTabBarBottomOffset, TAB_BAR_HEIGHT } from "./tabBarMetrics";
import { iconMap, iconSizeMap, labelMap, type PillTabBarProps } from "./pillTabBarShared";

export function LiquidGlassPillTabBar({ state, descriptors, navigation }: PillTabBarProps) {
  const dragSpringConfig = {
    damping: 22,
    stiffness: 280,
    mass: 0.88
  } as const;
  const pressSpringConfig = {
    damping: 24,
    stiffness: 220,
    mass: 0.94
  } as const;
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { itemCount, subtotalCents } = useCart();
  const { isAuthenticated } = useAuthSession();
  const ordersQuery = useOrderHistoryQuery(isAuthenticated);
  const activeOrder = findActiveOrder(ordersQuery.data ?? []);
  const [tabRowWidth, setTabRowWidth] = useState(0);
  const [dragTargetIndex, setDragTargetIndex] = useState<number | null>(null);
  const indicatorTranslateX = useSharedValue(0);
  const dragStartX = useSharedValue(0);
  const previewIndex = useSharedValue(state.index);
  const dragMorphProgress = useSharedValue(0);
  const dragVelocityInfluence = useSharedValue(0);

  const routeCount = Math.max(state.routes.length, 1);
  const selectorInset = 3;
  const indicatorBaseTop = 3;
  const indicatorBaseHeight = 56;
  const innerWidth = Math.max(tabRowWidth - selectorInset * 2, 0);
  const slotWidth = innerWidth / routeCount;
  const indicatorWidth = Math.max(slotWidth, 0);
  const dockWidth = Math.min(width - 36, 492);
  const dockLeft = Math.max((width - dockWidth) / 2, 18);
  const dockBottom = getTabBarBottomOffset(insets.bottom > 0);
  const cartBottom = dockBottom + 66;
  const activeIndex = dragTargetIndex ?? state.index;

  const getTranslateXForIndex = (index: number) => {
    "worklet";
    return selectorInset + index * slotWidth;
  };
  const maxTranslateX = getTranslateXForIndex(Math.max(routeCount - 1, 0));
  const clampTranslateX = (value: number) => {
    "worklet";
    return Math.min(maxTranslateX, Math.max(selectorInset, value));
  };
  const getIndexForTranslateX = (value: number) => {
    "worklet";
    if (slotWidth <= 0) return state.index;

    return Math.min(routeCount - 1, Math.max(0, Math.round((value - selectorInset) / slotWidth)));
  };
  const setPreviewIndex = (nextIndex: number | null) => {
    setDragTargetIndex((current) => (current === nextIndex ? current : nextIndex));
  };
  const syncIndicatorToIndex = (index: number, config = pressSpringConfig) => {
    if (slotWidth <= 0) return;

    previewIndex.value = index;
    indicatorTranslateX.value = withSpring(getTranslateXForIndex(index), config);
  };
  const navigateToIndex = (nextIndex: number) => {
    const route = state.routes[nextIndex];
    if (!route || nextIndex === state.index) return;

    const event = navigation.emit({
      type: "tabPress",
      target: route.key,
      canPreventDefault: true
    });

    if (!event.defaultPrevented) {
      navigation.navigate(route.name, route.params);
    } else {
      setPreviewIndex(null);
      syncIndicatorToIndex(state.index);
    }
  };
  const indicatorStyle = useAnimatedStyle(() => {
    const velocity = Math.max(-1, Math.min(1, dragVelocityInfluence.value));
    const speed = Math.abs(velocity);
    const dragAmount = dragMorphProgress.value;
    const extraWidth = dragAmount * 12 + speed * 12;
    const extraHeight = dragAmount * 14 + speed * 10;
    const top = indicatorBaseTop - extraHeight / 2;
    const height = indicatorBaseHeight + extraHeight;

    return {
      top,
      height,
      width: indicatorWidth + extraWidth * 2,
      transform: [{ translateX: indicatorTranslateX.value - extraWidth }]
    };
  }, [indicatorWidth]);
  const dragHandleStyle = useAnimatedStyle(
    () => ({
      width: indicatorWidth,
      transform: [{ translateX: indicatorTranslateX.value }]
    }),
    [indicatorWidth]
  );
  const activeIconWindowStyle = useAnimatedStyle(() => {
    const velocity = Math.max(-1, Math.min(1, dragVelocityInfluence.value));
    const speed = Math.abs(velocity);
    const dragAmount = dragMorphProgress.value;
    const extraWidth = dragAmount * 12 + speed * 12;

    return {
      top: indicatorBaseTop,
      height: indicatorBaseHeight,
      width: indicatorWidth + extraWidth * 2,
      transform: [{ translateX: indicatorTranslateX.value - extraWidth }]
    };
  }, [indicatorWidth]);
  const activeIconTrackStyle = useAnimatedStyle(() => {
    const velocity = Math.max(-1, Math.min(1, dragVelocityInfluence.value));
    const speed = Math.abs(velocity);
    const dragAmount = dragMorphProgress.value;
    const extraWidth = dragAmount * 12 + speed * 12;

    return {
      width: tabRowWidth,
      transform: [{ translateX: -indicatorTranslateX.value + extraWidth }]
    };
  }, [tabRowWidth]);
  const dockMotionStyle = useAnimatedStyle(() => {
    if (tabRowWidth <= 0) {
      return {
        transform: [{ translateX: 0 }, { translateY: 0 }, { scaleX: 1 }, { scaleY: 1 }]
      };
    }

    const selectorCenter = indicatorTranslateX.value + indicatorWidth / 2;
    const dockCenter = tabRowWidth / 2;
    const normalized = Math.max(-1, Math.min(1, (selectorCenter - dockCenter) / Math.max(dockCenter, 1)));
    const dragAmount = dragMorphProgress.value;

    return {
      transform: [
        { translateX: normalized * 1.1 * dragAmount },
        { translateY: -1.25 * dragAmount },
        { scaleX: 1 + 0.012 * dragAmount },
        { scaleY: 1 - 0.018 * dragAmount }
      ]
    };
  }, [indicatorWidth, tabRowWidth]);

  const renderIconSlots = (useActiveIcons: boolean) =>
    state.routes.map((route) => {
      const descriptor = descriptors[route.key];
      const label =
        typeof descriptor.options.title === "string" ? descriptor.options.title : labelMap[route.name] ?? route.name;
      const iconNames = iconMap[route.name] ?? { default: "ellipse-outline", active: "ellipse" };
      const iconSize = iconSizeMap[route.name] ?? 24;

      return (
        <View key={`${useActiveIcons ? "active" : "base"}-${route.key}`} style={styles.tabSlot}>
          <View pointerEvents="none" style={styles.tabVisualButton}>
            <View style={styles.tabContent}>
              <View style={styles.tabIconBox}>
                <Ionicons
                  name={useActiveIcons ? iconNames.active : iconNames.default}
                  size={iconSize}
                  color={useActiveIcons ? "rgba(18, 18, 18, 0.94)" : "rgba(38, 38, 44, 0.58)"}
                />
              </View>
              <Text
                numberOfLines={1}
                style={[styles.tabLabel, styles.tabLabelGlass, useActiveIcons ? styles.tabLabelActive : null]}
              >
                {label}
              </Text>
            </View>
          </View>
        </View>
      );
    });

  useEffect(() => {
    if (slotWidth <= 0) return;

    setPreviewIndex(null);
    syncIndicatorToIndex(state.index);
  }, [slotWidth, state.index]);

  const selectorGesture = useMemo(
    () =>
      Gesture.Pan()
        .enabled(slotWidth > 0)
        .maxPointers(1)
        .activeOffsetX([-4, 4])
        .failOffsetY([-12, 12])
        .onTouchesDown(() => {
          previewIndex.value = state.index;
          dragVelocityInfluence.value = 0;
          dragMorphProgress.value = withSpring(1, {
            damping: 20,
            stiffness: 260,
            mass: 0.8
          });
        })
        .onTouchesUp(() => {
          dragVelocityInfluence.value = withSpring(0, {
            damping: 18,
            stiffness: 180,
            mass: 0.9
          });
          dragMorphProgress.value = withSpring(0, {
            damping: 24,
            stiffness: 220,
            mass: 0.9
          });
        })
        .onTouchesCancelled(() => {
          dragVelocityInfluence.value = withSpring(0, {
            damping: 18,
            stiffness: 180,
            mass: 0.9
          });
          dragMorphProgress.value = withSpring(0, {
            damping: 24,
            stiffness: 220,
            mass: 0.9
          });
        })
        .onStart(() => {
          dragStartX.value = indicatorTranslateX.value;
          previewIndex.value = state.index;
        })
        .onUpdate((event) => {
          const nextX = clampTranslateX(dragStartX.value + event.translationX);
          const nextIndex = getIndexForTranslateX(nextX);

          indicatorTranslateX.value = nextX;
          dragVelocityInfluence.value = Math.max(-1, Math.min(1, event.velocityX / 1400));
          if (previewIndex.value !== nextIndex) {
            previewIndex.value = nextIndex;
            runOnJS(setPreviewIndex)(nextIndex);
          }
        })
        .onEnd((event) => {
          const projectedX = clampTranslateX(indicatorTranslateX.value + event.velocityX * 0.06);
          const nextIndex = getIndexForTranslateX(projectedX);
          const nextX = getTranslateXForIndex(nextIndex);

          previewIndex.value = nextIndex;
          indicatorTranslateX.value = withSpring(nextX, dragSpringConfig);
          dragVelocityInfluence.value = withSpring(0, {
            damping: 18,
            stiffness: 180,
            mass: 0.9
          });
          dragMorphProgress.value = withSpring(0, {
            damping: 24,
            stiffness: 220,
            mass: 0.9
          });
          runOnJS(setPreviewIndex)(nextIndex);
          if (nextIndex !== state.index) {
            runOnJS(navigateToIndex)(nextIndex);
          } else {
            runOnJS(setPreviewIndex)(null);
          }
        })
        .onFinalize((_event, success) => {
          if (!success) {
            previewIndex.value = state.index;
            indicatorTranslateX.value = withSpring(getTranslateXForIndex(state.index), dragSpringConfig);
            runOnJS(setPreviewIndex)(null);
          }
          dragVelocityInfluence.value = withSpring(0, {
            damping: 18,
            stiffness: 180,
            mass: 0.9
          });
          dragMorphProgress.value = withSpring(0, {
            damping: 24,
            stiffness: 220,
            mass: 0.9
          });
        }),
    [slotWidth, state.index]
  );

  return (
    <View pointerEvents="box-none" style={[styles.shell, { left: dockLeft, bottom: dockBottom, width: dockWidth }]}>
      {itemCount > 0 ? (
        <Pressable style={[styles.cartShortcut, { bottom: cartBottom }]} onPress={() => router.push("/cart")}>
          <View style={styles.cartIconWrap}>
            <Ionicons name="bag-handle-outline" size={15} color={uiPalette.text} />
          </View>
          <View style={styles.cartText}>
            <Text style={styles.cartEyebrow}>Continue order</Text>
            <Text style={styles.cartLabel}>{`${itemCount} item${itemCount === 1 ? "" : "s"} • ${formatUsd(subtotalCents)}`}</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={uiPalette.text} />
        </Pressable>
      ) : null}

      <Animated.View style={[styles.container, styles.containerGlass, dockMotionStyle]}>
        <View
          style={styles.tabRow}
          onLayout={(event) => {
            setTabRowWidth(event.nativeEvent.layout.width);
          }}
        >
          <View pointerEvents="none" style={styles.glassMergeLayer}>
            <GlassView
              glassEffectStyle="regular"
              colorScheme="auto"
              style={styles.glassBase}
            >
              <View style={styles.dockInnerGlass} />
            </GlassView>
            {indicatorWidth > 0 ? (
              <Animated.View pointerEvents="none" style={[styles.activeIndicator, styles.activeIndicatorGlassShell, indicatorStyle]}>
                <GlassView
                  glassEffectStyle="clear"
                  colorScheme="auto"
                  isInteractive
                  style={styles.activeIndicatorGlassView}
                >
                  <View style={styles.activeIndicatorGlassPill} />
                </GlassView>
              </Animated.View>
            ) : null}
          </View>

          <View pointerEvents="none" style={styles.baseIconRow}>
            {renderIconSlots(false)}
          </View>
          {indicatorWidth > 0 ? (
            <Animated.View pointerEvents="none" style={[styles.activeIconWindow, activeIconWindowStyle]}>
              <Animated.View style={[styles.activeIconTrack, activeIconTrackStyle]}>{renderIconSlots(true)}</Animated.View>
            </Animated.View>
          ) : null}
          {indicatorWidth > 0 ? (
            <GestureDetector gesture={selectorGesture}>
              <Animated.View style={[styles.dragHandle, dragHandleStyle]} />
            </GestureDetector>
          ) : null}

          {state.routes.map((route, index) => {
            const descriptor = descriptors[route.key];
            const isFocused = activeIndex === index;
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

            return (
              <View key={route.key} style={styles.tabSlot}>
                <Pressable
                  onPress={onPress}
                  style={({ pressed }) => [styles.tabButton, pressed ? styles.tabPressed : null]}
                  hitSlop={{ top: 2, bottom: 2, left: 14, right: 14 }}
                  accessibilityRole="tab"
                  accessibilityState={isFocused ? { selected: true } : {}}
                  accessibilityLabel={descriptor.options.tabBarAccessibilityLabel}
                >
                  <View style={styles.tabContent}>
                    <View style={styles.tabIconBox} />
                    <Text numberOfLines={1} style={[styles.tabLabel, styles.tabLabelPlaceholder]}>
                      {label}
                    </Text>
                  </View>
                  {route.name === "orders" && activeOrder ? (
                    <View style={[styles.activityDot, isFocused ? styles.activityDotActive : null]}>
                      <View style={[styles.activityDotInner, isFocused ? styles.activityDotInnerActive : null]} />
                    </View>
                  ) : null}
                </Pressable>
              </View>
            );
          })}
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    position: "absolute",
    overflow: "visible"
  },
  cartShortcut: {
    position: "absolute",
    left: 18,
    right: 18,
    minHeight: 58,
    borderRadius: 20,
    backgroundColor: "rgba(255, 253, 248, 0.94)",
    borderWidth: 1,
    borderColor: "rgba(23,21,19,0.08)",
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    ...uiShadow.dock
  },
  cartIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(23,21,19,0.06)"
  },
  cartText: {
    flex: 1
  },
  cartEyebrow: {
    fontSize: 10,
    lineHeight: 12,
    letterSpacing: 1.1,
    textTransform: "uppercase",
    color: uiPalette.textMuted,
    fontWeight: "700",
    fontFamily: uiTypography.bodyFamily
  },
  cartLabel: {
    marginTop: 2,
    fontSize: 15,
    lineHeight: 18,
    color: uiPalette.text,
    fontWeight: "600",
    fontFamily: uiTypography.bodyFamily
  },
  container: {
    borderRadius: 999,
    shadowColor: "#000000",
    shadowOpacity: 0.06,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4
  },
  containerGlass: {
    shadowOpacity: 0.025,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2
  },
  glassMergeLayer: {
    ...StyleSheet.absoluteFillObject
  },
  glassBase: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 999,
    overflow: "hidden"
  },
  dockInnerGlass: {
    flex: 1,
    borderRadius: 999,
    backgroundColor: "rgba(255, 255, 255, 0.003)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.11)"
  },
  tabRow: {
    minHeight: TAB_BAR_HEIGHT,
    paddingHorizontal: 3,
    paddingVertical: 3,
    flexDirection: "row",
    alignItems: "center"
  },
  activeIndicator: {
    position: "absolute",
    top: 3,
    height: 56,
    zIndex: 1,
    borderRadius: 999
  },
  activeIndicatorGlassShell: {
    shadowColor: "#000000",
    shadowOpacity: 0.02,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
    overflow: "visible"
  },
  activeIndicatorGlassView: {
    flex: 1,
    borderRadius: 999,
    overflow: "hidden"
  },
  activeIndicatorGlassPill: {
    flex: 1,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "transparent",
    backgroundColor: "transparent"
  },
  baseIconRow: {
    ...StyleSheet.absoluteFillObject,
    paddingHorizontal: 3,
    paddingVertical: 3,
    flexDirection: "row",
    alignItems: "center",
    zIndex: 0
  },
  activeIconWindow: {
    position: "absolute",
    borderRadius: 999,
    overflow: "hidden",
    zIndex: 2
  },
  activeIconTrack: {
    position: "absolute",
    top: -3,
    left: 0,
    height: TAB_BAR_HEIGHT,
    paddingHorizontal: 3,
    paddingVertical: 3,
    flexDirection: "row",
    alignItems: "center"
  },
  dragHandle: {
    position: "absolute",
    top: 3,
    height: 56,
    borderRadius: 999,
    zIndex: 4
  },
  tabSlot: {
    flex: 1,
    zIndex: 3,
    alignItems: "stretch",
    justifyContent: "center"
  },
  tabVisualButton: {
    width: "100%",
    minHeight: 58,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6
  },
  tabButton: {
    width: "100%",
    minHeight: 58,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6
  },
  tabContent: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center"
  },
  tabIconBox: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center"
  },
  tabPressed: {
    opacity: 0.78
  },
  tabLabel: {
    width: "100%",
    marginTop: 0,
    fontSize: 12,
    lineHeight: 14,
    color: "rgba(60, 60, 67, 0.72)",
    fontWeight: "500",
    letterSpacing: 0.1,
    textAlign: "center",
    fontFamily: uiTypography.bodyFamily
  },
  tabLabelGlass: {
    color: "rgba(38, 38, 44, 0.58)"
  },
  tabLabelPlaceholder: {
    opacity: 0
  },
  tabLabelActive: {
    color: "rgba(18, 18, 18, 0.96)"
  },
  activityDot: {
    position: "absolute",
    top: 9,
    right: 15,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "rgba(255,255,255,0.94)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(23,21,19,0.08)",
    alignItems: "center",
    justifyContent: "center"
  },
  activityDotActive: {
    backgroundColor: "rgba(23,21,19,0.86)",
    borderColor: "rgba(255,255,255,0.24)"
  },
  activityDotInner: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(18, 18, 18, 0.96)"
  },
  activityDotInnerActive: {
    backgroundColor: "#FFFFFF"
  }
});
