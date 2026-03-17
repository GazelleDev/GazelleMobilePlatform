import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type StyleProp, type ViewStyle } from "react-native";
import Animated, { Easing, interpolate, runOnJS, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCart } from "../src/cart/store";
import {
  buildDefaultCustomization,
  describeCustomization,
  DEFAULT_CUSTOMIZATION,
  getCustomizationDeltaCents,
  getUnitPriceCents,
  isCustomizationOptionSelected,
  normalizeCustomization,
  toCustomizationSelection,
  type CartCustomization
} from "../src/cart/model";
import {
  formatUsd,
  resolveMenuData,
  useMenuQuery,
  type MenuItem,
  type MenuItemCustomizationGroup,
  type MenuItemCustomizationOption
} from "../src/menu/catalog";
import { Chip, uiPalette, uiTypography } from "../src/ui/system";

const MAX_QUANTITY = 20;
const FORCE_LOADING_PREVIEW = false;

function resolveItemId(input: string | string[] | undefined): string | null {
  if (Array.isArray(input)) return resolveItemId(input[0]);
  if (!input || input.trim().length === 0) return null;
  return input;
}

function findMenuItemById(itemId: string | null, items: MenuItem[]): MenuItem | null {
  if (!itemId) return null;
  return items.find((item) => item.id === itemId) ?? null;
}

function OptionChip({
  label,
  active,
  onPress,
  priceDeltaCents
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  priceDeltaCents?: number;
}) {
  return (
    <Chip
      label={priceDeltaCents && priceDeltaCents > 0 ? `${label} +${formatUsd(priceDeltaCents)}` : label}
      active={active}
      onPress={onPress}
    />
  );
}

function updateCustomizationOption(
  customization: CartCustomization,
  group: MenuItemCustomizationGroup,
  option: MenuItemCustomizationOption
): CartCustomization {
  const active = isCustomizationOptionSelected(customization, group.id, option.id);
  const withoutGroup = customization.selectedOptions.filter((selection) => selection.groupId !== group.id);
  const withoutOption = customization.selectedOptions.filter(
    (selection) => !(selection.groupId === group.id && selection.optionId === option.id)
  );

  if (group.selectionType === "single") {
    return normalizeCustomization({
      ...customization,
      selectedOptions: [...withoutGroup, toCustomizationSelection(group, option)]
    });
  }

  if (group.selectionType === "boolean") {
    return normalizeCustomization({
      ...customization,
      selectedOptions: active ? withoutGroup : [...withoutGroup, toCustomizationSelection(group, option)]
    });
  }

  return normalizeCustomization({
    ...customization,
    selectedOptions: active
      ? withoutOption
      : [...customization.selectedOptions, toCustomizationSelection(group, option)]
  });
}

function LoadingBlock({
  width = "100%",
  height,
  radius = 14,
  style
}: {
  width?: number | `${number}%`;
  height: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View
      style={[
        styles.loadingBlock,
        {
          width,
          height,
          borderRadius: radius
        },
        style
      ]}
    />
  );
}

function LoadingSheet() {
  return (
    <View style={styles.backdrop}>
      <View style={styles.sheet}>
        <LoadingSheetBody />
      </View>
    </View>
  );
}

