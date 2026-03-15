import { Ionicons } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuthSession } from "../src/auth/session";
import { buildPricingSummary, describeCustomization } from "../src/cart/model";
import { useCart } from "../src/cart/store";
import { formatUsd, resolveStoreConfigData, useStoreConfigQuery } from "../src/menu/catalog";
import {
  canAttemptNativeApplePay,
  requestNativeApplePayWallet,
  type ApplePayWalletPayload
} from "../src/orders/applePay";
import {
  CheckoutSubmissionError,
  createDemoApplePayToken,
  quoteItemsEqual,
  toQuoteItems,
  useApplePayCheckoutMutation
} from "../src/orders/checkout";
import { useCheckoutFlow } from "../src/orders/flow";
import { Button, Card, GlassCard, SectionLabel, uiPalette } from "../src/ui/system";

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
      <Text style={[styles.summaryLabel, emphasized ? styles.summaryStrong : null]}>{label}</Text>
      <Text style={[styles.summaryLabel, emphasized ? styles.summaryStrong : null]}>{value}</Text>
    </View>
  );
}

function DetailPill({
  icon,
  label
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
}) {
  return (
    <View style={styles.detailPill}>
      <Ionicons name={icon} size={14} color={uiPalette.accent} />
      <Text style={styles.detailPillText}>{label}</Text>
    </View>
  );
}

