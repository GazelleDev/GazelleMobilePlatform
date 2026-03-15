import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import Constants from "expo-constants";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState, type ComponentType, type ReactNode } from "react";
import {
  Animated,
  Easing,
  PanResponder,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCart } from "../../src/cart/store";
import { formatUsd, resolveMenuData, useMenuQuery, type MenuCategory, type MenuItem } from "../../src/menu/catalog";
import { Button, Card, GlassCard, ScreenBackdrop, SectionLabel, TitleBlock, uiPalette } from "../../src/ui/system";

type LiquidGlassViewProps = {
  children: ReactNode;
  style: {
    width?: number | "100%";
    height?: number | "100%";
    borderRadius: number;
    overflow: "hidden";
  };
  effect?: "clear" | "regular" | "none";
  colorScheme?: "light" | "dark" | "system";
};

const isExpoGo = Constants.appOwnership === "expo";
const CUSTOMIZE_BUTTON_HEIGHT = 46;
const CATEGORY_SELECTOR_HEIGHT = 44;
const CATEGORY_SELECTOR_INSET = 3;

function renderGlassPill(children: ReactNode) {
  if (Platform.OS === "ios" && !isExpoGo) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { LiquidGlassView, isLiquidGlassSupported } = require("@callstack/liquid-glass") as {
        LiquidGlassView: ComponentType<LiquidGlassViewProps>;
        isLiquidGlassSupported: boolean;
      };
      if (isLiquidGlassSupported) {
        return (
          <LiquidGlassView effect="regular" colorScheme="system" style={{ width: "100%", height: "100%", borderRadius: 999, overflow: "hidden" }}>
            <View style={styles.customizeGlassSurface}>{children}</View>
          </LiquidGlassView>
        );
      }
    } catch (error) {
      void error;
    }
  }
  return (
    <BlurView tint="light" intensity={Platform.OS === "ios" ? 66 : 56} style={styles.customizeBlurFallback}>
      <View style={styles.customizeGlassSurface}>{children}</View>
    </BlurView>
  );
}


type CategoryOption = { id: string; label: string };

const ITEM_WIDTH = 110;
// Extra padding copies on each side so dragging reveals neighbours
const SIDE_COPIES = 2;

