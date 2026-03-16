import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCart } from "../src/cart/store";
import {
  DEFAULT_CUSTOMIZATION,
  getCustomizationDeltaCents,
  getUnitPriceCents,
  type CartCustomization
} from "../src/cart/model";
import { formatUsd, resolveMenuData, useMenuQuery, type MenuItem } from "../src/menu/catalog";
import { Chip, uiPalette, uiTypography } from "../src/ui/system";

const MAX_QUANTITY = 20;

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

function ProductImage({ imageUrl }: { imageUrl?: string }) {
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setImageFailed(false);
  }, [imageUrl]);

  return (
    <View style={styles.heroImage}>
      {imageUrl && !imageFailed ? (
        <Image source={{ uri: imageUrl }} style={styles.heroImagePhoto} resizeMode="cover" onError={() => setImageFailed(true)} />
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

  useEffect(() => {
    setCustomization(DEFAULT_CUSTOMIZATION);
    setQuantity(1);
    setNotes("");
  }, [item?.id]);

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
  const metaLine = `${customization.size} • ${customization.milk} milk • ${formatUsd(selectedUnitPriceCents)}`;

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

  if (menuQuery.isLoading && !menuQuery.data) {
    return (
      <View style={[styles.screen, styles.centerState]}>
        <ActivityIndicator color={uiPalette.primary} />
        <Text style={styles.centerText}>Loading item details…</Text>
      </View>
    );
  }

  if (!menuQuery.isLoading && !item) {
    return (
      <View style={[styles.screen, styles.centerState]}>
        <Text style={styles.centerTitle}>This item is unavailable.</Text>
        <Text style={styles.centerText}>Return to the menu and choose another drink.</Text>
        <Pressable onPress={closeModal} style={styles.inlinePrimary}>
          <Text style={styles.inlinePrimaryText}>Back to Menu</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScrollView
        ref={scrollRef}
        bounces
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="never"
        contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 16) + 120 }}
      >
        <View style={[styles.heroWrap, { paddingTop: insets.top + 8 }]}>
          <ProductImage imageUrl={item?.imageUrl} />
          <Pressable onPress={closeModal} style={[styles.closeButton, { top: insets.top + 20 }]}>
            <Ionicons name="close" size={22} color={uiPalette.surfaceStrong} />
          </Pressable>
        </View>

        {item ? (
          <View style={styles.content}>
            <Text style={styles.title}>{item.name}</Text>
            <Text style={styles.meta}>{metaLine}</Text>
            <Pressable onPress={scrollToOptions} style={styles.outlineAction}>
              <Text style={styles.outlineActionText}>Customize</Text>
            </Pressable>

            <Text style={styles.description}>{item.description}</Text>

            <View onLayout={(event) => setOptionsOffset(event.nativeEvent.layout.y)}>
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Size</Text>
                <Text style={styles.sectionBody}>Choose the cup that fits the order.</Text>
                <View style={styles.optionRow}>
                  <OptionChip
                    label="Regular"
                    active={customization.size === "Regular"}
                    onPress={() => setCustomization((prev) => ({ ...prev, size: "Regular" }))}
                  />
                  <OptionChip
                    label="Large"
                    active={customization.size === "Large"}
                    priceDeltaCents={100}
                    onPress={() => setCustomization((prev) => ({ ...prev, size: "Large" }))}
                  />
                </View>
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Milk</Text>
                <Text style={styles.sectionBody}>Keep it classic or switch the texture.</Text>
                <View style={styles.optionRow}>
                  <OptionChip
                    label="Whole"
                    active={customization.milk === "Whole"}
                    onPress={() => setCustomization((prev) => ({ ...prev, milk: "Whole" }))}
                  />
                  <OptionChip
                    label="Oat"
                    active={customization.milk === "Oat"}
                    priceDeltaCents={75}
                    onPress={() => setCustomization((prev) => ({ ...prev, milk: "Oat" }))}
                  />
                  <OptionChip
                    label="Almond"
                    active={customization.milk === "Almond"}
                    priceDeltaCents={75}
                    onPress={() => setCustomization((prev) => ({ ...prev, milk: "Almond" }))}
                  />
                </View>
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Extra shot</Text>
                <Text style={styles.sectionBody}>Add an additional espresso pull when you want more structure.</Text>
                <View style={styles.optionRow}>
                  <OptionChip
                    label="Add shot"
                    active={customization.extraShot}
                    priceDeltaCents={125}
                    onPress={() => setCustomization((prev) => ({ ...prev, extraShot: !prev.extraShot }))}
                  />
                </View>
              </View>

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

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <Pressable onPress={addSelectedItem} style={styles.addButton}>
          <Text style={styles.addButtonText}>{`Add ${formatUsd(totalCents)}`}</Text>
        </Pressable>
        <Pressable onPress={() => router.push("/cart")} style={styles.footerDarkButton}>
          <Text style={styles.footerDarkButtonText}>{itemCount > 0 ? `Bag ${itemCount}` : "Bag"}</Text>
        </Pressable>
        <Pressable onPress={scrollToOptions} style={styles.footerDarkButton}>
          <Text style={styles.footerDarkButtonText}>{String(quantity)}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: uiPalette.background
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
    paddingHorizontal: 20
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
  closeButton: {
    position: "absolute",
    right: 32,
    width: 54,
    height: 54,
    backgroundColor: "rgba(48, 49, 51, 0.82)",
    alignItems: "center",
    justifyContent: "center"
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
  outlineAction: {
    alignSelf: "flex-start",
    marginTop: 18,
    minHeight: 42,
    paddingHorizontal: 18,
    borderWidth: 1,
    borderColor: uiPalette.borderStrong,
    justifyContent: "center"
  },
  outlineActionText: {
    fontSize: 15,
    lineHeight: 20,
    color: uiPalette.text,
    fontWeight: "500"
  },
  description: {
    marginTop: 28,
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