function resolveCartItemIcon(name: string): keyof typeof Ionicons.glyphMap {
  const haystack = name.toLowerCase();

  if (haystack.includes("tea") || haystack.includes("matcha")) {
    return "leaf-outline";
  }

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

function StatusBanner({
  message,
  tone = "info"
}: {
  message: string;
  tone?: "info" | "warning";
}) {
  return (
    <Card muted style={[styles.statusCard, tone === "warning" ? styles.statusCardWarning : null]}>
      <View style={styles.statusRow}>
        <View style={[styles.statusIconWrap, tone === "warning" ? styles.statusIconWrapWarning : null]}>
          <Ionicons
            name={tone === "warning" ? "alert-circle-outline" : "information-circle-outline"}
            size={16}
            color={tone === "warning" ? uiPalette.primaryText : uiPalette.walnut}
          />
        </View>
        <Text style={styles.checkoutStatus}>{message}</Text>
      </View>
    </Card>
  );
}

export default function CartModalScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const { isAuthenticated } = useAuthSession();
  const { items, itemCount, subtotalCents, setQuantity, removeItem, clear } = useCart();
  const { retryOrder, clearRetryOrder, clearFailure, setConfirmation, setFailure } = useCheckoutFlow();
  const storeConfigQuery = useStoreConfigQuery();
  const storeConfig = resolveStoreConfigData(storeConfigQuery.data);
  const pricingSummary = buildPricingSummary(subtotalCents, storeConfig.taxRateBasisPoints);
  const checkoutMutation = useApplePayCheckoutMutation();
  const nativeApplePayAvailable = canAttemptNativeApplePay();
  const showDevFallback = __DEV__;
  const quoteItems = useMemo(() => toQuoteItems(items), [items]);
  const retryableOrder = retryOrder && quoteItemsEqual(quoteItems, retryOrder.quoteItems) ? retryOrder : undefined;

  const [applePayToken, setApplePayToken] = useState("");
  const [nativeApplePayPending, setNativeApplePayPending] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");

  useEffect(() => {
    if (retryOrder && !quoteItemsEqual(quoteItems, retryOrder.quoteItems)) {
      clearRetryOrder();
    }
  }, [clearRetryOrder, quoteItems, retryOrder]);

  async function invalidateAccountQueries() {
    await queryClient.invalidateQueries({ queryKey: ["account"] });
  }

  function submitCheckout(paymentInput: { applePayToken: string } | { applePayWallet: ApplePayWalletPayload }) {
    setStatusMessage("Submitting your order...");

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
          ? "Apple Pay is unavailable in this build. You can still use the developer test flow below."
          : "Apple Pay is unavailable in this build right now."
      );
      return;
    }

    setNativeApplePayPending(true);
    setStatusMessage("Opening Apple Pay...");

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
      <View style={[styles.sheet, { paddingTop: 6, paddingBottom: Math.max(insets.bottom, 20) + 24 }]}>
        <View style={styles.handleWrap}>
          <View style={styles.modalHandle} />
        </View>

        <View style={styles.sheetHeader}>
          <View>
            <Text style={styles.sheetEyebrow}>Order Ahead</Text>
            <Text style={styles.sheetTitle}>Cart</Text>
          </View>
        </View>

        <ScrollView
          bounces
          showsVerticalScrollIndicator={false}
          contentInsetAdjustmentBehavior="never"
          contentContainerStyle={styles.sheetContent}
        >
          {items.length === 0 ? (
            <>
              <GlassCard>
                <SectionLabel label="Order Ahead" />
                <View style={styles.emptyHeroHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.emptyTitle}>Nothing is in your cart yet.</Text>
                    <Text style={styles.emptyBody}>
                      Add drinks and bites from the live menu, then come back here to check out.
                    </Text>
                  </View>
                  <View style={styles.heroIconWrap}>
                    <Ionicons name="bag-handle-outline" size={22} color={uiPalette.walnut} />
                  </View>
                </View>
                <View style={styles.detailRow}>
                  <DetailPill icon="time-outline" label={`${storeConfig.prepEtaMinutes} min prep`} />
                  <DetailPill icon="walk-outline" label="Counter pickup" />
                </View>
                <Button
                  label="Browse Menu"
                  onPress={() => router.replace("/(tabs)/menu")}
                  style={{ marginTop: 16, alignSelf: "flex-start" }}
                  left={<Ionicons name="cafe-outline" size={15} color={uiPalette.primaryText} />}
                />
              </GlassCard>
            </>
          ) : (
            <>
              <GlassCard>
                <SectionLabel label="Order Overview" />
                <Text style={styles.heroTitle}>Everything is lined up for pickup.</Text>
                <Text style={styles.heroCopy}>
                  Review the order, adjust quantity, and move through checkout without losing the details.
                </Text>
                <View style={styles.detailRow}>
                  <DetailPill icon="bag-outline" label={`${itemCount} item${itemCount === 1 ? "" : "s"}`} />
                  <DetailPill icon="time-outline" label={`${storeConfig.prepEtaMinutes} min prep`} />
                  <DetailPill icon="cash-outline" label={formatUsd(pricingSummary.totalCents)} />
                </View>
              </GlassCard>

              {retryableOrder ? (
                <StatusBanner
                  message={`Payment for order ${retryableOrder.pickupCode} did not complete. You can retry without rebuilding the cart.`}
                  tone="warning"
                />
              ) : null}

              {items.map((item) => (
                <Card key={item.lineId} style={styles.itemCard}>
                  <View style={styles.itemTopRow}>
                    <View style={styles.itemIconWrap}>
                      <Ionicons name={resolveCartItemIcon(item.name)} size={20} color={uiPalette.walnut} />
                    </View>
                    <View style={styles.itemCopyWrap}>
                      <Text style={styles.itemName}>{item.name}</Text>
                      <Text style={styles.itemMeta}>{describeCustomization(item.customization)}</Text>
                      <Text style={styles.itemMetaMuted}>{formatUsd(item.unitPriceCents)} each</Text>
                    </View>
                    <View style={styles.pricePill}>
                      <Text style={styles.itemLinePrice}>{formatUsd(item.unitPriceCents * item.quantity)}</Text>
                    </View>
                  </View>

                  <View style={styles.controlsRow}>
                    <View style={styles.quantityControls}>
                      <Pressable
                        style={[styles.qtyButton, item.quantity <= 1 ? styles.qtyButtonSoft : null]}
                        onPress={() => {
                          if (item.quantity <= 1) {
                            removeItem(item.lineId);
                            return;
                          }
                          setQuantity(item.lineId, item.quantity - 1);
                        }}
                      >
                        <Ionicons name="remove" size={16} color={uiPalette.text} />
                      </Pressable>
                      <View style={styles.qtyValueShell}>
                        <Text style={styles.qtyValue}>{item.quantity}</Text>
                      </View>
                      <Pressable style={styles.qtyButton} onPress={() => setQuantity(item.lineId, item.quantity + 1)}>
                        <Ionicons name="add" size={16} color={uiPalette.text} />
                      </Pressable>
                    </View>

                    <Pressable style={styles.removePill} onPress={() => removeItem(item.lineId)}>
                      <Ionicons name="trash-outline" size={14} color={uiPalette.walnut} />
                      <Text style={styles.removePillText}>Remove</Text>
                    </Pressable>
                  </View>
                </Card>
              ))}

              <Card>
                <SectionLabel label="Pricing Summary" />
                <Text style={styles.sectionTitle}>Estimated total</Text>
                <View style={{ marginTop: 12, gap: 9 }}>
                  <SummaryRow label={`Items (${itemCount})`} value={formatUsd(pricingSummary.subtotalCents)} />
                  <SummaryRow
                    label={`Tax (${(storeConfig.taxRateBasisPoints / 100).toFixed(2)}%)`}
                    value={formatUsd(pricingSummary.taxCents)}
                  />
                  <View style={styles.summaryDivider} />
                  <SummaryRow label="Total due today" value={formatUsd(pricingSummary.totalCents)} emphasized />
                </View>
              </Card>

              <Card>
                <SectionLabel label="Pickup" />
                <Text style={styles.sectionTitle}>Flagship counter details</Text>
                <Text style={styles.pickupBody}>{storeConfig.pickupInstructions}</Text>
                <View style={styles.detailRow}>
                  <DetailPill icon="time-outline" label={`${storeConfig.prepEtaMinutes} min average`} />
                  <DetailPill icon="navigate-outline" label="Order-ahead pickup" />
                </View>
              </Card>

              {isAuthenticated ? (
                <GlassCard>
                  <SectionLabel label="Checkout" />
                  <Text style={styles.sectionTitle}>Secure pickup payment</Text>
                  <Text style={styles.checkoutBody}>
                    Apple Pay keeps the final step native, fast, and consistent with the rest of the experience.
                  </Text>
                  <Button
                    label={
                      nativeApplePayPending
                        ? "Opening Apple Pay..."
                        : checkoutMutation.isPending
                          ? "Processing..."
                          : retryableOrder
                            ? "Retry Apple Pay"
                            : "Pay with Apple Pay"
                    }
                    disabled={nativeApplePayPending || checkoutMutation.isPending || !nativeApplePayAvailable}
                    onPress={handleNativeApplePayCheckout}
                    style={{ marginTop: 14 }}
                    left={<Ionicons name="logo-apple" size={16} color={uiPalette.primaryText} />}
                  />
                  <Text style={styles.checkoutHint}>
                    {nativeApplePayAvailable
                      ? "Available on supported iPhone builds with Apple Pay configured."
                      : "Apple Pay is unavailable in this build right now."}
                  </Text>

                  {showDevFallback ? (
                    <View style={styles.devPanel}>
                      <SectionLabel label="Developer Test Checkout" />
                      <Text style={styles.devCopy}>
                        Use a sandbox token only when validating checkout in development.
                      </Text>
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
                      <View style={styles.fallbackActions}>
                        <Button
                          label="Use Demo Token"
                          variant="secondary"
                          onPress={() => setApplePayToken(createDemoApplePayToken())}
                          style={{ flex: 1 }}
                        />
                        <Button
                          label={checkoutMutation.isPending ? "Processing..." : retryableOrder ? "Retry Test Payment" : "Run Test Checkout"}
                          variant="ghost"
                          disabled={checkoutMutation.isPending || nativeApplePayPending}
                          onPress={handleApplePayTokenCheckout}
                          style={{ flex: 1 }}
                        />
                      </View>
                    </View>
                  ) : null}
                </GlassCard>
              ) : (
                <Card>
                  <SectionLabel label="Checkout" />
                  <Text style={styles.sectionTitle}>Sign in before payment</Text>
                  <Text style={styles.checkoutBody}>
                    Signing in keeps order history, rewards, and pickup updates attached to your account.
                  </Text>
                  <Button
                    label="Sign In to Checkout"
                    onPress={() => router.push({ pathname: "/auth", params: { returnTo: "cart" } })}
                    style={{ marginTop: 14 }}
                    left={<Ionicons name="log-in-outline" size={16} color={uiPalette.primaryText} />}
                  />
                </Card>
              )}

              {statusMessage ? <StatusBanner message={statusMessage} tone={retryableOrder ? "warning" : "info"} /> : null}

              <View style={styles.footerActions}>
                <Button
                  label="Clear Cart"
                  variant="ghost"
                  onPress={() => {
                    clear();
                    clearFailure();
                    clearRetryOrder();
                    setStatusMessage("");
                  }}
                />
              </View>
            </>
          )}
        </ScrollView>
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
    borderTopLeftRadius: 34,
    borderTopRightRadius: 34,
    backgroundColor: "rgba(246, 239, 230, 0.98)",
    borderWidth: 1,
    borderColor: "rgba(198, 156, 109, 0.16)",
    overflow: "hidden"
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
    width: 36,
    height: 5,
    borderRadius: 999,
    backgroundColor: "rgba(153, 134, 117, 0.42)"
  },
  sheetHeader: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 6,
    flexDirection: "row",
    alignItems: "center"
  },
  sheetEyebrow: {
    fontSize: 12,
    fontWeight: "700",
    color: uiPalette.textMuted,
    textTransform: "uppercase",
    letterSpacing: 1
  },
  sheetTitle: {
    marginTop: 4,
    fontSize: 28,
    fontWeight: "700",
    color: uiPalette.text,
    letterSpacing: -0.8
  },
  sheetContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    gap: 12
  },
  emptyHeroHeader: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 16
  },
  heroIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(198, 156, 109, 0.18)",
    borderWidth: 1,
    borderColor: "rgba(198, 156, 109, 0.24)"
  },
  emptyTitle: {
    fontSize: 28,
    lineHeight: 32,
    fontWeight: "700",
    letterSpacing: -0.8,
    color: uiPalette.text
  },
  emptyBody: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 22,
    color: uiPalette.textSecondary
  },
  heroTitle: {
    marginTop: 8,
    fontSize: 24,
    lineHeight: 30,
    fontWeight: "700",
    letterSpacing: -0.7,
    color: uiPalette.text
  },
  heroCopy: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 22,
    color: uiPalette.textSecondary
  },
  detailRow: {
    marginTop: 14,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  detailPill: {
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
  detailPillText: {
    fontSize: 12,
    fontWeight: "600",
    color: uiPalette.text
  },
  itemCard: {
    gap: 14
  },
  itemTopRow: {
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start"
  },
  itemIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(198, 156, 109, 0.18)",
    borderWidth: 1,
    borderColor: "rgba(198, 156, 109, 0.22)"
  },
  itemCopyWrap: {
    flex: 1,
    minWidth: 0
  },
  itemName: {
    fontSize: 16,
    fontWeight: "700",
    color: uiPalette.text
  },
  itemMeta: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 19,
    color: uiPalette.textSecondary
  },
  itemMetaMuted: {
    marginTop: 4,
    fontSize: 12,
    color: uiPalette.textMuted
  },
  pricePill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: "rgba(255, 248, 240, 0.76)",
    borderWidth: 1,
    borderColor: "rgba(198, 156, 109, 0.16)"
  },
  itemLinePrice: {
    fontSize: 12,
    fontWeight: "700",
    color: uiPalette.walnut
  },
  controlsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  quantityControls: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  qtyButton: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 248, 240, 0.72)",
    borderWidth: 1,
    borderColor: "rgba(198, 156, 109, 0.16)"
  },
  qtyButtonSoft: {
    backgroundColor: "rgba(243, 233, 221, 0.82)"
  },
  qtyValueShell: {
    minWidth: 38,
    alignItems: "center"
  },
  qtyValue: {
    fontSize: 15,
    fontWeight: "700",
    color: uiPalette.text
  },
  removePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "rgba(255, 248, 240, 0.68)"
  },
  removePillText: {
    fontSize: 12,
    fontWeight: "700",
    color: uiPalette.walnut
  },
  sectionTitle: {
    marginTop: 7,
    fontSize: 20,
    fontWeight: "700",
    color: uiPalette.text
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  summaryLabel: {
    fontSize: 13,
    color: uiPalette.textSecondary
  },
  summaryStrong: {
    fontWeight: "700",
    color: uiPalette.text
  },
  summaryDivider: {
    height: 1,
    backgroundColor: uiPalette.border
  },
  pickupBody: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 20,
    color: uiPalette.textSecondary
  },
  checkoutBody: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 20,
    color: uiPalette.textSecondary
  },
  checkoutHint: {
    marginTop: 10,
    fontSize: 12,
    lineHeight: 18,
    color: uiPalette.textMuted
  },
  devPanel: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: uiPalette.border
  },
  devCopy: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 20,
    color: uiPalette.textSecondary
  },
  tokenInput: {
    marginTop: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: uiPalette.border,
    backgroundColor: "rgba(255, 248, 240, 0.92)",
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: uiPalette.text
  },
  fallbackActions: {
    marginTop: 12,
    flexDirection: "row",
    gap: 10
  },
  statusCard: {
    borderColor: "rgba(198, 156, 109, 0.22)"
  },
  statusCardWarning: {
    backgroundColor: "rgba(200, 137, 56, 0.12)"
  },
  statusRow: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center"
  },
  statusIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(198, 156, 109, 0.18)"
  },
  statusIconWrapWarning: {
    backgroundColor: uiPalette.warning
  },
  checkoutStatus: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
    color: uiPalette.text
  },
  footerActions: {
    paddingTop: 4
  }
});
