import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import Constants from "expo-constants";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCart } from "../src/cart/store";
import {
  DEFAULT_CUSTOMIZATION,
  getCustomizationDeltaCents,
  getUnitPriceCents,
  type CartCustomization
} from "../src/cart/model";
import {
  formatUsd,
  resolveMenuData,
  useMenuQuery,
  type MenuItem
} from "../src/menu/catalog";
import { Button, Chip, SectionLabel, uiPalette } from "../src/ui/system";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_QUANTITY = 20;
const isExpoGo = Constants.appOwnership === "expo";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type CustomizationOptionProps = {
  label: string;
  selected: boolean;
  onPress: () => void;
  priceDeltaCents?: number;
};

type LiquidGlassViewProps = {
  children: ReactNode;
  style: {
    borderRadius: number;
    overflow: "hidden";
  };
  effect?: "clear" | "regular" | "none";
  colorScheme?: "light" | "dark" | "system";
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resolveItemId(input: string | string[] | undefined): string | null {
  if (Array.isArray(input)) return resolveItemId(input[0]);
  if (!input || input.trim().length === 0) return null;
  return input;
}

function findMenuItemById(itemId: string | null, items: MenuItem[]): MenuItem | null {
  if (!itemId) return null;
  return items.find((item) => item.id === itemId) ?? null;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function CustomizationOption({
  label,
  selected,
  onPress,
  priceDeltaCents
}: CustomizationOptionProps) {
  return (
    <Chip
      label={
        priceDeltaCents && priceDeltaCents > 0
          ? `${label} +${formatUsd(priceDeltaCents)}`
          : label
      }
      active={selected}
      onPress={onPress}
    />
  );
}

function renderGlassPill(children: ReactNode) {
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
            style={{ borderRadius: 999, overflow: "hidden" }}
          >
            <View style={styles.addToCartGlassSurface}>{children}</View>
          </LiquidGlassView>
        );
      }
    } catch {
      // Fall through to blur fallback when native module is unavailable.
    }
  }

  return (
    <BlurView
      tint="light"
      intensity={Platform.OS === "ios" ? 66 : 56}
      style={styles.addToCartBlurFallback}
    >
      <View style={styles.addToCartGlassSurface}>{children}</View>
    </BlurView>
  );
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function MenuCustomizeModalScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ itemId?: string | string[] }>();
  const itemId = useMemo(() => resolveItemId(params.itemId), [params.itemId]);

  const { addItem } = useCart();
  const menuQuery = useMenuQuery();
  const menu = resolveMenuData(menuQuery.data);
  const menuItems = useMemo(
    () => menu.categories.flatMap((category) => category.items),
    [menu.categories]
  );
  const item = useMemo(
    () => findMenuItemById(itemId, menuItems),
    [itemId, menuItems]
  );

  const [customization, setCustomization] =
    useState<CartCustomization>(DEFAULT_CUSTOMIZATION);
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    setCustomization(DEFAULT_CUSTOMIZATION);
    setQuantity(1);
  }, [item?.id]);

  const customizationDeltaCents = useMemo(
    () => getCustomizationDeltaCents(customization),
    [customization]
  );
  const selectedUnitPriceCents = item
    ? getUnitPriceCents(item.priceCents, customization)
    : 0;
  const selectedLineTotalCents = selectedUnitPriceCents * quantity;

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  function closeModal() {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/(tabs)/home");
    }
  }

  function addSelectedItem() {
    if (!item) return;

    addItem({
      menuItemId: item.id,
      name: item.name,
      basePriceCents: item.priceCents,
      customization,
      quantity
    });
    closeModal();
  }

  function incrementQuantity() {
    setQuantity((prev) => {
      if (prev >= MAX_QUANTITY) return prev;
      return prev + 1;
    });
  }

  function decrementQuantity() {
    setQuantity((prev) => {
      if (prev <= 1) return prev;
      return prev - 1;
    });
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <View style={styles.backdrop}>
      <View style={styles.sheet}>
        {/* Handle */}
        <View style={styles.modalHandleWrap}>
          <View style={styles.modalHandle} />
        </View>

        {/* Header — always visible, never scrolls */}
        <View style={styles.modalHeaderRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.modalTitle}>{item?.name ?? "Customize"}</Text>
            {/* Only show subtitle if there's an actual description */}
            {item?.description ? (
              <Text style={styles.modalSubtitle}>{item.description}</Text>
            ) : null}
          </View>
        </View>

        {/* Loading state */}
        {menuQuery.isLoading && !menuQuery.data ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color={uiPalette.primary} />
            <Text style={styles.loadingText}>Loading item details...</Text>
          </View>
        ) : null}

        {/* Item not found state */}
        {!menuQuery.isLoading && !item ? (
          <View style={styles.loadingWrap}>
            <Text style={styles.loadingText}>
              This item is unavailable right now.
            </Text>
            <Button
              label="Close"
              variant="secondary"
              onPress={closeModal}
              style={{ marginTop: 12 }}
            />
          </View>
        ) : null}

        {/* Scrollable customization options */}
        {item ? (
          <>
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{
                paddingBottom: Math.max(insets.bottom, 16) + 8
              }}
            >
              {item.badgeCodes.length > 0 ? (
                <View style={styles.badgeRow}>
                  {item.badgeCodes.map((badge) => (
                    <View key={badge} style={styles.badgePill}>
                      <Text style={styles.badgeText}>{badge}</Text>
                    </View>
                  ))}
                </View>
              ) : null}

              <View style={styles.modalSection}>
                <SectionLabel label="Size" />
                <View style={styles.optionRow}>
                  <CustomizationOption
                    label="Regular"
                    selected={customization.size === "Regular"}
                    onPress={() =>
                      setCustomization((prev) => ({ ...prev, size: "Regular" }))
                    }
                  />
                  <CustomizationOption
                    label="Large"
                    selected={customization.size === "Large"}
                    onPress={() =>
                      setCustomization((prev) => ({ ...prev, size: "Large" }))
                    }
                    priceDeltaCents={100}
                  />
                </View>
              </View>

              <View style={styles.modalSection}>
                <SectionLabel label="Milk" />
                <View style={styles.optionRowWrap}>
                  <CustomizationOption
                    label="Whole"
                    selected={customization.milk === "Whole"}
                    onPress={() =>
                      setCustomization((prev) => ({ ...prev, milk: "Whole" }))
                    }
                  />
                  <CustomizationOption
                    label="Oat"
                    selected={customization.milk === "Oat"}
                    onPress={() =>
                      setCustomization((prev) => ({ ...prev, milk: "Oat" }))
                    }
                    priceDeltaCents={75}
                  />
                  <CustomizationOption
                    label="Almond"
                    selected={customization.milk === "Almond"}
                    onPress={() =>
                      setCustomization((prev) => ({ ...prev, milk: "Almond" }))
                    }
                    priceDeltaCents={75}
                  />
                </View>
              </View>

              <View style={styles.modalSection}>
                <SectionLabel label="Extras" />
                <View style={styles.optionRow}>
                  <CustomizationOption
                    label="Extra Shot"
                    selected={customization.extraShot}
                    onPress={() =>
                      setCustomization((prev) => ({
                        ...prev,
                        extraShot: !prev.extraShot
                      }))
                    }
                    priceDeltaCents={125}
                  />
                </View>
              </View>

              <View style={styles.modalSection}>
                <SectionLabel label="Notes" />
                <TextInput
                  value={customization.notes ?? ""}
                  onChangeText={(notes) =>
                    setCustomization((prev) => ({ ...prev, notes }))
                  }
                  placeholder="No foam, easy ice, etc."
                  placeholderTextColor={uiPalette.textMuted}
                  style={styles.noteInput}
                  multiline
                />
              </View>

              <View style={styles.modalSection}>
                <SectionLabel label="Quantity & Price" />
                <View style={styles.quantityRow}>
                  <Text style={styles.quantityLabel}>Quantity</Text>
                  <View style={styles.quantityControls}>
                    <Pressable
                      style={[
                        styles.qtyButton,
                        quantity <= 1 && styles.qtyButtonDisabled
                      ]}
                      onPress={decrementQuantity}
                      disabled={quantity <= 1}
                    >
                      <Ionicons
                        name="remove"
                        size={16}
                        color={
                          quantity <= 1
                            ? "rgba(60,60,67,0.3)"
                            : uiPalette.text
                        }
                      />
                    </Pressable>
                    <Text style={styles.qtyValue}>{quantity}</Text>
                    <Pressable
                      style={[
                        styles.qtyButton,
                        quantity >= MAX_QUANTITY && styles.qtyButtonDisabled
                      ]}
                      onPress={incrementQuantity}
                      disabled={quantity >= MAX_QUANTITY}
                    >
                      <Ionicons
                        name="add"
                        size={16}
                        color={
                          quantity >= MAX_QUANTITY
                            ? "rgba(60,60,67,0.3)"
                            : uiPalette.text
                        }
                      />
                    </Pressable>
                  </View>
                </View>
                <Text style={styles.priceBreakdown}>
                  Base {formatUsd(item.priceCents)} + Customizations{" "}
                  {formatUsd(customizationDeltaCents)}
                </Text>
                <Text style={styles.totalPrice}>
                  {formatUsd(selectedLineTotalCents)}
                </Text>
              </View>
            </ScrollView>

            {/* Sticky CTA — always visible outside the scroll */}
            <View
              style={[
                styles.stickyFooter,
                { paddingBottom: Math.max(insets.bottom - 10, 8) }
              ]}
            >
              <View style={styles.addToCartShell}>
                {renderGlassPill(
                  <Pressable
                    onPress={addSelectedItem}
                    style={({ pressed }) => [
                      styles.addToCartButton,
                      pressed ? styles.addToCartButtonPressed : null
                    ]}
                  >
                    <View style={styles.addToCartButtonContent}>
                      <View style={styles.addToCartIconBox}>
                        <Ionicons
                          name="bag-check-outline"
                          size={18}
                          color="#1F2937"
                        />
                      </View>
                      <Text style={styles.addToCartButtonLabel}>
                        Add to Cart • {formatUsd(selectedLineTotalCents)}
                      </Text>
                      <View style={styles.addToCartIconSpacer} />
                    </View>
                  </Pressable>
                )}
              </View>
            </View>
          </>
        ) : null}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "transparent"
  },
  sheet: {
    flex: 1,
    marginTop: 8,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    backgroundColor: "rgba(242, 242, 247, 0.97)",
    paddingHorizontal: 20,
    paddingTop: 8
  },

  modalHandleWrap: {
    alignItems: "center",
    marginBottom: 10
  },

  modalHandle: {
    width: 36,
    height: 5,
    borderRadius: 999,
    backgroundColor: "rgba(60, 60, 67, 0.22)"
  },

  modalHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 8
  },

  modalTitle: {
    fontSize: 26,
    fontWeight: "700",
    letterSpacing: -0.9,
    color: uiPalette.text
  },

  modalSubtitle: {
    marginTop: 6,
    fontSize: 14,
    lineHeight: 20,
    color: uiPalette.textSecondary
  },

  loadingWrap: {
    marginTop: 12,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.62)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(60,60,67,0.10)",
    paddingHorizontal: 14,
    paddingVertical: 18,
    alignItems: "center"
  },

  loadingText: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 20,
    color: uiPalette.textSecondary,
    textAlign: "center"
  },

  badgeRow: {
    marginTop: 4,
    marginBottom: 4,
    flexDirection: "row",
    gap: 6,
    flexWrap: "wrap"
  },

  badgePill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "rgba(0, 122, 255, 0.12)"
  },

  badgeText: {
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    color: "#0B5CC4"
  },

  modalSection: {
    marginTop: 12,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.62)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(60,60,67,0.10)",
    paddingHorizontal: 14,
    paddingVertical: 14
  },

  optionRow: {
    marginTop: 8,
    flexDirection: "row",
    gap: 8
  },

  optionRowWrap: {
    marginTop: 8,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },

  noteInput: {
    marginTop: 8,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(60,60,67,0.12)",
    backgroundColor: "rgba(255,255,255,0.78)",
    minHeight: 92,
    textAlignVertical: "top",
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: uiPalette.text
  },

  quantityRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },

  quantityLabel: {
    fontSize: 15,
    fontWeight: "600",
    color: uiPalette.text
  },

  quantityControls: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },

  qtyButton: {
    width: 30,
    height: 30,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(60,60,67,0.2)",
    backgroundColor: "rgba(255,255,255,0.86)",
    justifyContent: "center",
    alignItems: "center"
  },

  qtyButtonDisabled: {
    opacity: 0.4
  },

  qtyValue: {
    width: 22,
    textAlign: "center",
    fontSize: 15,
    fontWeight: "700",
    color: uiPalette.text
  },

  priceBreakdown: {
    marginTop: 10,
    fontSize: 12,
    color: "rgba(60, 60, 67, 0.76)"
  },

  totalPrice: {
    marginTop: 6,
    fontSize: 28,
    fontWeight: "700",
    color: uiPalette.text
  },

  stickyFooter: {
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(60,60,67,0.10)",
    backgroundColor: "rgba(242, 242, 247, 0.97)"
  },

  addToCartShell: {
    height: 50,
    borderRadius: 999,
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(243, 243, 246, 0.54)",
    shadowColor: "#0F172A",
    shadowOpacity: 0.14,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 7 },
    elevation: 8
  },

  addToCartBlurFallback: {
    height: 50,
    borderRadius: 999,
    overflow: "hidden"
  },

  addToCartGlassSurface: {
    borderRadius: 999,
    overflow: "hidden",
    backgroundColor: "rgba(213, 214, 219, 0.56)",
    borderWidth: 1,
    borderColor: "rgba(243, 243, 246, 0.54)"
  },

  addToCartButton: {
    borderRadius: 999,
    paddingHorizontal: 24,
    paddingVertical: 0,
    backgroundColor: "rgba(247, 247, 250, 0.58)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.78)",
    justifyContent: "center",
    overflow: "hidden"
  },

  addToCartButtonContent: {
    flexDirection: "row",
    alignItems: "center",
    height: "100%",
    paddingHorizontal: 20
  },

  addToCartIconBox: {
    width: 22,
    alignItems: "center",
    justifyContent: "center",
  },

  addToCartIconSpacer: {
    width: 22
  },

  addToCartButtonPressed: {
    opacity: 0.86
  },

  addToCartButtonLabel: {
    color: "#1F2937",
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "700",
    letterSpacing: 0.1,
    textAlign: "center",
    flex: 1,
    paddingHorizontal: 14
  }
});
