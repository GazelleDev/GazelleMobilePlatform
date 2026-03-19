import { Ionicons } from "@expo/vector-icons";
import BottomSheet, { type BottomSheetMethods } from "@devvie/bottom-sheet";
import { useQueryClient } from "@tanstack/react-query";
import { BlurView } from "expo-blur";
import { GlassView, isLiquidGlassAvailable } from "expo-glass-effect";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Image, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuthSession } from "../src/auth/session";
import { buildPricingSummary, describeCustomization } from "../src/cart/model";
import { useCart } from "../src/cart/store";
import { formatUsd, resolveMenuData, resolveStoreConfigData, useMenuQuery, useStoreConfigQuery } from "../src/menu/catalog";
import { canAttemptNativeApplePay, requestNativeApplePayWallet, type ApplePayWalletPayload } from "../src/orders/applePay";
import {
  CheckoutSubmissionError,
  createDemoApplePayToken,
  quoteItemsEqual,
  toQuoteItems,
  useApplePayCheckoutMutation
} from "../src/orders/checkout";
import { useCheckoutFlow } from "../src/orders/flow";
import { getTabBarBottomOffset, TAB_BAR_HEIGHT } from "../src/navigation/tabBarMetrics";
import { Button, GlassCard, uiPalette, uiTypography } from "../src/ui/system";

function SummaryRow({
  label,
  value,
  emphasized = false
}: {
  label: string;
  value: string;
  emphasized?: boolean;
}) {
  return (
    <View style={styles.summaryRow}>
      <Text style={[styles.summaryText, emphasized ? styles.summaryStrong : null]}>{label}</Text>
      <Text style={[styles.summaryText, emphasized ? styles.summaryStrong : null]}>{value}</Text>
    </View>
  );
}

function StatusBanner({
  message,
  tone = "info"
}: {
  message: string;
  tone?: "info" | "warning";
}) {
  return (
    <View style={[styles.banner, tone === "warning" ? styles.bannerWarning : null]}>
      <Ionicons
        name={tone === "warning" ? "alert-circle-outline" : "information-circle-outline"}
        size={16}
        color={tone === "warning" ? uiPalette.warning : uiPalette.accent}
      />
      <Text style={[styles.bannerText, tone === "warning" ? styles.bannerTextWarning : null]}>{message}</Text>
    </View>
  );
}

function canUseLiquidGlassSheets() {
  if (Platform.OS !== "ios") return false;

  try {
    return isLiquidGlassAvailable();
  } catch {
    return false;
  }
}

function SheetCard({
  children,
  style
}: {
  children: React.ReactNode;
  style?: object;
}) {
  if (!canUseLiquidGlassSheets()) {
    return <GlassCard style={style}>{children}</GlassCard>;
  }

  return (
    <View style={[styles.sheetCardShell, style]}>
      <GlassView glassEffectStyle="regular" colorScheme="auto" isInteractive style={styles.sheetCardGlass}>
        <View style={styles.sheetCardInner}>{children}</View>
      </GlassView>
    </View>
  );
}

function StickyActionPill({
  label,
  value,
  icon,
  onPress,
  disabled = false
}: {
  label: string;
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  disabled?: boolean;
}) {
  const useLiquidGlass = canUseLiquidGlassSheets();

  const content = (
    <View style={[styles.stickyPillInner, disabled ? styles.stickyPillInnerDisabled : null]}>
      <View style={styles.stickyPillLead}>
        <Ionicons name={icon} size={16} color={disabled ? uiPalette.textMuted : uiPalette.text} />
        <Text style={[styles.stickyPillLabel, disabled ? styles.stickyPillLabelDisabled : null]}>{label}</Text>
      </View>
      <Text style={[styles.stickyPillValue, disabled ? styles.stickyPillValueDisabled : null]}>{value}</Text>
    </View>
  );

  return (
    <Pressable disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.stickyPillShell, pressed && !disabled ? styles.stickyPillPressed : null]}>
      {useLiquidGlass ? (
        <GlassView glassEffectStyle="regular" colorScheme="auto" isInteractive style={styles.stickyPillFrame}>
          {content}
        </GlassView>
      ) : (
        <BlurView tint="light" intensity={Platform.OS === "ios" ? 24 : 20} style={styles.stickyPillFrame}>
          {content}
        </BlurView>
      )}
    </Pressable>
  );
}

