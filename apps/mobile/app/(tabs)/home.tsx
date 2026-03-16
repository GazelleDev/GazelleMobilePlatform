import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useCallback, useRef } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View, type NativeScrollEvent, type NativeSyntheticEvent } from "react-native";
import Animated, { Extrapolation, interpolate, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { resolveStoreConfigData, useStoreConfigQuery } from "../../src/menu/catalog";
import { TAB_BAR_HEIGHT, getTabBarBottomOffset } from "../../src/navigation/tabBarMetrics";
import { Card, ScreenBackdrop, TabBarDepthBackdrop, uiPalette, uiTypography } from "../../src/ui/system";

const HEADER_TOP_PADDING = 18;
const HEADER_EXPANDED_HEIGHT = 212;
const HEADER_COLLAPSED_HEIGHT = 92;
const DIVIDER_SHADOW_TOP_OVERLAP = 10;
const DIVIDER_SHADOW_HEIGHT = 38;
const HEADER_SNAP_VELOCITY_THRESHOLD = 0.2;
const HEADER_SNAP_EDGE_TOLERANCE = 2;

const HOME_NEWS_ITEMS = [
  {
    label: "NEW DRINK",
    title: "Honey Cardamom Cold Brew",
    body: "Placeholder feature card for a seasonal drink launch with oat foam and orange peel.",
    note: "Available this week only."
  },
  {
    label: "DISCOUNT",
    title: "20% Off After 3 PM",
    body: "Placeholder promo card for an afternoon pickup offer on any handcrafted drink.",
    note: "Weekdays only. In-store pickup."
  },
  {
    label: "HOLIDAY HOURS",
    title: "Adjusted Hours For Memorial Day",
    body: "Placeholder notice for holiday operations so guests can check changes before arriving.",
    note: "Open 8:00 AM to 2:00 PM."
  },
  {
    label: "STORE UPDATE",
    title: "Mobile Orders Resume At 7 AM",
    body: "Placeholder operations card for service changes, maintenance windows, or staffing updates.",
    note: "Thanks for your patience."
  }
] as const;

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const storeConfigQuery = useStoreConfigQuery();
  const storeConfig = resolveStoreConfigData(storeConfigQuery.data);
  const scrollViewRef = useRef<ScrollView | null>(null);
  const scrollY = useSharedValue(0);
  const dockBottom = getTabBarBottomOffset(insets.bottom > 0);
  const contentBottomInset = dockBottom + TAB_BAR_HEIGHT + 24;
  const headerExpandedHeight = insets.top + HEADER_EXPANDED_HEIGHT;
  const headerCollapsedHeight = insets.top + HEADER_COLLAPSED_HEIGHT;
  const headerCollapseDistance = headerExpandedHeight - headerCollapsedHeight;

  const setScrollViewRef = useCallback((node: ScrollView | null) => {
    scrollViewRef.current = node;
  }, []);

  const scrollHandler = useAnimatedScrollHandler((event) => {
    scrollY.value = event.contentOffset.y;
  });

  const headerStyle = useAnimatedStyle(() => ({
    height: interpolate(
      scrollY.value,
      [0, headerCollapseDistance],
      [headerExpandedHeight, headerCollapsedHeight],
      Extrapolation.CLAMP
    )
  }));

  const heroShadowStyle = useAnimatedStyle(() => ({
    top: interpolate(
      scrollY.value,
      [0, headerCollapseDistance],
      [headerExpandedHeight - DIVIDER_SHADOW_TOP_OVERLAP, headerCollapsedHeight - DIVIDER_SHADOW_TOP_OVERLAP],
      Extrapolation.CLAMP
    )
  }));

  const titleStyle = useAnimatedStyle(() => ({
    marginTop: interpolate(scrollY.value, [0, headerCollapseDistance], [14, 6], Extrapolation.CLAMP),
    fontSize: interpolate(scrollY.value, [0, headerCollapseDistance], [40, 28], Extrapolation.CLAMP),
    lineHeight: interpolate(scrollY.value, [0, headerCollapseDistance], [46, 32], Extrapolation.CLAMP),
    letterSpacing: interpolate(scrollY.value, [0, headerCollapseDistance], [-1.4, -0.9], Extrapolation.CLAMP)
  }));

  const subtitleStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, 28, 52], [1, 0.35, 0], Extrapolation.CLAMP),
    height: interpolate(scrollY.value, [0, 52], [28, 0], Extrapolation.CLAMP),
    marginTop: interpolate(scrollY.value, [0, 52], [2, 0], Extrapolation.CLAMP),
    transform: [{ translateY: interpolate(scrollY.value, [0, 52], [0, -8], Extrapolation.CLAMP) }]
  }));

  const pickupMetaStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, 20, 48], [1, 0.28, 0], Extrapolation.CLAMP),
    height: interpolate(scrollY.value, [0, 48], [18, 0], Extrapolation.CLAMP),
    marginBottom: interpolate(scrollY.value, [0, 48], [6, 0], Extrapolation.CLAMP)
  }));

  const menuLinkStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, 18, 42], [1, 0.35, 0], Extrapolation.CLAMP),
    transform: [
      { translateX: interpolate(scrollY.value, [0, 42], [0, 12], Extrapolation.CLAMP) },
      { scale: interpolate(scrollY.value, [0, 42], [1, 0.96], Extrapolation.CLAMP) }
    ]
  }));

  const storeRailStyle = useAnimatedStyle(() => ({
    marginTop: interpolate(scrollY.value, [0, headerCollapseDistance], [28, 14], Extrapolation.CLAMP),
    paddingBottom: interpolate(scrollY.value, [0, headerCollapseDistance], [18, 8], Extrapolation.CLAMP)
  }));

  const storeTitleStyle = useAnimatedStyle(() => ({
    marginTop: interpolate(scrollY.value, [0, headerCollapseDistance], [6, 0], Extrapolation.CLAMP),
    transform: [{ translateY: interpolate(scrollY.value, [0, headerCollapseDistance], [0, -10], Extrapolation.CLAMP) }]
  }));

  const snapHeader = useCallback(
    (offsetY: number, velocityY = 0) => {
      if (offsetY <= HEADER_SNAP_EDGE_TOLERANCE || offsetY >= headerCollapseDistance - HEADER_SNAP_EDGE_TOLERANCE) {
        return;
      }

      let targetOffset = offsetY >= headerCollapseDistance / 2 ? headerCollapseDistance : 0;

      if (velocityY > 0.15) {
        targetOffset = headerCollapseDistance;
      } else if (velocityY < -0.15) {
        targetOffset = 0;
      }

      scrollViewRef.current?.scrollTo({ y: targetOffset, animated: true });
    },
    [headerCollapseDistance]
  );

  const handleScrollEndDrag = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const velocityY = event.nativeEvent.velocity?.y ?? 0;

      if (Math.abs(velocityY) >= HEADER_SNAP_VELOCITY_THRESHOLD) {
        return;
      }

      snapHeader(event.nativeEvent.contentOffset.y, velocityY);
    },
    [snapHeader]
  );

  const handleMomentumScrollEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      snapHeader(event.nativeEvent.contentOffset.y);
    },
    [snapHeader]
  );

  return (
    <View style={styles.screen}>
      <ScreenBackdrop />

      <Animated.ScrollView
        ref={setScrollViewRef}
        showsVerticalScrollIndicator={false}
        onScroll={scrollHandler}
        onScrollEndDrag={handleScrollEndDrag}
        onMomentumScrollEnd={handleMomentumScrollEnd}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl
            refreshing={storeConfigQuery.isRefetching}
            onRefresh={() => void storeConfigQuery.refetch()}
            tintColor={uiPalette.primary}
            colors={[uiPalette.primary]}
            progressBackgroundColor={uiPalette.surfaceStrong}
            progressViewOffset={insets.top + 12}
          />
        }
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: headerExpandedHeight,
            paddingBottom: contentBottomInset
          }
        ]}
      >
        <View style={styles.cardGrid}>
          {HOME_NEWS_ITEMS.map((item) => (
            <Card key={item.title} muted style={styles.newsCard}>
              <View style={styles.newsCardHeader}>
                <View style={styles.newsLabel}>
                  <Text style={styles.newsLabelText}>{item.label}</Text>
                </View>
              </View>

              <View style={styles.newsCopy}>
                <Text style={styles.newsTitle}>{item.title}</Text>
                <Text style={styles.newsBody}>{item.body}</Text>
              </View>

              <Text style={styles.newsNote}>{item.note}</Text>
            </Card>
          ))}
        </View>
      </Animated.ScrollView>

      <Animated.View style={[styles.headerShell, { paddingTop: insets.top + HEADER_TOP_PADDING }, headerStyle]}>
        <View style={styles.hero}>
          <Animated.Text style={[styles.title, titleStyle]}>Gazelle</Animated.Text>
          <Animated.View style={[styles.subtitleWrap, subtitleStyle]}>
            <Text style={styles.subtitle}>Enter Slogan Here.</Text>
          </Animated.View>
        </View>

        <Animated.View style={[styles.storeRail, storeRailStyle]}>
          <View style={styles.storeCopy}>
            <Animated.View style={[styles.pickupMetaWrap, pickupMetaStyle]}>
              <Text style={styles.storeMeta}>{`Estimated pick-up is ${storeConfig.prepEtaMinutes} mins`}</Text>
            </Animated.View>
            <Animated.Text style={[styles.storeTitle, storeTitleStyle]}>ANN ARBOR, MI.</Animated.Text>
          </View>

          <Animated.View style={menuLinkStyle}>
            <Pressable onPress={() => router.push("/(tabs)/menu")} style={styles.inlineLink}>
              <Text style={styles.inlineLinkText}>Menu</Text>
              <Ionicons name="chevron-forward" size={16} color={uiPalette.text} />
            </Pressable>
          </Animated.View>
        </Animated.View>
      </Animated.View>

      <Animated.View pointerEvents="none" style={[styles.heroShadow, heroShadowStyle]}>
        <LinearGradient
          colors={[
            "rgba(0, 0, 0, 0)",
            "rgba(0, 0, 0, 0.012)",
            "rgba(0, 0, 0, 0.038)",
            "rgba(0, 0, 0, 0.01)",
            "rgba(0, 0, 0, 0)"
          ]}
          locations={[0, 0.2, 0.34, 0.5, 1]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={styles.heroShadowGradient}
        />
        <LinearGradient
          colors={[uiPalette.background, "rgba(247, 244, 237, 0)"]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={[styles.heroShadowEdgeFade, styles.heroShadowEdgeFadeLeft]}
        />
        <LinearGradient
          colors={["rgba(247, 244, 237, 0)", uiPalette.background]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={[styles.heroShadowEdgeFade, styles.heroShadowEdgeFadeRight]}
        />
      </Animated.View>

      <TabBarDepthBackdrop />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: uiPalette.background
  },
  scrollContent: {
    paddingHorizontal: 20
  },
  headerShell: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    backgroundColor: uiPalette.background,
    overflow: "hidden",
    justifyContent: "flex-end"
  },
  heroShadow: {
    position: "absolute",
    left: 0,
    right: 0,
    height: DIVIDER_SHADOW_HEIGHT,
    overflow: "hidden"
  },
  heroShadowGradient: {
    ...StyleSheet.absoluteFillObject
  },
  heroShadowEdgeFade: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 42
  },
  heroShadowEdgeFadeLeft: {
    left: 0
  },
  heroShadowEdgeFadeRight: {
    right: 0
  },
  hero: {
    paddingTop: 0
  },
  title: {
    marginTop: 14,
    fontSize: 40,
    lineHeight: 46,
    color: uiPalette.text,
    fontFamily: uiTypography.displayFamily,
    fontWeight: "600",
    letterSpacing: -1.4
  },
  subtitle: {
    marginLeft: 4,
    maxWidth: 340,
    fontSize: 16,
    lineHeight: 26,
    color: uiPalette.textSecondary
  },
  subtitleWrap: {
    overflow: "hidden"
  },
  storeRail: {
    marginTop: 28,
    paddingBottom: 18,
    borderBottomWidth: 1,
    borderBottomColor: uiPalette.border,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 16
  },
  storeCopy: {
    flex: 1
  },
  pickupMetaWrap: {
    overflow: "hidden"
  },
  storeMeta: {
    fontSize: 13,
    lineHeight: 18,
    color: uiPalette.textSecondary
  },
  storeTitle: {
    marginTop: 6,
    fontSize: 19,
    lineHeight: 25,
    letterSpacing: 1.9,
    color: uiPalette.text,
    fontFamily: uiTypography.displayFamily,
    fontWeight: "600"
  },
  inlineLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingBottom: 2
  },
  inlineLinkText: {
    fontSize: 14,
    lineHeight: 18,
    color: uiPalette.text,
    fontWeight: "600"
  },
  cardGrid: {
    paddingTop: 14,
    gap: 14
  },
  newsCard: {
    width: "100%",
    minHeight: 142,
    paddingHorizontal: 18,
    paddingVertical: 18,
    justifyContent: "space-between",
    gap: 18
  },
  newsCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  newsLabel: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: uiPalette.accentSoft
  },
  newsLabelText: {
    fontSize: 11,
    lineHeight: 13,
    letterSpacing: 1.1,
    fontWeight: "700",
    color: uiPalette.textSecondary
  },
  newsCopy: {
    gap: 8
  },
  newsTitle: {
    fontSize: 24,
    lineHeight: 28,
    color: uiPalette.text,
    fontFamily: uiTypography.displayFamily,
    fontWeight: "600",
    letterSpacing: -0.5
  },
  newsBody: {
    fontSize: 15,
    lineHeight: 22,
    color: uiPalette.textSecondary
  },
  newsNote: {
    fontSize: 13,
    lineHeight: 18,
    color: uiPalette.textMuted,
    fontWeight: "500"
  }
});
