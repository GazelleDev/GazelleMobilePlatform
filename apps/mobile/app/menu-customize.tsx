import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { GlassView, isLiquidGlassAvailable } from "expo-glass-effect";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type ViewStyle
} from "react-native";
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
import { getTabBarBottomOffset, TAB_BAR_HEIGHT } from "../src/navigation/tabBarMetrics";
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

function canUseLiquidGlassFooter() {
  if (Platform.OS !== "ios") return false;

  try {
    return isLiquidGlassAvailable();
  } catch {
    return false;
  }
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

function FooterPill({
  children,
  style
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const useLiquidGlass = canUseLiquidGlassFooter();

  const content = (
    <View style={[styles.footerPillInner, useLiquidGlass ? styles.footerPillInnerGlass : styles.footerPillInnerFallback]}>
      {children}
    </View>
  );

  return (
    <View style={[styles.footerPillShell, style]}>
      {useLiquidGlass ? (
        <GlassView glassEffectStyle="regular" colorScheme="auto" isInteractive style={styles.footerPillFrame}>
          {content}
        </GlassView>
      ) : (
        <BlurView tint="light" intensity={Platform.OS === "ios" ? 24 : 20} style={styles.footerPillFrame}>
          {content}
        </BlurView>
      )}
    </View>
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
        <Image
          source={{ uri: imageUrl }}
          style={styles.heroImagePhoto}
          resizeMode="cover"
          onError={() => setImageFailed(true)}
        />
      ) : (
        <View style={styles.heroDrink}>
          <Ionicons name="cafe-outline" size={34} color={uiPalette.surfaceStrong} />
        </View>
      )}
    </View>
  );
}

function SimpleModalState({
  title,
  body,
  actionLabel,
  onAction
}: {
  title: string;
  body: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.backdrop}>
      <View style={[styles.sheet, styles.centerState]}>
        <View style={styles.handleWrap}>
          <View style={styles.handle} />
        </View>
        <Text style={styles.centerTitle}>{title}</Text>
        <Text style={styles.centerText}>{body}</Text>
        {actionLabel && onAction ? (
          <Pressable onPress={onAction} style={styles.inlinePrimary}>
            <Text style={styles.inlinePrimaryText}>{actionLabel}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

export default function MenuCustomizeModalScreen() {
  const insets = useSafeAreaInsets();
  const footerBottom = getTabBarBottomOffset(insets.bottom > 0);
  const footerClearance = footerBottom + TAB_BAR_HEIGHT + 16;
  const router = useRouter();
  const params = useLocalSearchParams<{ itemId?: string | string[] }>();
  const itemId = useMemo(() => resolveItemId(params.itemId), [params.itemId]);

  const { addItem } = useCart();
  const menuQuery = useMenuQuery();
  const menu = resolveMenuData(menuQuery.data);
  const items = useMemo(() => menu.categories.flatMap((category) => category.items), [menu.categories]);
  const item = useMemo(() => findMenuItemById(itemId, items), [itemId, items]);

  const [customization, setCustomization] = useState<CartCustomization>(DEFAULT_CUSTOMIZATION);
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState("");
  useEffect(() => {
    setCustomization(item ? buildDefaultCustomization(item.customizationGroups) : DEFAULT_CUSTOMIZATION);
    setQuantity(1);
    setNotes("");
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

  if (menuQuery.isLoading && !menuQuery.data) {
    return <SimpleModalState title="Loading item..." body="Preparing the customize sheet." />;
  }

  if (!item) {
    return (
      <SimpleModalState
        title="This item is unavailable."
        body="Return to the menu and choose another drink."
        actionLabel="Back to Menu"
        onAction={closeModal}
      />
    );
  }

  return (
    <View style={styles.backdrop}>
      <View style={styles.sheet}>
        <View style={styles.handleWrap}>
          <View style={styles.handle} />
        </View>

        <ScrollView
          bounces
          showsVerticalScrollIndicator={false}
          contentInsetAdjustmentBehavior="never"
          contentContainerStyle={[styles.scrollContent, { paddingBottom: footerClearance }]}
        >
          <View style={styles.heroWrap}>
            <ProductImage imageUrl={item.imageUrl} />
          </View>

          <View style={styles.content}>
            <Text style={styles.title}>{item.name}</Text>
            <Text style={styles.meta}>{metaLine}</Text>
            <Text style={styles.description}>{item.description}</Text>

            <View>
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
                        onPress={() => setCustomization((prev) => updateCustomizationOption(prev, group, option))}
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
                  placeholder="No foam, easy ice, half sweet..."
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

            <View style={styles.summarySection}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Customization</Text>
                <Text style={styles.summaryValue}>{formatUsd(customizationDeltaCents)}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Total</Text>
                <Text style={styles.summaryValueStrong}>{formatUsd(totalCents)}</Text>
              </View>
            </View>
          </View>
        </ScrollView>

        <View pointerEvents="box-none" style={[styles.footerRow, { bottom: footerBottom }]}>
          <FooterPill style={styles.footerPrimaryPill}>
            <Pressable onPress={addSelectedItem} style={[styles.footerButton, styles.footerPrimaryButton]}>
              <Text style={styles.footerPrimaryText}>Add to Cart</Text>
            </Pressable>
          </FooterPill>
          <FooterPill style={styles.footerCompactPill}>
            <Pressable onPress={() => router.push("/cart")} style={[styles.footerButton, styles.footerCompactButton]}>
              <View style={styles.footerQuantityIconWrap}>
                <Ionicons name="cart-outline" size={28} color={uiPalette.text} />
              </View>
            </Pressable>
          </FooterPill>
        </View>
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
  scrollContent: {
    paddingBottom: 0
  },
  handleWrap: {
    position: "absolute",
    top: 16,
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 10
  },
  handle: {
    width: 38,
    height: 5,
    borderRadius: 999,
    backgroundColor: "rgba(151, 160, 154, 0.52)"
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
    paddingTop: 36
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
  summarySection: {
    marginBottom: 24
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
  footerRow: {
    position: "absolute",
    left: 18,
    right: 18,
    flexDirection: "row",
    gap: 8
  },
  footerPillShell: {
    borderRadius: 999,
    overflow: "visible",
    minHeight: 56,
    shadowColor: "#000000",
    shadowOpacity: 0.09,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6
  },
  footerPillFrame: {
    minHeight: 56,
    borderRadius: 999,
    overflow: "hidden"
  },
  footerPillInner: {
    minHeight: 56,
    borderRadius: 999,
    paddingHorizontal: 4,
    paddingVertical: 2,
    justifyContent: "center"
  },
  footerPillInnerGlass: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)"
  },
  footerPillInnerFallback: {
    backgroundColor: "rgba(248, 244, 236, 0.98)",
    borderWidth: 1,
    borderColor: "rgba(230, 221, 208, 0.94)"
  },
  footerPrimaryPill: {
    flex: 1
  },
  footerCompactPill: {
    width: 84
  },
  footerButton: {
    minHeight: 52,
    width: "100%",
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14
  },
  footerPrimaryButton: {
    flex: 1
  },
  footerCompactButton: {
    width: "100%"
  },
  footerPrimaryText: {
    fontSize: 17,
    lineHeight: 22,
    color: uiPalette.text,
    fontWeight: "600"
  },
  footerCompactText: {
    fontSize: 17,
    lineHeight: 22,
    color: uiPalette.text,
    fontWeight: "600"
  },
  footerQuantityIconWrap: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center"
  }
});