function LoadingSheetBody({
  showHandle = true,
  showHero = false
}: {
  showHandle?: boolean;
  showHero?: boolean;
}) {
  const pulse = useSharedValue(0);

  useEffect(() => {
    pulse.value = withRepeat(withTiming(1, { duration: 820, easing: Easing.inOut(Easing.ease) }), -1, true);
  }, [pulse]);

  const pulseStyle = useAnimatedStyle(() => ({
    opacity: interpolate(pulse.value, [0, 1], [0.52, 1]),
    transform: [{ scale: interpolate(pulse.value, [0, 1], [0.985, 1]) }]
  }));

  return (
    <>
      {showHandle ? (
        <>
          <View style={styles.handleWrap}>
            <View style={styles.handle} />
          </View>
          <View pointerEvents="none" style={styles.topBand} />
        </>
      ) : null}

      <ScrollView bounces={false} showsVerticalScrollIndicator={false} scrollEnabled={false}>
        {showHero ? (
          <View style={styles.heroWrap}>
            <Animated.View style={pulseStyle}>
              <View style={styles.loadingHero}>
                <View style={styles.loadingCupGlow} />
                <View style={styles.loadingCup} />
              </View>
            </Animated.View>
          </View>
        ) : (
          <View style={styles.loadingTopSpacer} />
        )}

        <Animated.View style={[styles.content, pulseStyle]}>
          <LoadingBlock width="68%" height={34} radius={10} />
          <LoadingBlock width="46%" height={18} radius={9} style={styles.loadingMetaBlock} />
          <LoadingBlock width={146} height={46} radius={0} style={styles.loadingButtonBlock} />

          <View style={styles.loadingDescriptionGroup}>
            <LoadingBlock width="88%" height={16} radius={8} />
            <LoadingBlock width="64%" height={16} radius={8} />
          </View>

          <View style={styles.section}>
            <LoadingBlock width={96} height={22} radius={10} />
            <LoadingBlock width="58%" height={14} radius={7} style={styles.loadingSectionBody} />
            <View style={styles.loadingChipRow}>
              <LoadingBlock width={118} height={42} radius={21} />
              <LoadingBlock width={104} height={42} radius={21} />
            </View>
          </View>

          <View style={styles.section}>
            <LoadingBlock width={84} height={22} radius={10} />
            <LoadingBlock width="62%" height={14} radius={7} style={styles.loadingSectionBody} />
            <View style={styles.loadingChipRow}>
              <LoadingBlock width={92} height={42} radius={21} />
              <LoadingBlock width={84} height={42} radius={21} />
              <LoadingBlock width={110} height={42} radius={21} />
            </View>
          </View>
        </Animated.View>
      </ScrollView>

      <Animated.View style={[styles.footer, styles.loadingFooter, pulseStyle]}>
        <LoadingBlock width={0} height={0} style={styles.loadingFooterPrimary} />
        <LoadingBlock width={0} height={0} style={styles.loadingFooterSecondary} />
        <LoadingBlock width={0} height={0} style={styles.loadingFooterTertiary} />
      </Animated.View>
    </>
  );
}

function ProductImage({
  imageUrl,
  onReady
}: {
  imageUrl?: string;
  onReady: () => void;
}) {
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setImageFailed(false);
  }, [imageUrl]);

  useEffect(() => {
    if (!imageUrl) {
      onReady();
    }
  }, [imageUrl, onReady]);

  return (
    <View style={styles.heroImage}>
      {imageUrl && !imageFailed ? (
        <Image
          source={{ uri: imageUrl }}
          style={styles.heroImagePhoto}
          resizeMode="cover"
          onLoadEnd={onReady}
          onError={() => {
            setImageFailed(true);
            onReady();
          }}
        />
      ) : (
        <View style={styles.heroDrink}>
          <Ionicons name="cafe-outline" size={34} color={uiPalette.surfaceStrong} />
        </View>
      )}
    </View>
  );
}