function RowQuantityControl({
  quantity,
  canDecrease,
  onDecrease,
  onIncrease,
  onRemove
}: {
  quantity: number;
  canDecrease: boolean;
  onDecrease: () => void;
  onIncrease: () => void;
  onRemove: () => void;
}) {
  const useLiquidGlass = canUseLiquidGlassSheets();

  const content = (
    <View style={[styles.stepperInner, useLiquidGlass ? styles.stepperInnerGlass : styles.stepperInnerFallback]}>
      <Pressable style={[styles.stepperButton, useLiquidGlass ? styles.stepperButtonGlass : null]} onPress={onIncrease}>
        <Ionicons name="add" size={16} color={uiPalette.text} />
      </Pressable>
      <Text style={styles.stepperValue}>{quantity}</Text>
      <Pressable style={[styles.stepperButton, useLiquidGlass ? styles.stepperButtonGlass : null, !canDecrease ? styles.stepperButtonDisabled : null]} onPress={onDecrease}>
        <Ionicons name="remove" size={16} color={uiPalette.text} />
      </Pressable>
      <View style={[styles.stepperDivider, useLiquidGlass ? styles.stepperDividerGlass : null]} />
      <Pressable style={[styles.stepperButton, useLiquidGlass ? styles.stepperButtonGlass : null]} onPress={onRemove}>
        <Ionicons name="trash-outline" size={16} color={uiPalette.textSecondary} />
      </Pressable>
    </View>
  );

  return useLiquidGlass ? (
    <GlassView glassEffectStyle="regular" colorScheme="auto" isInteractive style={styles.stepperShell}>
      {content}
    </GlassView>
  ) : (
    <BlurView tint="light" intensity={Platform.OS === "ios" ? 24 : 20} style={styles.stepperShell}>
      {content}
    </BlurView>
  );
}

function SectionHeading({
  eyebrow,
  title,
  action
}: {
  eyebrow: string;
  title: string;
  action?: React.ReactNode;
}) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionCopy}>
        <Text style={styles.sectionEyebrow}>{eyebrow}</Text>
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      {action ? <View>{action}</View> : null}
    </View>
  );
}

function resolveItemIcon(name: string): keyof typeof Ionicons.glyphMap {
  const haystack = name.toLowerCase();
  if (haystack.includes("tea") || haystack.includes("matcha")) return "leaf-outline";
  if (
    haystack.includes("croissant") ||
    haystack.includes("cookie") ||
    haystack.includes("muffin") ||
    haystack.includes("pastry")
  ) {
    return "nutrition-outline";
  }
  if (
    haystack.includes("latte") ||
    haystack.includes("espresso") ||
    haystack.includes("coffee") ||
    haystack.includes("cappuccino")
  ) {
    return "cafe-outline";
  }
  return "sparkles-outline";
}

function CartItemArtwork({
  itemName,
  imageUrl
}: {
  itemName: string;
  imageUrl?: string;
}) {
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setImageFailed(false);
  }, [imageUrl]);

  return (
    <View style={styles.itemIconWrap}>
      {imageUrl && !imageFailed ? (
        <Image source={{ uri: imageUrl }} style={styles.itemArtwork} resizeMode="contain" onError={() => setImageFailed(true)} />
      ) : (
        <Ionicons name={resolveItemIcon(itemName)} size={18} color={uiPalette.accent} />
      )}
    </View>
  );
}

