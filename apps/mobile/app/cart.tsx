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
import { canAttemptNativeApplePay, requestNativeApplePayWallet, type ApplePayWalletPayload } from "../src/orders/applePay";
import {
  CheckoutSubmissionError,
  createDemoApplePayToken,
  quoteItemsEqual,
  toQuoteItems,
  useApplePayCheckoutMutation
} from "../src/orders/checkout";
import { useCheckoutFlow } from "../src/orders/flow";
import { Button, Card, GlassCard, SectionLabel, uiPalette, uiTypography } from "../src/ui/system";

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

function StepHeader({
  index,
  title,
  subtitle
}: {
  index: string;
  title: string;
  subtitle: string;
}) {
  return (
    <View style={styles.stepHeader}>
      <View style={styles.stepBadge}>
        <Text style={styles.stepBadgeText}>{index}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.stepTitle}>{title}</Text>
        <Text style={styles.stepSubtitle}>{subtitle}</Text>
      </View>
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

function resolveItemIcon(name: string): keyof typeof Ionicons.glyphMap {
  const haystack = name.toLowerCase();
  if (haystack.includes("tea") || haystack.includes("matcha")) return "leaf-outline";
  if (haystack.includes("croissant") || haystack.includes("cookie") || haystack.includes("muffin") || haystack.includes("pastry")) return "nutrition-outline";
  if (haystack.includes("latte") || haystack.includes("espresso") || haystack.includes("coffee") || haystack.includes("cappuccino")) return "cafe-outline";
  return "sparkles-outline";
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
      <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) + 16 }]}>
        <View style={styles.handleWrap}>
          <View style={styles.modalHandle} />
        </View>

        <View style={styles.header}>
          <Text style={styles.headerEyebrow}>Checkout</Text>
          <Text style={styles.headerTitle}>Cart</Text>
        </View>

        <ScrollView
          bounces
          showsVerticalScrollIndicator={false}
          contentInsetAdjustmentBehavior="never"
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingBottom: Math.max(insets.bottom, 16) + 28
          }}
        >
          {items.length === 0 ? (
            <GlassCard>
              <SectionLabel label="No items yet" />
              <Text style={styles.emptyTitle}>Your order starts from the menu.</Text>
              <Text style={styles.emptyBody}>
                Build the bag first, then come back here to review items, confirm pickup, and pay with Apple Pay.
              </Text>
              <Button
                label="Browse Menu"
                onPress={() => router.replace("/(tabs)/menu")}
                left={<Ionicons name="cafe-outline" size={16} color={uiPalette.primaryText} />}
                style={{ marginTop: 18, alignSelf: "flex-start" }}
              />
            </GlassCard>
          ) : (
            <>
              <GlassCard>
                <SectionLabel label="Overview" />
                <Text style={styles.heroTitle}>{`${itemCount} item${itemCount === 1 ? "" : "s"} ready for review`}</Text>
                <Text style={styles.heroBody}>
                  The checkout flow is split into three steps: review the bag, confirm pickup, then pay.
                </Text>
                <View style={styles.heroMeta}>
                  <Text style={styles.heroMetaText}>{formatUsd(pricingSummary.totalCents)}</Text>
                  <Text style={styles.heroMetaDivider}>•</Text>
                  <Text style={styles.heroMetaText}>{storeConfig.prepEtaMinutes} min prep</Text>
                </View>
              </GlassCard>

              {retryableOrder ? (
                <StatusBanner
                  message={`Payment for order ${retryableOrder.pickupCode} did not complete. You can retry without rebuilding the bag.`}
                  tone="warning"
                />
              ) : null}

              <Card style={{ marginTop: 14 }}>
                <StepHeader index="1" title="Review items" subtitle="Adjust quantity before payment." />
                <View style={styles.groupedList}>
                  {items.map((item, index) => (
                    <View key={item.lineId}>
                      <View style={styles.itemRow}>
                        <View style={styles.itemIcon}>
                          <Ionicons name={resolveItemIcon(item.itemName)} size={18} color={uiPalette.accent} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.itemTitle}>{item.itemName}</Text>
                          <Text style={styles.itemBody}>{describeCustomization(item)}</Text>
                          <Text style={styles.itemMeta}>{formatUsd(item.unitPriceCents)} each</Text>
                        </View>
                        <Text style={styles.itemPrice}>{formatUsd(item.lineTotalCents)}</Text>
                      </View>

                      <View style={styles.itemActions}>
                        <View style={styles.stepper}>
                          <Pressable
                            style={[styles.stepperButton, item.quantity <= 1 ? styles.stepperButtonDisabled : null]}
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
                          <Text style={styles.stepperValue}>{item.quantity}</Text>
                          <Pressable style={styles.stepperButton} onPress={() => setQuantity(item.lineId, item.quantity + 1)}>
                            <Ionicons name="add" size={16} color={uiPalette.text} />
                          </Pressable>
                        </View>

                        <Pressable style={styles.removeButton} onPress={() => removeItem(item.lineId)}>
                          <Text style={styles.removeButtonText}>Remove</Text>
                        </Pressable>
                      </View>

                      {index < items.length - 1 ? <View style={styles.divider} /> : null}
                    </View>
                  ))}
                </View>
              </Card>

              <Card style={{ marginTop: 12 }}>
                <StepHeader index="2" title="Pickup" subtitle="Confirm the handoff details." />
                <Text style={styles.pickupBody}>{storeConfig.pickupInstructions}</Text>
                <View style={styles.pickupMeta}>
                  <View style={styles.pickupPill}>
                    <Ionicons name="time-outline" size={14} color={uiPalette.accent} />
                    <Text style={styles.pickupPillText}>{storeConfig.prepEtaMinutes} min average</Text>
                  </View>
                  <View style={styles.pickupPill}>
                    <Ionicons name="walk-outline" size={14} color={uiPalette.accent} />
                    <Text style={styles.pickupPillText}>Counter pickup</Text>
                  </View>
                </View>
              </Card>

              <Card style={{ marginTop: 12 }}>
                <StepHeader index="3" title="Summary" subtitle="Check totals before payment." />
                <View style={styles.summaryWrap}>
                  <SummaryRow label={`Items (${itemCount})`} value={formatUsd(pricingSummary.subtotalCents)} />
                  <SummaryRow label={`Tax (${(storeConfig.taxRateBasisPoints / 100).toFixed(2)}%)`} value={formatUsd(pricingSummary.taxCents)} />
                  <View style={styles.divider} />
                  <SummaryRow label="Total due today" value={formatUsd(pricingSummary.totalCents)} emphasized />
                </View>
              </Card>

              {isAuthenticated ? (
                <GlassCard style={{ marginTop: 12 }}>
                  <SectionLabel label="Payment" />
                  <Text style={styles.payTitle}>Pay with Apple Pay</Text>
                  <Text style={styles.payBody}>
                    Apple Pay keeps the final step native, quick, and separate from the rest of the form flow.
                  </Text>
                  <Button
                    label={
                      nativeApplePayPending
                        ? "Opening Apple Pay…"
                        : checkoutMutation.isPending
                          ? "Processing…"
                          : retryableOrder
                            ? "Retry Apple Pay"
                            : "Pay with Apple Pay"
                    }
                    disabled={nativeApplePayPending || checkoutMutation.isPending || !nativeApplePayAvailable}
                    onPress={handleNativeApplePayCheckout}
                    style={{ marginTop: 16 }}
                    left={<Ionicons name="logo-apple" size={16} color={uiPalette.primaryText} />}
                  />

                  {showDevFallback ? (
                    <View style={styles.devSection}>
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
                </GlassCard>
              ) : (
                <Card style={{ marginTop: 12 }}>
                  <SectionLabel label="Sign in" />
                  <Text style={styles.payTitle}>Sign in before payment.</Text>
                  <Text style={styles.payBody}>
                    Session, rewards, and order history stay attached to the right account when checkout begins from a signed-in state.
                  </Text>
                  <Button
                    label="Sign In to Checkout"
                    onPress={() => router.push({ pathname: "/auth", params: { returnTo: "cart" } })}
                    style={{ marginTop: 16 }}
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
    backgroundColor: "rgba(246, 247, 244, 0.98)",
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
  header: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 12
  },
  headerEyebrow: {
    fontSize: 11,
    lineHeight: 14,
    textTransform: "uppercase",
    letterSpacing: 1.2,
    color: uiPalette.textMuted,
    fontWeight: "700"
  },
  headerTitle: {
    marginTop: 4,
    fontSize: 34,
    lineHeight: 38,
    fontWeight: "700",
    letterSpacing: -1,
    color: uiPalette.text,
    fontFamily: uiTypography.displayFamily
  },
  emptyTitle: {
    marginTop: 10,
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
  heroTitle: {
    marginTop: 10,
    fontSize: 30,
    lineHeight: 34,
    fontWeight: "700",
    letterSpacing: -0.8,
    color: uiPalette.text,
    fontFamily: uiTypography.displayFamily
  },
  heroBody: {
    marginTop: 10,
    fontSize: 14,
    lineHeight: 22,
    color: uiPalette.textSecondary
  },
  heroMeta: {
    marginTop: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  heroMetaText: {
    fontSize: 14,
    lineHeight: 18,
    fontWeight: "600",
    color: uiPalette.text
  },
  heroMetaDivider: {
    color: uiPalette.textMuted
  },
  banner: {
    marginTop: 12,
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
  stepHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12
  },
  stepBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: uiPalette.accentSoft
  },
  stepBadgeText: {
    fontSize: 12,
    lineHeight: 14,
    fontWeight: "700",
    color: uiPalette.accent
  },
  stepTitle: {
    fontSize: 18,
    lineHeight: 22,
    fontWeight: "600",
    color: uiPalette.text
  },
  stepSubtitle: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 19,
    color: uiPalette.textSecondary
  },
  groupedList: {
    marginTop: 16
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14
  },
  itemIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: uiPalette.accentSoft
  },
  itemTitle: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: "600",
    color: uiPalette.text
  },
  itemBody: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 19,
    color: uiPalette.textSecondary
  },
  itemMeta: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 16,
    color: uiPalette.textMuted
  },
  itemPrice: {
    fontSize: 15,
    lineHeight: 18,
    fontWeight: "600",
    color: uiPalette.text
  },
  itemActions: {
    marginTop: 12,
    marginBottom: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  stepper: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  stepperButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: uiPalette.border,
    backgroundColor: uiPalette.surfaceStrong
  },
  stepperButtonDisabled: {
    opacity: 0.55
  },
  stepperValue: {
    minWidth: 18,
    fontSize: 16,
    lineHeight: 20,
    fontWeight: "600",
    textAlign: "center",
    color: uiPalette.text
  },
  removeButton: {
    paddingHorizontal: 10,
    paddingVertical: 8
  },
  removeButtonText: {
    fontSize: 13,
    lineHeight: 17,
    fontWeight: "600",
    color: uiPalette.danger
  },
  divider: {
    height: 1,
    backgroundColor: uiPalette.border
  },
  pickupBody: {
    marginTop: 16,
    fontSize: 14,
    lineHeight: 22,
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
  summaryWrap: {
    marginTop: 16,
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
  payTitle: {
    marginTop: 10,
    fontSize: 22,
    lineHeight: 26,
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
    marginTop: 16
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
  footerActions: {
    marginTop: 12,
    alignItems: "flex-start"
  }
});