export default function MenuCustomizeModalScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);
  const params = useLocalSearchParams<{ itemId?: string | string[] }>();
  const itemId = useMemo(() => resolveItemId(params.itemId), [params.itemId]);

  const { addItem, itemCount } = useCart();
  const menuQuery = useMenuQuery();
  const menu = resolveMenuData(menuQuery.data);
  const items = useMemo(() => menu.categories.flatMap((category) => category.items), [menu.categories]);
  const item = useMemo(() => findMenuItemById(itemId, items), [itemId, items]);

  const [customization, setCustomization] = useState<CartCustomization>(DEFAULT_CUSTOMIZATION);
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState("");
  const [optionsOffset, setOptionsOffset] = useState(0);
  const [sheetReady, setSheetReady] = useState(false);
  const [loadingOverlayVisible, setLoadingOverlayVisible] = useState(true);
  const transitionProgress = useSharedValue(0);

  useEffect(() => {
    setCustomization(item ? buildDefaultCustomization(item.customizationGroups) : DEFAULT_CUSTOMIZATION);
    setQuantity(1);
    setNotes("");
  }, [item]);

  useEffect(() => {
    setSheetReady(false);
    setLoadingOverlayVisible(true);
    transitionProgress.value = 0;
  }, [item]);

  const mergedCustomization = useMemo(
    () => ({
      ...customization,
      notes
    }),
    [customization, notes]
  );

  const customizationDeltaCents = useMemo(() => getCustomizationDeltaCents(mergedCustomization), [mergedCustomization]);
  const selectedUnitPriceCents = item ? getUnitPriceCents(item.priceCents, mergedCustomization) : 0;
  const totalCents = selectedUnitPriceCents * quantity;
  const customizationPreview = useMemo(
    () => describeCustomization(mergedCustomization, { includeNotes: false, fallback: "" }),
    [mergedCustomization]
  );
  const metaLine = customizationPreview
    ? `${customizationPreview} • ${formatUsd(selectedUnitPriceCents)}`
    : formatUsd(selectedUnitPriceCents);

  const handleHeroReady = useMemo(
    () => () => {
      requestAnimationFrame(() => {
        setSheetReady(true);
      });
    },
    []
  );

  useEffect(() => {
    if (!sheetReady) {
      return;
    }

    transitionProgress.value = withTiming(
      1,
      { duration: 240, easing: Easing.out(Easing.cubic) },
      (finished) => {
        if (finished) {
          runOnJS(setLoadingOverlayVisible)(false);
        }
      }
    );
  }, [sheetReady, transitionProgress]);

  const contentRevealStyle = useAnimatedStyle(() => ({
    opacity: transitionProgress.value,
    transform: [{ translateY: interpolate(transitionProgress.value, [0, 1], [10, 0]) }]
  }));

  const overlayFadeStyle = useAnimatedStyle(() => ({
    opacity: interpolate(transitionProgress.value, [0, 1], [1, 0])
  }));

  function closeModal() {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace("/(tabs)/menu");
  }

  function addSelectedItem() {
    if (!item) return;

    addItem({
      menuItemId: item.id,
      name: item.name,
      basePriceCents: item.priceCents,
      customization: mergedCustomization,
      quantity
    });

    closeModal();
  }

  function scrollToOptions() {
    scrollRef.current?.scrollTo({ y: Math.max(optionsOffset - 24, 0), animated: true });
  }

  if (FORCE_LOADING_PREVIEW || (menuQuery.isLoading && !menuQuery.data)) {
    return <LoadingSheet />;
  }

  if (!menuQuery.isLoading && !item) {
    return (
      <View style={styles.backdrop}>
        <View style={[styles.sheet, styles.centerState]}>
          <View style={styles.handleWrap}>
            <View style={styles.handle} />
          </View>
          <View pointerEvents="none" style={styles.topBand} />
          <Text style={styles.centerTitle}>This item is unavailable.</Text>
          <Text style={styles.centerText}>Return to the menu and choose another drink.</Text>
          <Pressable onPress={closeModal} style={styles.inlinePrimary}>
            <Text style={styles.inlinePrimaryText}>Back to Menu</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.backdrop}>
      <View style={styles.sheet}>
        <View style={styles.handleWrap}>
          <View style={styles.handle} />
        </View>
        <View pointerEvents="none" style={styles.topBand} />

        <Animated.View style={contentRevealStyle}>
          <ScrollView
            ref={scrollRef}
            bounces
            showsVerticalScrollIndicator={false}
            contentInsetAdjustmentBehavior="never"
            contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 16) + 120 }}
          >
            <View style={styles.heroWrap}>
              <ProductImage imageUrl={item?.imageUrl} onReady={handleHeroReady} />
            </View>

            {item ? (
              <View style={styles.content}>
                <Text style={styles.title}>{item.name}</Text>
                <Text style={styles.meta}>{metaLine}</Text>
                <Text style={styles.description}>{item.description}</Text>

                <View onLayout={(event) => setOptionsOffset(event.nativeEvent.layout.y)}>
                  {item.customizationGroups.map((group) => (
                    <View key={group.id} style={styles.section}>
                      <Text style={styles.sectionTitle}>{group.label}</Text>
                      {group.description ? <Text style={styles.sectionBody}>{group.description}</Text> : null}
                      <View style={styles.optionRow}>
                        {group.options.map((option) => (
                          <OptionChip
                            key={option.id}
                            label={option.label}
                            active={isCustomizationOptionSelected(customization, group.id, option.id)}
                            priceDeltaCents={option.priceDeltaCents}
                            onPress={() =>
                              setCustomization((prev) => updateCustomizationOption(prev, group, option))
                            }
                          />
                        ))}
                      </View>
                    </View>
                  ))}

                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Notes</Text>
                    <Text style={styles.sectionBody}>Optional instructions for the barista.</Text>
                    <TextInput
                      value={notes}
                      onChangeText={setNotes}
                      placeholder="No foam, easy ice, half sweet…"
                      placeholderTextColor={uiPalette.textMuted}
                      style={styles.noteInput}
                      multiline
                    />
                  </View>

                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Quantity</Text>
                    <Text style={styles.sectionBody}>Adjust the number before adding the item to your bag.</Text>
                    <View style={styles.quantityRow}>
                      <Pressable
                        style={[styles.stepperButton, quantity <= 1 ? styles.stepperButtonDisabled : null]}
                        onPress={() => setQuantity((prev) => Math.max(prev - 1, 1))}
                        disabled={quantity <= 1}
                      >
                        <Ionicons name="remove" size={18} color={quantity <= 1 ? uiPalette.textMuted : uiPalette.text} />
                      </Pressable>
                      <Text style={styles.quantityValue}>{quantity}</Text>
                      <Pressable
                        style={[styles.stepperButton, quantity >= MAX_QUANTITY ? styles.stepperButtonDisabled : null]}
                        onPress={() => setQuantity((prev) => Math.min(prev + 1, MAX_QUANTITY))}
                        disabled={quantity >= MAX_QUANTITY}
                      >
                        <Ionicons name="add" size={18} color={quantity >= MAX_QUANTITY ? uiPalette.textMuted : uiPalette.text} />
                      </Pressable>
                    </View>
                  </View>
                </View>

                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Customization</Text>
                  <Text style={styles.summaryValue}>{formatUsd(customizationDeltaCents)}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Total</Text>
                  <Text style={styles.summaryValueStrong}>{formatUsd(totalCents)}</Text>
                </View>
              </View>
            ) : null}
          </ScrollView>
        </Animated.View>

        <Animated.View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }, contentRevealStyle]}>
          <Pressable onPress={addSelectedItem} style={styles.addButton}>
            <Text style={styles.addButtonText}>{`Add ${formatUsd(totalCents)}`}</Text>
          </Pressable>
          <Pressable onPress={() => router.push("/cart")} style={styles.footerDarkButton}>
            <Text style={styles.footerDarkButtonText}>{itemCount > 0 ? `Bag ${itemCount}` : "Bag"}</Text>
          </Pressable>
          <Pressable onPress={scrollToOptions} style={styles.footerDarkButton}>
            <Text style={styles.footerDarkButtonText}>{String(quantity)}</Text>
          </Pressable>
        </Animated.View>

        {loadingOverlayVisible ? (
          <Animated.View pointerEvents="auto" style={[styles.loadingOverlay, overlayFadeStyle]}>
            <LoadingSheetBody showHandle={false} />
          </Animated.View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "transparent"
  },
  sheet: {
    flex: 1,
    backgroundColor: "rgba(246, 247, 244, 0.98)",
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    borderWidth: 1,
    borderColor: uiPalette.border,
    overflow: "hidden"
  },
  centerState: {
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 28
  },
  centerTitle: {
    fontSize: 30,
    lineHeight: 36,
    color: uiPalette.text,
    fontFamily: uiTypography.displayFamily,
    fontWeight: "600",
    textAlign: "center"
  },
  centerText: {
    marginTop: 10,
    fontSize: 15,
    lineHeight: 24,
    color: uiPalette.textSecondary,
    textAlign: "center"
  },
  inlinePrimary: {
    marginTop: 18,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: uiPalette.primary
  },
  inlinePrimaryText: {
    color: uiPalette.primaryText,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "600"
  },
  heroWrap: {
    paddingHorizontal: 20,
    paddingTop: 18
  },
  handleWrap: {
    position: "absolute",
    top: 16,
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 10
  },
  topBand: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 36,
    backgroundColor: "rgba(246, 247, 244, 0.98)",
    zIndex: 5
  },
  loadingBlock: {
    backgroundColor: "rgba(219, 216, 207, 0.9)"
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(246, 247, 244, 0.98)",
    zIndex: 8
  },
  loadingHero: {
    height: 420,
    backgroundColor: "#F6D6C8",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden"
  },
  loadingCupGlow: {
    position: "absolute",
    width: 280,
    height: 280,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.28)"
  },
  loadingCup: {
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: "rgba(255,255,255,0.75)"
  },
  loadingTopSpacer: {
    height: 438
  },
  loadingMetaBlock: {
    marginTop: 12
  },
  loadingButtonBlock: {
    marginTop: 18,
    borderWidth: 1,
    borderColor: uiPalette.borderStrong,
    backgroundColor: "rgba(255,255,255,0.72)"
  },
  loadingDescriptionGroup: {
    marginTop: 28,
    gap: 10
  },
  loadingSectionBody: {
    marginTop: 10
  },
  loadingChipRow: {
    marginTop: 18,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10
  },
  handle: {
    width: 38,
    height: 5,
    borderRadius: 999,
    backgroundColor: "rgba(151, 160, 154, 0.52)"
  },
  heroImage: {
    height: 420,
    backgroundColor: "#9BD8FF",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden"
  },
  heroImagePhoto: {
    width: "100%",
    height: "100%"
  },
  heroDrink: {
    width: 126,
    height: 280,
    borderRadius: 30,
    backgroundColor: "rgba(29, 26, 23, 0.68)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.38)"
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 22
  },
  title: {
    fontSize: 22,
    lineHeight: 30,
    letterSpacing: 2.4,
    textTransform: "uppercase",
    color: uiPalette.text,
    fontFamily: uiTypography.displayFamily,
    fontWeight: "600"
  },
  meta: {
    marginTop: 10,
    fontSize: 15,
    lineHeight: 24,
    color: uiPalette.textSecondary
  },
  description: {
    marginTop: 22,
    fontSize: 15,
    lineHeight: 28,
    color: uiPalette.textSecondary
  },
  section: {
    paddingTop: 24,
    paddingBottom: 26,
    borderTopWidth: 1,
    borderTopColor: uiPalette.border
  },
  sectionTitle: {
    fontSize: 18,
    lineHeight: 24,
    color: uiPalette.text,
    fontWeight: "600"
  },
  sectionBody: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 22,
    color: uiPalette.textSecondary
  },
  optionRow: {
    marginTop: 16,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10
  },
  noteInput: {
    marginTop: 14,
    minHeight: 112,
    borderWidth: 1,
    borderColor: uiPalette.border,
    backgroundColor: "rgba(255,255,255,0.56)",
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 15,
    lineHeight: 22,
    color: uiPalette.text,
    textAlignVertical: "top"
  },
  quantityRow: {
    marginTop: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 18
  },
  stepperButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: uiPalette.border,
    backgroundColor: "rgba(255,255,255,0.56)",
    alignItems: "center",
    justifyContent: "center"
  },
  stepperButtonDisabled: {
    opacity: 0.55
  },
  quantityValue: {
    minWidth: 26,
    textAlign: "center",
    fontSize: 20,
    lineHeight: 24,
    color: uiPalette.text,
    fontWeight: "600"
  },
  summaryRow: {
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: uiPalette.border,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  summaryLabel: {
    fontSize: 14,
    lineHeight: 20,
    color: uiPalette.textSecondary
  },
  summaryValue: {
    fontSize: 14,
    lineHeight: 20,
    color: uiPalette.text,
    fontWeight: "600"
  },
  summaryValueStrong: {
    fontSize: 18,
    lineHeight: 22,
    color: uiPalette.text,
    fontWeight: "700"
  },
  footer: {
    position: "absolute",
    left: 20,
    right: 20,
    bottom: 0,
    paddingTop: 12,
    flexDirection: "row",
    gap: 10,
    backgroundColor: uiPalette.background
  },
  loadingFooter: {
    zIndex: 3
  },
  loadingFooterPrimary: {
    flex: 1,
    minHeight: 56,
    borderWidth: 1,
    borderColor: uiPalette.borderStrong,
    backgroundColor: "rgba(255,255,255,0.72)"
  },
  loadingFooterSecondary: {
    width: 72,
    minHeight: 56,
    backgroundColor: "rgba(29, 26, 23, 0.9)"
  },
  loadingFooterTertiary: {
    width: 72,
    minHeight: 56,
    backgroundColor: "rgba(29, 26, 23, 0.9)"
  },
  addButton: {
    flex: 1,
    minHeight: 56,
    borderWidth: 1,
    borderColor: uiPalette.borderStrong,
    backgroundColor: uiPalette.surfaceStrong,
    alignItems: "center",
    justifyContent: "center"
  },
  addButtonText: {
    fontSize: 17,
    lineHeight: 22,
    color: uiPalette.text,
    fontWeight: "600"
  },
  footerDarkButton: {
    minWidth: 72,
    minHeight: 56,
    backgroundColor: uiPalette.primary,
    alignItems: "center",
    justifyContent: "center"
  },
  footerDarkButtonText: {
    fontSize: 17,
    lineHeight: 22,
    color: uiPalette.primaryText,
    fontWeight: "600"
  }
});