export default function CartModalScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const stickyFooterBottom = getTabBarBottomOffset(insets.bottom > 0);
  const stickyFooterClearance = stickyFooterBottom + TAB_BAR_HEIGHT + 16;
  const { isAuthenticated } = useAuthSession();
  const removeSheetRef = useRef<BottomSheetMethods>(null);
  const { items, itemCount, subtotalCents, setQuantity, removeItem, clear } = useCart();
  const { retryOrder, clearRetryOrder, clearFailure, setConfirmation, setFailure } = useCheckoutFlow();
  const menuQuery = useMenuQuery();
  const menu = resolveMenuData(menuQuery.data);
  const storeConfigQuery = useStoreConfigQuery();
  const storeConfig = resolveStoreConfigData(storeConfigQuery.data);
  const pricingSummary = buildPricingSummary(subtotalCents, storeConfig.taxRateBasisPoints);
  const checkoutMutation = useApplePayCheckoutMutation();
  const nativeApplePayAvailable = canAttemptNativeApplePay();
  const showDevFallback = __DEV__;
  const quoteItems = useMemo(() => toQuoteItems(items), [items]);
  const retryableOrder = retryOrder && quoteItemsEqual(quoteItems, retryOrder.quoteItems) ? retryOrder : undefined;
  const menuItemsById = useMemo(
    () => new Map(menu.categories.flatMap((category) => category.items).map((item) => [item.id, item])),
    [menu.categories]
  );
  const [pendingRemovalLineId, setPendingRemovalLineId] = useState<string | null>(null);
  const pendingRemovalItem = useMemo(
    () => items.find((item) => item.lineId === pendingRemovalLineId) ?? null,
    [items, pendingRemovalLineId]
  );

  const [applePayToken, setApplePayToken] = useState("");
  const [nativeApplePayPending, setNativeApplePayPending] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const stickyActionDisabled = isAuthenticated ? nativeApplePayPending || checkoutMutation.isPending || !nativeApplePayAvailable : false;
  const stickyActionLabel = isAuthenticated
    ? nativeApplePayPending
      ? "Opening Apple Pay…"
      : checkoutMutation.isPending
        ? "Processing…"
        : retryableOrder
          ? "Retry Apple Pay"
          : nativeApplePayAvailable
            ? "Pay with Apple Pay"
            : "Apple Pay unavailable"
    : "Sign In to Checkout";
  const stickyActionIcon: keyof typeof Ionicons.glyphMap = isAuthenticated ? "logo-apple" : "log-in-outline";

  useEffect(() => {
    if (retryOrder && !quoteItemsEqual(quoteItems, retryOrder.quoteItems)) {
      clearRetryOrder();
    }
  }, [clearRetryOrder, quoteItems, retryOrder]);

  useEffect(() => {
    if (pendingRemovalLineId && pendingRemovalItem) {
      removeSheetRef.current?.open();
    }
  }, [pendingRemovalItem, pendingRemovalLineId]);

  useEffect(() => {
    if (pendingRemovalLineId && !pendingRemovalItem) {
      removeSheetRef.current?.close();
      setPendingRemovalLineId(null);
    }
  }, [pendingRemovalItem, pendingRemovalLineId]);

  async function invalidateAccountQueries() {
    await queryClient.invalidateQueries({ queryKey: ["account"] });
  }

  function resetCartState() {
    removeSheetRef.current?.close();
    setPendingRemovalLineId(null);
    clear();
    clearFailure();
    clearRetryOrder();
    setStatusMessage("");
  }

  function submitCheckout(paymentInput: { applePayToken: string } | { applePayWallet: ApplePayWalletPayload }) {
    setStatusMessage("Submitting your order…");

    checkoutMutation.mutate(
      {
        locationId: storeConfig.locationId,
        items,
        existingOrder: retryableOrder,
        ...paymentInput
      },
      {
        onSuccess: (paidOrder) => {
          setNativeApplePayPending(false);
          setConfirmation({
            orderId: paidOrder.id,
            pickupCode: paidOrder.pickupCode,
            status: paidOrder.status,
            total: paidOrder.total,
            occurredAt: paidOrder.timeline[paidOrder.timeline.length - 1]?.occurredAt ?? new Date().toISOString()
          });
          clear();
          setStatusMessage("");
          void invalidateAccountQueries();
          router.replace("/checkout-success");
        },
        onError: (error) => {
          setNativeApplePayPending(false);
          const message = error instanceof Error ? error.message : "Checkout failed.";

          if (error instanceof CheckoutSubmissionError) {
            setStatusMessage("");
            setFailure({
              message,
              stage: error.stage,
              occurredAt: new Date().toISOString(),
              order: error.order
            });
            void invalidateAccountQueries();
            router.replace("/checkout-failure");
            return;
          }

          setStatusMessage(message);
        }
      }
    );
  }

  function handleApplePayTokenCheckout() {
    const token = applePayToken.trim();
    if (!token) {
      setStatusMessage("Enter a test token before checkout.");
      return;
    }
    setApplePayToken("");
    submitCheckout({ applePayToken: token });
  }

  async function handleNativeApplePayCheckout() {
    if (!nativeApplePayAvailable) {
      setStatusMessage(
        showDevFallback
          ? "Apple Pay is unavailable in this build. Use the development test flow below."
          : "Apple Pay is unavailable in this build right now."
      );
      return;
    }

    setNativeApplePayPending(true);
    setStatusMessage("Opening Apple Pay…");

    try {
      const walletPayload = await requestNativeApplePayWallet({
        amountCents: pricingSummary.totalCents,
        currencyCode: "USD",
        countryCode: "US",
        label: "Gazelle Coffee"
      });
      submitCheckout({ applePayWallet: walletPayload });
    } catch (error) {
      setNativeApplePayPending(false);
      const message = error instanceof Error ? error.message : "Apple Pay sheet failed.";
      setStatusMessage(message);
    }
  }

  return (
    <View style={styles.backdrop}>
      <View style={styles.sheet}>
        <View style={styles.handleWrap}>
          <View style={styles.modalHandle} />
        </View>

        <View style={styles.headerArea}>
          <View style={styles.headerRow}>
            <View style={styles.headerCopy}>
              <Text style={styles.headerTitle}>Order Review</Text>
              <Text style={styles.headerSubtitle}>{`Estimated wait is ${storeConfig.prepEtaMinutes} min`}</Text>
            </View>
          </View>

        </View>

        <ScrollView
          bounces
          showsVerticalScrollIndicator={false}
          contentInsetAdjustmentBehavior="never"
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingTop: items.length > 0 ? 14 : 8,
            paddingBottom: items.length > 0 ? stickyFooterClearance : Math.max(insets.bottom, 12) + 8
          }}
        >
          {items.length === 0 ? (
            <SheetCard style={styles.emptyCard}>
              <View style={styles.emptyIconWrap}>
                <Ionicons name="bag-handle-outline" size={30} color={uiPalette.accent} />
              </View>
              <Text style={styles.emptyEyebrow}>Nothing here yet</Text>
              <Text style={styles.emptyTitle}>Build the cart from the menu.</Text>
              <Text style={styles.emptyBody}>
                Add drinks or pastries first, then come back here to review quantities, pickup timing, and payment.
              </Text>
              <Button
                label="Browse Menu"
                onPress={() => router.replace("/(tabs)/menu")}
                left={<Ionicons name="cafe-outline" size={16} color={uiPalette.primaryText} />}
                style={styles.emptyPrimary}
              />
            </SheetCard>
          ) : (
            <>
              {retryableOrder ? (
                <StatusBanner
                  message={`Payment for order ${retryableOrder.pickupCode} did not complete. You can retry without rebuilding the bag.`}
                  tone="warning"
                />
              ) : null}

              <View style={styles.sectionBlock}>
                <SectionHeading
                  eyebrow="Bag"
                  title="Items"
                  action={
                    <Pressable style={styles.clearChip} onPress={resetCartState}>
                      <Text style={styles.clearChipText}>Clear</Text>
                    </Pressable>
                  }
                />

                <View style={styles.lineStack}>
                  {items.map((item, index) => {
                    const customizationSummary = describeCustomization(item, { fallback: "Standard build" });
                    const notes = item.customization.notes.trim();
                    const menuItem = menuItemsById.get(item.menuItemId);

                    return (
                      <View key={item.lineId}>
                        <View style={styles.lineCard}>
                          <View style={styles.lineTopRow}>
                            <CartItemArtwork itemName={item.itemName} imageUrl={menuItem?.imageUrl} />

                            <View style={[styles.lineBodyWrap, index < items.length - 1 ? styles.lineBodyWrapWithDivider : null]}>
                              <View style={styles.lineBodyContent}>
                                <View style={styles.lineDetailColumn}>
                                  <View style={styles.lineHeaderRow}>
                                    <View style={styles.lineCopy}>
                                      <Text style={styles.itemTitle}>{item.itemName}</Text>
                                      <Text style={styles.itemBody}>{`${customizationSummary} • ${formatUsd(item.unitPriceCents)} each`}</Text>
                                      {notes ? <Text style={styles.itemNoteText}>{notes}</Text> : null}
                                    </View>

                                    <View style={styles.linePriceBlock}>
                                      <Text style={styles.linePriceValue}>{formatUsd(item.lineTotalCents)}</Text>
                                    </View>
                                  </View>

                                  <View style={styles.lineFooter}>
                                    <RowQuantityControl
                                      quantity={item.quantity}
                                      canDecrease={item.quantity > 1}
                                      onDecrease={() => {
                                        if (item.quantity <= 1) {
                                          return;
                                        }
                                        setQuantity(item.lineId, item.quantity - 1);
                                      }}
                                      onIncrease={() => setQuantity(item.lineId, item.quantity + 1)}
                                      onRemove={() => setPendingRemovalLineId(item.lineId)}
                                    />
                                  </View>
                                </View>
                              </View>
                            </View>
                          </View>
                        </View>
                      </View>
                    );
                  })}
                </View>
              </View>

              {statusMessage ? <StatusBanner message={statusMessage} tone={retryableOrder ? "warning" : "info"} /> : null}

              <View style={styles.checkoutDeck}>
                <SectionHeading eyebrow="Checkout" title="Pay" />

                <View style={styles.pickupHeaderRow}>
                  <View style={styles.pickupTitleRow}>
                    <Ionicons name="storefront-outline" size={17} color={uiPalette.accent} />
                    <Text style={styles.pickupPanelTitle}>Counter pickup</Text>
                  </View>
                  <Text style={styles.pickupEtaText}>{`${storeConfig.prepEtaMinutes} min`}</Text>
                </View>
                <Text style={styles.pickupBody}>{storeConfig.pickupInstructions}</Text>
                <View style={styles.pickupMeta}>
                  <View style={styles.pickupPill}>
                    <Ionicons name="time-outline" size={14} color={uiPalette.accent} />
                    <Text style={styles.pickupPillText}>{storeConfig.prepEtaMinutes} min average</Text>
                  </View>
                  <View style={styles.pickupPill}>
                    <Ionicons name="bag-check-outline" size={14} color={uiPalette.accent} />
                    <Text style={styles.pickupPillText}>Ready when called</Text>
                  </View>
                </View>

                <View style={styles.deckDivider} />

                <View style={styles.summaryWrap}>
                  <SummaryRow label={`Items (${itemCount})`} value={formatUsd(pricingSummary.subtotalCents)} />
                  <SummaryRow
                    label={`Tax (${(storeConfig.taxRateBasisPoints / 100).toFixed(2)}%)`}
                    value={formatUsd(pricingSummary.taxCents)}
                  />
                  <View style={styles.summaryDivider} />
                  <SummaryRow label="Total due today" value={formatUsd(pricingSummary.totalCents)} emphasized />
                </View>

                <View style={styles.deckDivider} />

                {isAuthenticated ? (
                  <View>
                    <Text style={styles.payTitle}>Apple Pay</Text>
                    <Text style={styles.payBody}>
                      Keep payment native, fast, and separated from the rest of the checkout review.
                    </Text>
                    {showDevFallback ? (
                      <View style={styles.devSection}>
                        <Text style={styles.devEyebrow}>Development fallback</Text>
                        <TextInput
                          value={applePayToken}
                          onChangeText={setApplePayToken}
                          autoCapitalize="none"
                          autoCorrect={false}
                          secureTextEntry
                          placeholder="Test Apple Pay token"
                          placeholderTextColor={uiPalette.textMuted}
                          style={styles.tokenInput}
                        />
                        <View style={styles.devActions}>
                          <Button
                            label="Use Demo Token"
                            variant="secondary"
                            onPress={() => setApplePayToken(createDemoApplePayToken())}
                            style={{ flex: 1 }}
                          />
                          <Button
                            label={checkoutMutation.isPending ? "Processing…" : "Run Test"}
                            variant="ghost"
                            disabled={checkoutMutation.isPending || nativeApplePayPending}
                            onPress={handleApplePayTokenCheckout}
                            style={{ flex: 1 }}
                          />
                        </View>
                      </View>
                    ) : null}
                  </View>
                ) : (
                  <View>
                    <Text style={styles.payTitle}>Sign in to continue</Text>
                    <Text style={styles.payBody}>
                      Orders, rewards, and pickup history stay attached to the right account when payment starts signed in.
                    </Text>
                  </View>
                )}
              </View>
            </>
          )}
        </ScrollView>

        {items.length > 0 ? (
          <View pointerEvents="box-none" style={[styles.stickyFooterWrap, { bottom: stickyFooterBottom }]}>
            <StickyActionPill
              label={stickyActionLabel}
              value={formatUsd(pricingSummary.totalCents)}
              icon={stickyActionIcon}
              disabled={stickyActionDisabled}
              onPress={() => {
                if (isAuthenticated) {
                  void handleNativeApplePayCheckout();
                  return;
                }

                router.push({ pathname: "/auth", params: { returnTo: "cart" } });
              }}
            />
          </View>
        ) : null}

        <BottomSheet
          ref={removeSheetRef}
          height="42%"
          modal
          animationType="slide"
          backdropMaskColor="rgba(18, 16, 14, 0.28)"
          closeOnBackdropPress
          closeOnDragDown
          openDuration={280}
          closeDuration={220}
          dragHandleStyle={styles.removeSheetHandle}
          style={styles.removeSheet}
          onClose={() => setPendingRemovalLineId(null)}
        >
          <View style={[styles.removeSheetContent, { paddingBottom: Math.max(insets.bottom, 14) + 12 }]}>
            <Text style={styles.removeSheetEyebrow}>Remove item</Text>
            <Text style={styles.removeSheetTitle}>Delete from cart?</Text>
            <Text style={styles.removeSheetBody}>
              {pendingRemovalItem
                ? `Remove ${pendingRemovalItem.itemName} from your order review? This will only remove the item from the bag.`
                : "Remove this item from your order review? This will only remove the item from the bag."}
            </Text>

            {pendingRemovalItem ? (
              <View style={styles.removeSheetPreviewRow}>
                <Text style={styles.removeSheetPreviewName}>{pendingRemovalItem.itemName}</Text>
                <Text style={styles.removeSheetPreviewMeta}>
                  {`${pendingRemovalItem.quantity} ${pendingRemovalItem.quantity === 1 ? "item" : "items"}`}
                </Text>
              </View>
            ) : null}

            <View style={styles.removeSheetActionRow}>
              <Button
                label="Keep Item"
                variant="secondary"
                onPress={() => removeSheetRef.current?.close()}
                style={styles.removeSheetAction}
              />
              <Button
                label="Delete Item"
                disabled={!pendingRemovalItem}
                onPress={() => {
                  if (!pendingRemovalItem) return;
                  removeItem(pendingRemovalItem.lineId);
                  removeSheetRef.current?.close();
                }}
                style={styles.removeSheetAction}
              />
            </View>
          </View>
        </BottomSheet>
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
    backgroundColor: "rgba(247, 244, 237, 0.985)",
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    borderWidth: 1,
    borderColor: uiPalette.border
  },
  handleWrap: {
    position: "absolute",
    top: 14,
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 10
  },
  modalHandle: {
    width: 38,
    height: 5,
    borderRadius: 999,
    backgroundColor: "rgba(151, 160, 154, 0.52)"
  },
  headerArea: {
    paddingHorizontal: 20,
    paddingTop: 28,
    paddingBottom: 4
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start"
  },
  headerCopy: {
    flex: 1
  },
  headerTitle: {
    marginTop: 15,
    fontSize: 19,
    lineHeight: 24,
    letterSpacing: 2,
    textTransform: "uppercase",
    color: uiPalette.text,
    fontFamily: uiTypography.displayFamily,
    fontWeight: "600"
  },
  headerSubtitle: {
    marginTop: 6,
    marginBottom: 6,
    fontSize: 13,
    lineHeight: 18,
    color: uiPalette.textSecondary
  },
  sheetCardShell: {
    borderRadius: 26,
    overflow: "hidden"
  },
  sheetCardGlass: {
    borderRadius: 26,
    overflow: "hidden"
  },
  sheetCardInner: {
    borderRadius: 26,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.008)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)"
  },
  emptyCard: {
    marginTop: 12,
    paddingTop: 26,
    paddingBottom: 24
  },
  emptyIconWrap: {
    width: 62,
    height: 62,
    borderRadius: 31,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.64)",
    borderWidth: 1,
    borderColor: "rgba(23, 21, 19, 0.08)"
  },
  emptyEyebrow: {
    marginTop: 16,
    fontSize: 11,
    lineHeight: 14,
    textTransform: "uppercase",
    letterSpacing: 1.2,
    color: uiPalette.textMuted,
    fontWeight: "700"
  },
  emptyTitle: {
    marginTop: 8,
    fontSize: 30,
    lineHeight: 34,
    fontWeight: "700",
    letterSpacing: -0.8,
    color: uiPalette.text,
    fontFamily: uiTypography.displayFamily
  },
  emptyBody: {
    marginTop: 10,
    fontSize: 14,
    lineHeight: 22,
    color: uiPalette.textSecondary
  },
  emptyPrimary: {
    marginTop: 18,
    alignSelf: "flex-start"
  },
  banner: {
    marginTop: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 18,
    backgroundColor: uiPalette.surfaceMuted,
    borderWidth: 1,
    borderColor: uiPalette.border,
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  bannerWarning: {
    backgroundColor: "rgba(176, 122, 58, 0.08)",
    borderColor: "rgba(176, 122, 58, 0.18)"
  },
  bannerText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
    color: uiPalette.textSecondary
  },
  bannerTextWarning: {
    color: uiPalette.text
  },
  sectionBlock: {
    marginTop: 4
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 12
  },
  sectionCopy: {
    flex: 1
  },
  sectionEyebrow: {
    fontSize: 11,
    lineHeight: 14,
    textTransform: "uppercase",
    letterSpacing: 1.15,
    color: uiPalette.textMuted,
    fontWeight: "700"
  },
  sectionTitle: {
    marginTop: 4,
    fontSize: 20,
    lineHeight: 24,
    fontWeight: "700",
    color: uiPalette.text,
    letterSpacing: -0.3,
    fontFamily: uiTypography.displayFamily
  },
  clearChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.46)",
    borderWidth: 1,
    borderColor: uiPalette.border
  },
  clearChipText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "600",
    color: uiPalette.textSecondary
  },
  lineStack: {
    marginTop: 16
  },
  lineCard: {
    paddingHorizontal: 0,
    minHeight: 132,
    borderRadius: 0
  },
  lineTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    width: "100%"
  },
  itemIconWrap: {
    width: 88,
    height: 132,
    alignItems: "center",
    justifyContent: "center"
  },
  itemArtwork: {
    width: "100%",
    height: "100%"
  },
  lineBodyWrap: {
    flex: 1,
    minWidth: 0,
    minHeight: 132,
    justifyContent: "center"
  },
  lineBodyWrapWithDivider: {
    borderBottomWidth: 1,
    borderBottomColor: uiPalette.border
  },
  lineBodyContent: {
    minHeight: 132,
    justifyContent: "center",
    paddingVertical: 10
  },
  lineDetailColumn: {
    flex: 1,
    minHeight: 112,
    justifyContent: "space-between"
  },
  lineHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12
  },
  lineCopy: {
    flex: 1
  },
  itemTitle: {
    fontSize: 16,
    lineHeight: 20,
    letterSpacing: 1.3,
    textTransform: "uppercase",
    color: uiPalette.text,
    fontFamily: uiTypography.displayFamily,
    fontWeight: "500"
  },
  itemBody: {
    marginTop: 2,
    fontSize: 12,
    lineHeight: 14,
    color: uiPalette.textSecondary
  },
  itemNoteText: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 17,
    color: uiPalette.textMuted
  },
  linePriceBlock: {
    alignItems: "flex-end"
  },
  linePriceLabel: {
    fontSize: 10,
    lineHeight: 12,
    textTransform: "uppercase",
    letterSpacing: 1,
    color: uiPalette.textMuted,
    fontWeight: "700"
  },
  linePriceValue: {
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 1.4,
    textTransform: "uppercase",
    color: uiPalette.text,
    fontFamily: uiTypography.displayFamily,
    fontWeight: "400"
  },
  lineFooter: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end"
  },
  stepperShell: {
    height: 40,
    borderRadius: 999,
    overflow: "hidden"
  },
  stepperInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 8,
    height: 40,
    borderRadius: 999
  },
  stepperInnerGlass: {
    backgroundColor: "rgba(255, 255, 255, 0.01)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.11)"
  },
  stepperInnerFallback: {
    borderRadius: 999,
    backgroundColor: uiPalette.surfaceStrong,
    borderWidth: 1,
    borderColor: uiPalette.border
  },
  stepperButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: uiPalette.surfaceMuted
  },
  stepperButtonGlass: {
    backgroundColor: "rgba(255, 255, 255, 0.18)"
  },
  stepperButtonDisabled: {
    opacity: 0.55
  },
  stepperValue: {
    minWidth: 16,
    fontSize: 15,
    lineHeight: 18,
    fontWeight: "700",
    textAlign: "center",
    color: uiPalette.text
  },
  stepperDivider: {
    width: 1,
    height: 24,
    marginHorizontal: 3,
    borderRadius: 999,
    backgroundColor: "rgba(23, 21, 19, 0.20)"
  },
  stepperDividerGlass: {
    backgroundColor: "rgba(23, 21, 19, 0.18)"
  },
  removeSheet: {
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    backgroundColor: "rgba(247, 244, 237, 0.985)",
    borderWidth: 1,
    borderColor: uiPalette.border
  },
  removeSheetHandle: {
    marginTop: 12,
    width: 38,
    height: 5,
    borderRadius: 999,
    backgroundColor: "rgba(151, 160, 154, 0.52)"
  },
  removeSheetContent: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 14
  },
  removeSheetEyebrow: {
    fontSize: 11,
    lineHeight: 14,
    textTransform: "uppercase",
    letterSpacing: 1.2,
    color: uiPalette.textMuted,
    fontWeight: "700"
  },
  removeSheetTitle: {
    marginTop: 8,
    fontSize: 32,
    lineHeight: 36,
    letterSpacing: -0.8,
    color: uiPalette.text,
    fontFamily: uiTypography.displayFamily,
    fontWeight: "700"
  },
  removeSheetBody: {
    marginTop: 12,
    fontSize: 15,
    lineHeight: 23,
    color: uiPalette.textSecondary
  },
  removeSheetPreviewRow: {
    marginTop: 18,
    paddingHorizontal: 16,
    paddingVertical: 15,
    borderRadius: 22,
    backgroundColor: "rgba(255, 253, 248, 0.78)",
    borderWidth: 1,
    borderColor: uiPalette.border,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  removeSheetPreviewName: {
    flex: 1,
    fontSize: 15,
    lineHeight: 20,
    color: uiPalette.text,
    fontFamily: uiTypography.displayFamily,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 1.2
  },
  removeSheetPreviewMeta: {
    marginLeft: 12,
    fontSize: 13,
    lineHeight: 18,
    color: uiPalette.textSecondary
  },
  removeSheetActionRow: {
    marginTop: 18,
    flexDirection: "row",
    gap: 10
  },
  removeSheetAction: {
    flex: 1
  },
  checkoutDeck: {
    marginTop: 18,
    paddingTop: 2
  },
  pickupHeaderRow: {
    marginTop: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12
  },
  pickupTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  pickupPanelTitle: {
    fontSize: 15,
    lineHeight: 18,
    fontWeight: "700",
    color: uiPalette.text
  },
  pickupEtaText: {
    fontSize: 13,
    lineHeight: 17,
    color: uiPalette.textMuted,
    fontWeight: "600"
  },
  pickupBody: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 20,
    color: uiPalette.textSecondary
  },
  pickupMeta: {
    marginTop: 14,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  pickupPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: uiPalette.surfaceStrong,
    borderWidth: 1,
    borderColor: uiPalette.border
  },
  pickupPillText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "600",
    color: uiPalette.text
  },
  deckDivider: {
    height: 1,
    marginVertical: 18,
    backgroundColor: "rgba(23, 21, 19, 0.08)"
  },
  summaryWrap: {
    gap: 10
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12
  },
  summaryText: {
    fontSize: 14,
    lineHeight: 22,
    color: uiPalette.textSecondary
  },
  summaryStrong: {
    fontWeight: "700",
    color: uiPalette.text
  },
  summaryDivider: {
    height: 1,
    backgroundColor: "rgba(23, 21, 19, 0.08)"
  },
  payTitle: {
    fontSize: 24,
    lineHeight: 28,
    fontWeight: "700",
    color: uiPalette.text,
    fontFamily: uiTypography.displayFamily
  },
  payBody: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 22,
    color: uiPalette.textSecondary
  },
  devSection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "rgba(23, 21, 19, 0.08)"
  },
  devEyebrow: {
    marginBottom: 10,
    fontSize: 11,
    lineHeight: 14,
    textTransform: "uppercase",
    letterSpacing: 1.1,
    color: uiPalette.textMuted,
    fontWeight: "700"
  },
  tokenInput: {
    minHeight: 52,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: uiPalette.border,
    backgroundColor: uiPalette.surfaceStrong,
    paddingHorizontal: 14,
    color: uiPalette.text
  },
  devActions: {
    marginTop: 10,
    flexDirection: "row",
    gap: 10
  },
  stickyFooterWrap: {
    position: "absolute",
    left: 18,
    right: 18
  },
  stickyPillShell: {
    minHeight: 60,
    borderRadius: 999,
    overflow: "hidden",
    shadowColor: "#000000",
    shadowOpacity: 0.09,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6
  },
  stickyPillPressed: {
    opacity: 0.9
  },
  stickyPillFrame: {
    minHeight: 60,
    borderRadius: 999,
    overflow: "hidden"
  },
  stickyPillInner: {
    minHeight: 60,
    paddingHorizontal: 18,
    borderRadius: 999,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(255,255,255,0.01)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)"
  },
  stickyPillInnerDisabled: {
    backgroundColor: "rgba(255,255,255,0.02)"
  },
  stickyPillLead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flexShrink: 1
  },
  stickyPillLabel: {
    fontSize: 15,
    lineHeight: 18,
    fontWeight: "600",
    color: uiPalette.text
  },
  stickyPillLabelDisabled: {
    color: uiPalette.textMuted
  },
  stickyPillValue: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: "700",
    color: uiPalette.text,
    fontFamily: uiTypography.displayFamily
  },
  stickyPillValueDisabled: {
    color: uiPalette.textMuted
  }
});