function CategorySelector({ options, selectedCategoryId, onSelect }: { options: CategoryOption[]; selectedCategoryId: string; onSelect: (id: string) => void }) {
  const [wrapWidth, setWrapWidth] = useState(0);
  const count = options.length;
  const translateX = useRef(new Animated.Value(0)).current;
  const currentOffset = useRef(0);
  const dragStartX = useRef(0);
  const selectedIndex = Math.max(options.findIndex((o) => o.id === selectedCategoryId), 0);

  // The strip has (SIDE_COPIES * 2 + 1) * count items total.
  // The "real" items sit in the middle block starting at SIDE_COPIES * count.
  const totalItems = (SIDE_COPIES * 2 + 1) * count;

  // Offset so that item at virtualIndex is centered in wrapWidth
  function offsetForVirtualIndex(vIdx: number, containerWidth: number) {
    return containerWidth / 2 - vIdx * ITEM_WIDTH - ITEM_WIDTH / 2;
  }

  // The virtual index of the selected item in the center block
  function centerVirtualIndex(realIndex: number) {
    return SIDE_COPIES * count + realIndex;
  }

  function snapToNearest(rawOffset: number) {
    if (wrapWidth === 0) return;
    const center = wrapWidth / 2;
    // Which virtual index is closest to center?
    const rawVIdx = (center - rawOffset - ITEM_WIDTH / 2) / ITEM_WIDTH;
    const nearestVIdx = Math.round(rawVIdx);
    const snapTarget = offsetForVirtualIndex(nearestVIdx, wrapWidth);
    // Map back to real index
    const realIndex = ((nearestVIdx % count) + count) % count;

    onSelect(options[realIndex].id);
    currentOffset.current = snapTarget;

    Animated.timing(translateX, {
      toValue: snapTarget,
      duration: 800,
      easing: Easing.out(Easing.exp),
      useNativeDriver: true
    }).start(() => {
      // Normalize back to center block after animation so we always
      // have SIDE_COPIES worth of items available on each side
      const normalized = offsetForVirtualIndex(centerVirtualIndex(realIndex), wrapWidth);
      currentOffset.current = normalized;
      translateX.setValue(normalized);
    });
  }

  // Set initial position to center block on mount / wrapWidth change
  useEffect(() => {
    if (wrapWidth === 0) return;
    const target = offsetForVirtualIndex(centerVirtualIndex(selectedIndex), wrapWidth);
    currentOffset.current = target;
    translateX.setValue(target);
  }, [wrapWidth]);

  // Animate when selectedIndex changes externally
  useEffect(() => {
    if (wrapWidth === 0) return;
    const target = offsetForVirtualIndex(centerVirtualIndex(selectedIndex), wrapWidth);
    currentOffset.current = target;
    Animated.timing(translateX, {
      toValue: target,
      duration: 800,
      easing: Easing.out(Easing.exp),
      useNativeDriver: true
    }).start();
  }, [selectedIndex]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 4,
      onPanResponderGrant: () => {
        dragStartX.current = currentOffset.current;
        translateX.stopAnimation();
      },
      onPanResponderMove: (_, g) => {
        translateX.setValue(dragStartX.current + g.dx);
      },
      onPanResponderRelease: (_, g) => {
        snapToNearest(dragStartX.current + g.dx);
      },
      onPanResponderTerminate: (_, g) => {
        snapToNearest(dragStartX.current + g.dx);
      }
    })
  ).current;

  // Build virtual item list: SIDE_COPIES copies before + real items + SIDE_COPIES copies after
  const virtualItems = Array.from({ length: totalItems }, (_, vIdx) => {
    const realIndex = ((vIdx % count) + count) % count;
    return { vIdx, option: options[realIndex] };
  });

  return (
    <View
      style={styles.categorySelectorWrap}
      onLayout={(e) => setWrapWidth(e.nativeEvent.layout.width)}
    >
      <BlurView tint="light" intensity={Platform.OS === "ios" ? 66 : 56} style={StyleSheet.absoluteFillObject} />
      <View pointerEvents="none" style={styles.categorySelectorWindow} />

      <Animated.View
        style={[styles.categorySelectorStrip, { width: totalItems * ITEM_WIDTH, transform: [{ translateX }] }]}
        {...panResponder.panHandlers}
      >
        {virtualItems.map(({ vIdx, option }) => {
          const isActive = option.id === selectedCategoryId;
          return (
            <Pressable
              key={vIdx}
              style={styles.categorySelectorItem}
              onPress={() => snapToNearest(offsetForVirtualIndex(vIdx, wrapWidth))}
            >
              <Text style={[styles.categorySelectorLabel, isActive && styles.categorySelectorLabelActive]}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </Animated.View>

      <View pointerEvents="none" style={styles.categorySelectorFadeLeft} />
      <View pointerEvents="none" style={styles.categorySelectorFadeRight} />
    </View>
  );
}

function resolveItemIcon(item: MenuItem): keyof typeof Ionicons.glyphMap {
  const haystack = `${item.name} ${item.description}`.toLowerCase();

  if (haystack.includes("tea") || haystack.includes("matcha")) {
    return "leaf-outline";
  }

  if (
    haystack.includes("croissant") ||
    haystack.includes("cookie") ||
    haystack.includes("muffin") ||
    haystack.includes("pastry") ||
    haystack.includes("cake")
  ) {
    return "nutrition-outline";
  }

  if (
    haystack.includes("espresso") ||
    haystack.includes("latte") ||
    haystack.includes("coffee") ||
    haystack.includes("cappuccino")
  ) {
    return "cafe-outline";
  }

  return "sparkles-outline";
}

function ItemCard({ item, onCustomize }: { item: MenuItem; onCustomize: (item: MenuItem) => void }) {
  return (
    <Card style={styles.itemCard}>
      <View style={styles.itemTopRow}>
        <View style={styles.itemVisual}>
          <Ionicons name={resolveItemIcon(item)} size={20} color={uiPalette.walnut} />
        </View>
        <View style={styles.itemBody}>
          <View style={styles.itemNameRow}>
            <Text style={styles.itemName}>{item.name}</Text>
            {item.badgeCodes.length > 0 ? (
              <View style={styles.itemNameBadgeRow}>
                {item.badgeCodes.map((badge) => (
                  <View key={badge} style={styles.badgePill}>
                    <Text style={styles.badgeText}>{badge}</Text>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
          <Text style={styles.itemDesc}>{item.description}</Text>
        </View>
        <View style={styles.itemPricePill}>
          <Text style={styles.itemPrice}>{formatUsd(item.priceCents)}</Text>
        </View>
      </View>
      <View style={styles.customizeCtaWrap}>
        {renderGlassPill(
          <Pressable onPress={() => onCustomize(item)} style={({ pressed }) => [styles.customizeButton, pressed ? styles.customizeButtonPressed : null]}>
            <View style={styles.customizeButtonContent}>
              <Text style={styles.customizeButtonText}>Customize</Text>
            </View>
          </Pressable>
        )}
      </View>
    </Card>
  );
}

function CategorySections({ categories, onCustomize }: { categories: MenuCategory[]; onCustomize: (item: MenuItem) => void }) {
  return (
    <View style={{ marginTop: 14, gap: 20 }}>
      {categories.map((category) => (
        <View key={category.id}>
          <SectionLabel label={category.title} />
          <View style={{ marginTop: 8, gap: 10 }}>
            {category.items.map((item) => (
              <ItemCard key={item.id} item={item} onCustomize={onCustomize} />
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}

export default function MenuScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { itemCount } = useCart();
  const menuQuery = useMenuQuery();
  const menu = resolveMenuData(menuQuery.data);
  const categories = menu.categories;

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("all");

  useEffect(() => {
    if (selectedCategoryId === "all") return;
    const exists = categories.some((category) => category.id === selectedCategoryId);
    if (!exists) setSelectedCategoryId("all");
  }, [categories, selectedCategoryId]);

  const searchLower = searchTerm.trim().toLowerCase();
  const categoryOptions = useMemo(
    () => [{ id: "all", label: "All" }, ...categories.map((category) => ({ id: category.id, label: category.title }))],
    [categories]
  );

  const visibleCategories = useMemo(() => {
    const withCategorySelection = selectedCategoryId === "all" ? categories : categories.filter((category) => category.id === selectedCategoryId);
    if (!searchLower) return withCategorySelection;
    return withCategorySelection
      .map((category) => ({
        ...category,
        items: category.items.filter((item) => {
          const haystack = `${item.name} ${item.description} ${item.badgeCodes.join(" ")}`.toLowerCase();
          return haystack.includes(searchLower);
        })
      }))
      .filter((category) => category.items.length > 0);
  }, [categories, searchLower, selectedCategoryId]);

  function openCustomization(item: MenuItem) {
    router.push({ pathname: "/menu-customize", params: { itemId: item.id } });
  }

  return (
    <View style={styles.screen}>
      <ScreenBackdrop />
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={menuQuery.isRefetching}
            onRefresh={() => void menuQuery.refetch()}
            tintColor={uiPalette.primary}
            colors={[uiPalette.primary]}
            progressBackgroundColor={uiPalette.surfaceStrong}
            progressViewOffset={insets.top + 12}
          />
        }
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: insets.top + 14, paddingBottom: Math.max(insets.bottom + 216, 230) }}
      >
        <TitleBlock title="Menu" subtitle="Browse the live collection, shape each item to your taste, and keep pickup moving." />

        <GlassCard style={{ marginTop: 16 }}>
          <SectionLabel label="Curated Menu" />
          <Text style={styles.heroTitle}>Designed for quick pickup and slow coffee moments.</Text>
          <Text style={styles.heroCopy}>
            The menu stays live, the choices stay clear, and customization stays close to the item
            instead of buried later in checkout.
          </Text>
          <View style={styles.heroInfoRow}>
            <View style={styles.heroInfoPill}>
              <Ionicons name="time-outline" size={14} color={uiPalette.accent} />
              <Text style={styles.heroInfoText}>{menuQuery.isLoading ? "Refreshing menu" : "Live availability"}</Text>
            </View>
            <View style={styles.heroInfoPill}>
              <Ionicons name="color-wand-outline" size={14} color={uiPalette.accent} />
              <Text style={styles.heroInfoText}>Made to customize</Text>
            </View>
            <View style={styles.heroInfoPill}>
              <Ionicons name="bag-handle-outline" size={14} color={uiPalette.accent} />
              <Text style={styles.heroInfoText}>{itemCount > 0 ? `${itemCount} in bag` : "Pickup-ready flow"}</Text>
            </View>
          </View>
        </GlassCard>

        <Card style={[styles.searchCard, { marginTop: 14 }]}>
          <SectionLabel label="Find Your Order" />
          <TextInput
            value={searchTerm}
            onChangeText={setSearchTerm}
            autoCapitalize="none"
            placeholder="Search drinks and bites"
            placeholderTextColor={uiPalette.textMuted}
            style={styles.searchInput}
          />
          <CategorySelector options={categoryOptions} selectedCategoryId={selectedCategoryId} onSelect={setSelectedCategoryId} />
        </Card>
        {menuQuery.isLoading ? (
          <Card style={{ marginTop: 14 }} muted><Text style={styles.statusText}>Loading menu...</Text></Card>
        ) : null}
        {menuQuery.error ? (
          <Card style={{ marginTop: 14 }}>
            <Text style={styles.statusText}>Some live menu updates are unavailable right now, but you can still order.</Text>
            <Button label="Retry" variant="ghost" onPress={() => void menuQuery.refetch()} style={{ marginTop: 10, alignSelf: "flex-start" }} />
          </Card>
        ) : null}
        {visibleCategories.length === 0 ? (
          <Card style={{ marginTop: 14 }}><Text style={styles.statusText}>No items match your filters.</Text></Card>
        ) : (
          <CategorySections categories={visibleCategories} onCustomize={openCustomization} />
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: uiPalette.background },
  heroTitle: {
    marginTop: 8,
    fontSize: 28,
    lineHeight: 33,
    fontWeight: "700",
    letterSpacing: -0.8,
    color: uiPalette.text
  },
  heroCopy: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 22,
    color: uiPalette.textSecondary
  },
  heroInfoRow: {
    marginTop: 16,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  heroInfoPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 9,
    backgroundColor: "rgba(255, 248, 240, 0.78)",
    borderWidth: 1,
    borderColor: "rgba(198, 156, 109, 0.18)"
  },
  heroInfoText: {
    fontSize: 12,
    fontWeight: "600",
    color: uiPalette.text
  },
  searchCard: {
    gap: 10
  },
  searchInput: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: uiPalette.border,
    backgroundColor: "rgba(255, 248, 240, 0.84)",
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: uiPalette.text,
    fontSize: 15,
    marginTop: -2
  },
  categorySelectorWrap: {
    width: "100%",
    height: CATEGORY_SELECTOR_HEIGHT,
    borderRadius: 999,
    overflow: "hidden",
    backgroundColor: "rgba(205, 178, 148, 0.3)",
    borderWidth: 1,
    borderColor: "rgba(198, 156, 109, 0.28)",
    shadowColor: uiPalette.walnut,
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3
  },
  categorySelectorWindow: {
    position: "absolute",
    top: CATEGORY_SELECTOR_INSET,
    bottom: CATEGORY_SELECTOR_INSET,
    left: "50%",
    width: ITEM_WIDTH,
    marginLeft: -(ITEM_WIDTH / 2),
    borderRadius: 999,
    backgroundColor: "rgba(255, 248, 240, 0.82)",
    borderWidth: 1,
    borderColor: "rgba(198, 156, 109, 0.26)"
  },
  categorySelectorStrip: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    flexDirection: "row",
    alignItems: "center"
  },
  categorySelectorItem: {
    width: ITEM_WIDTH,
    height: "100%",
    alignItems: "center",
    justifyContent: "center"
  },
  categorySelectorLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: uiPalette.textMuted,
    textAlign: "center"
  },
  categorySelectorLabelActive: {
    color: uiPalette.text,
    fontSize: 13
  },
  categorySelectorFadeLeft: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    width: 48,
    borderTopLeftRadius: 999,
    borderBottomLeftRadius: 999,
    backgroundColor: "rgba(205, 178, 148, 0.0)"
  },
  categorySelectorFadeRight: {
    position: "absolute",
    top: 0,
    bottom: 0,
    right: 0,
    width: 48,
    borderTopRightRadius: 999,
    borderBottomRightRadius: 999,
    backgroundColor: "rgba(205, 178, 148, 0.0)"
  },
  itemCard: { padding: 16 },
  itemTopRow: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  itemVisual: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(198, 156, 109, 0.18)",
    borderWidth: 1,
    borderColor: "rgba(198, 156, 109, 0.24)"
  },
  itemBody: {
    flex: 1
  },
  itemNameRow: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
  itemNameBadgeRow: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
  itemName: { fontSize: 16, fontWeight: "700", color: uiPalette.text },
  itemDesc: { marginTop: 4, fontSize: 13, lineHeight: 19, color: uiPalette.textSecondary },
  itemPricePill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: "rgba(198, 156, 109, 0.18)",
    borderWidth: 1,
    borderColor: "rgba(198, 156, 109, 0.22)"
  },
  itemPrice: { fontSize: 14, fontWeight: "700", color: uiPalette.walnut },
  badgePill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "rgba(198, 156, 109, 0.16)"
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    color: uiPalette.walnut
  },
  customizeCtaWrap: {
    marginTop: 12,
    width: "100%",
    height: CUSTOMIZE_BUTTON_HEIGHT,
    borderRadius: 999,
    overflow: "hidden",
    shadowColor: uiPalette.walnut,
    shadowOpacity: 0.14,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3
  },
  customizeBlurFallback: { width: "100%", height: CUSTOMIZE_BUTTON_HEIGHT, borderRadius: 999, overflow: "hidden" },
  customizeGlassSurface: {
    width: "100%",
    height: "100%",
    borderRadius: 999,
    overflow: "hidden",
    backgroundColor: "rgba(205, 178, 148, 0.3)",
    borderWidth: 1,
    borderColor: "rgba(198, 156, 109, 0.28)"
  },
  customizeButton: {
    width: "100%",
    height: CUSTOMIZE_BUTTON_HEIGHT,
    borderRadius: 999,
    paddingHorizontal: 16,
    backgroundColor: "rgba(255, 248, 240, 0.76)",
    borderWidth: 1,
    borderColor: "rgba(198, 156, 109, 0.24)",
    justifyContent: "center"
  },
  customizeButtonContent: { paddingTop: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingHorizontal: 12 },
  customizeButtonPressed: { opacity: 0.86 },
  customizeButtonText: { color: uiPalette.text, fontSize: 14, lineHeight: 18, fontWeight: "700", letterSpacing: 0.1, textAlign: "center" },
  statusText: { fontSize: 13, lineHeight: 18, color: uiPalette.textSecondary }
});
