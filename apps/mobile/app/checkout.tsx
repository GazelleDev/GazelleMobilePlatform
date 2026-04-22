import { Ionicons } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import Constants from "expo-constants";
import * as Linking from "expo-linking";
import { useRouter } from "expo-router";
import { PaymentSheetError, initPaymentSheet, initStripe, presentPaymentSheet } from "@stripe/stripe-react-native";
import { useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { buildPricingSummary, describeCustomization, type CartItem } from "../src/cart/model";
import { useCart } from "../src/cart/store";
import {
  formatUsd,
  resolveAppConfigData,
  resolveStoreConfigData,
  useAppConfigQuery,
  useStoreConfigQuery
} from "../src/menu/catalog";
import {
  CheckoutSubmissionError,
  quoteItemsEqual,
  resolveInlineCheckoutErrorMessage,
  shouldShowCheckoutFailureScreen,
  toQuoteItems,
  useStripeCheckoutMutation
} from "../src/orders/checkout";
import { useCheckoutFlow } from "../src/orders/flow";
import { Button, Card, SectionLabel, uiPalette, uiTypography } from "../src/ui/system";
import { resolveConfiguredApplePayMerchantIdentifier } from "../src/orders/applePay";

function StatusBanner({
  message,
  tone = "info"
}: {
  message: string;
  tone?: "info" | "warning";
}) {
  return (
    <View style={[styles.banner, tone === "warning" ? styles.bannerWarning : null]}>
      <Text style={[styles.bannerText, tone === "warning" ? styles.bannerTextWarning : null]}>{message}</Text>
    </View>
  );
}

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
      <Text style={[styles.summaryLabel, emphasized ? styles.summaryLabelEmphasized : null]}>{label}</Text>
      <Text style={[styles.summaryValue, emphasized ? styles.summaryValueEmphasized : null]}>{value}</Text>
    </View>
  );
}

function BagLineItem({ item }: { item: CartItem }) {
  const customization = describeCustomization(item, {
    includeNotes: true,
    fallback: "Standard preparation"
  });

  return (
    <View style={styles.bagItem}>
      <Text style={styles.bagQuantity}>{item.quantity}x</Text>
      <View style={styles.bagCopy}>
        <Text style={styles.bagItemTitle}>{item.itemName}</Text>
        <Text style={styles.bagItemMeta}>{customization}</Text>
      </View>
      <Text style={styles.bagItemPrice}>{formatUsd(item.lineTotalCents)}</Text>
    </View>
  );
}

function resolveStripeUrlScheme() {
  const configuredScheme = Constants.expoConfig?.scheme;
  if (typeof configuredScheme === "string" && configuredScheme.trim().length > 0) {
    return configuredScheme.trim();
  }

  const fallbackUrl = Linking.createURL("");
  const schemeMatch = fallbackUrl.match(/^([a-z][a-z0-9+\-.]*):/i);
  return schemeMatch?.[1];
}

function resolveStripeReturnUrl() {
  return Constants.appOwnership === "expo" ? Linking.createURL("/--/") : Linking.createURL("");
}

export default function CheckoutScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { items, subtotalCents, clear } = useCart();
  const { retryOrder, clearRetryOrder, clearFailure, setConfirmation, setFailure } = useCheckoutFlow();
  const appConfigQuery = useAppConfigQuery();
  const storeConfigQuery = useStoreConfigQuery();
  const appConfig = appConfigQuery.data ? resolveAppConfigData(appConfigQuery.data) : null;
  const storeConfig = storeConfigQuery.data ? resolveStoreConfigData(storeConfigQuery.data) : null;
  const pricingSummary = buildPricingSummary(subtotalCents, storeConfig?.taxRateBasisPoints ?? 0);
  const checkoutMutation = useStripeCheckoutMutation();
  const storeClosedMessage =
    storeConfig && !storeConfig.isOpen
      ? "The store is currently closed. Come back during opening hours."
      : null;
  const checkoutUnavailableMessage = !storeConfig
    ? "Store details are temporarily unavailable. Retry loading checkout before paying."
    : !appConfig
      ? "Checkout configuration is temporarily unavailable. Retry loading checkout before paying."
      : !appConfig.paymentCapabilities.stripe.enabled
        ? "Stripe checkout is not enabled for this store yet."
        : !appConfig.paymentCapabilities.stripe.onboarded
          ? "Stripe onboarding is incomplete for this store."
          : !appConfig.paymentCapabilities.card && !appConfig.paymentCapabilities.applePay
            ? "No supported mobile payment methods are enabled for this store."
      : storeClosedMessage;
  const checkoutReady = checkoutUnavailableMessage === null;
  const applePayCapabilityEnabled = Boolean(appConfig?.paymentCapabilities.applePay);
  const cardCapabilityEnabled = Boolean(appConfig?.paymentCapabilities.card);
  const quoteItems = useMemo(() => toQuoteItems(items), [items]);
  const retryableOrder = retryOrder && quoteItemsEqual(quoteItems, retryOrder.quoteItems) ? retryOrder : undefined;
  const itemCount = useMemo(() => items.reduce((sum, item) => sum + item.quantity, 0), [items]);
  const applePayMerchantIdentifier = resolveConfiguredApplePayMerchantIdentifier();
  const applePayAvailableInSheet = Boolean(applePayCapabilityEnabled && applePayMerchantIdentifier);
  const supportedPaymentMethodsLabel =
    cardCapabilityEnabled && applePayAvailableInSheet
      ? "Apple Pay and cards"
      : cardCapabilityEnabled
        ? "Cards"
        : applePayAvailableInSheet
          ? "Apple Pay"
          : "Payment methods";
  const brandName = appConfig?.brand.brandName ?? "Your order";
  const storeStatusLabel = storeConfig ? (storeConfig.isOpen ? "Open now" : "Closed right now") : "Store unavailable";
  const etaLabel = storeConfig ? `${storeConfig.prepEtaMinutes} min pickup` : "ETA unavailable";

  const [paymentSheetPending, setPaymentSheetPending] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [statusTone, setStatusTone] = useState<"info" | "warning">("info");

  async function invalidateAccountQueries() {
    await queryClient.invalidateQueries({ queryKey: ["account"] });
  }

  function refreshCheckoutContext() {
    void Promise.allSettled([appConfigQuery.refetch(), storeConfigQuery.refetch()]);
  }

  function dismissCheckoutToCart() {
    router.dismissTo("/cart");
  }

  function dismissCheckout() {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace("/cart");
  }

  async function handleStripeCheckout() {
    if (!storeConfig || !appConfig) {
      setStatusMessage(checkoutUnavailableMessage ?? "Checkout is temporarily unavailable.");
      setStatusTone("warning");
      return;
    }

    if (!storeConfig.isOpen) {
      setStatusMessage(storeClosedMessage ?? "The store is currently closed.");
      setStatusTone("warning");
      return;
    }

    setPaymentSheetPending(true);
    setStatusMessage("Preparing secure payment…");
    setStatusTone("info");

    try {
      const preparedCheckout = await checkoutMutation.mutateAsync({
        locationId: storeConfig.locationId,
        items,
        existingOrder: retryableOrder
      });

      await initStripe({
        publishableKey: preparedCheckout.paymentSession.publishableKey,
        stripeAccountId: preparedCheckout.paymentSession.stripeAccountId,
        merchantIdentifier: preparedCheckout.paymentSession.applePayEnabled ? applePayMerchantIdentifier : undefined,
        urlScheme: resolveStripeUrlScheme()
      });

      const initResult = await initPaymentSheet({
        merchantDisplayName: preparedCheckout.paymentSession.merchantDisplayName,
        paymentIntentClientSecret: preparedCheckout.paymentSession.paymentIntentClientSecret,
        returnURL: resolveStripeReturnUrl(),
        allowsDelayedPaymentMethods: false,
        applePay: preparedCheckout.paymentSession.applePayEnabled
          ? {
              merchantCountryCode: preparedCheckout.paymentSession.merchantCountryCode
            }
          : undefined
      });

      if (initResult.error) {
        throw new CheckoutSubmissionError(initResult.error.message, "pay", preparedCheckout.order);
      }

      setStatusMessage("Waiting for Stripe confirmation…");

      const presentResult = await presentPaymentSheet();
      if (presentResult.error?.code === PaymentSheetError.Canceled) {
        throw new CheckoutSubmissionError("Payment was canceled before completion.", "pay", preparedCheckout.order);
      }

      if (presentResult.error) {
        throw new CheckoutSubmissionError(presentResult.error.message, "pay", preparedCheckout.order);
      }

      setConfirmation({
        orderId: preparedCheckout.order.id,
        pickupCode: preparedCheckout.order.pickupCode,
        status: preparedCheckout.order.status,
        total: preparedCheckout.order.total,
        items: preparedCheckout.order.items,
        occurredAt: new Date().toISOString()
      });
      clear();
      setStatusMessage("");
      setStatusTone("info");
      void invalidateAccountQueries();
      dismissCheckoutToCart();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Checkout failed.";

      if (error instanceof CheckoutSubmissionError) {
        void invalidateAccountQueries();

        if (error.stage === "pay") {
          setStatusMessage("");
          setStatusTone("info");
          setFailure({
            message,
            stage: error.stage,
            occurredAt: new Date().toISOString(),
            order: error.order
          });
          router.replace("/checkout-failure");
          return;
        }

        if (!shouldShowCheckoutFailureScreen(error)) {
          clearFailure();
          clearRetryOrder();
          setStatusMessage(resolveInlineCheckoutErrorMessage(error));
          setStatusTone("warning");
          return;
        }

        setStatusMessage("");
        setStatusTone("info");
        setFailure({
          message,
          stage: error.stage,
          occurredAt: new Date().toISOString(),
          order: error.order
        });
        dismissCheckoutToCart();
        return;
      }

      setStatusMessage(message);
      setStatusTone("warning");
    } finally {
      setPaymentSheetPending(false);
    }
  }
  const scrollBottomPadding = Math.max(insets.bottom, 16) + 24;

  return (
    <View style={styles.screen}>
      <View style={styles.handleWrap}>
        <View style={styles.handle} />
      </View>

      <View style={styles.headerArea}>
        {checkoutUnavailableMessage ? (
          <View style={styles.headerUtilityRow}>
            <Pressable onPress={refreshCheckoutContext} style={({ pressed }) => [styles.inlineAction, pressed ? styles.inlineActionPressed : null]}>
              <Ionicons name="refresh-outline" size={15} color={uiPalette.textSecondary} />
              <Text style={styles.inlineActionText}>Retry</Text>
            </Pressable>
          </View>
        ) : null}

        <Text style={styles.headerTitle}>Checkout</Text>
        <Text style={styles.headerSubtitle}>
          {storeConfig
            ? storeConfig.isOpen
              ? `${brandName} • ${etaLabel}`
              : "Store closed"
            : "Checkout details unavailable"}
        </Text>
      </View>

      <ScrollView
        bounces
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="never"
        contentContainerStyle={[styles.content, { paddingBottom: scrollBottomPadding }]}
      >
        {items.length === 0 ? (
          <Card style={styles.emptyState}>
            <Text style={styles.emptyTitle}>Your cart is empty.</Text>
            <Text style={styles.emptyBody}>Add items from the menu before opening checkout.</Text>
            <Button label="Back to cart" variant="secondary" onPress={dismissCheckout} />
          </Card>
        ) : (
          <>
            {retryableOrder ? (
              <StatusBanner
                message={`Payment for order ${retryableOrder.pickupCode} did not complete. You can retry without rebuilding the bag.`}
                tone="warning"
              />
            ) : null}

            <Card style={styles.sectionCard}>
              <SectionLabel label="Order" />
              <Text style={styles.sectionTitle}>Summary</Text>
              <View style={styles.summaryMetaRow}>
                <Text style={styles.summaryMetaText}>
                  {itemCount} {itemCount === 1 ? "item" : "items"}
                </Text>
                <Text style={styles.summaryMetaDot}>•</Text>
                <Text style={styles.summaryMetaText}>{storeStatusLabel}</Text>
              </View>
              {storeConfig?.pickupInstructions ? (
                <Text style={styles.sectionBody}>{storeConfig.pickupInstructions}</Text>
              ) : null}

              <View style={styles.bagList}>
                {items.map((item) => (
                  <BagLineItem key={item.lineId} item={item} />
                ))}
              </View>

              <View style={styles.sectionDivider} />

              <SummaryRow label="Subtotal" value={formatUsd(pricingSummary.subtotalCents)} />
              <SummaryRow label="Tax" value={formatUsd(pricingSummary.taxCents)} />
              <SummaryRow label="Total" value={formatUsd(pricingSummary.totalCents)} emphasized />
            </Card>

            <Card style={styles.sectionCard}>
              <SectionLabel label="Payment" />
              <Text style={styles.sectionTitle}>Secure Stripe checkout</Text>
              <Text style={styles.sectionBody}>
                {supportedPaymentMethodsLabel} are collected inside Stripe PaymentSheet. The app never handles raw card
                data directly.
              </Text>
              <Text style={styles.sectionBody}>
                Your order stays pending until the backend receives a verified Stripe webhook and marks it paid.
              </Text>

              <Button
                label={paymentSheetPending || checkoutMutation.isPending ? "Opening secure payment…" : `Pay ${formatUsd(pricingSummary.totalCents)}`}
                variant="secondary"
                disabled={!checkoutReady || paymentSheetPending || checkoutMutation.isPending}
                onPress={() => {
                  void handleStripeCheckout();
                }}
                style={styles.fullWidthButton}
              />
            </Card>

            {checkoutUnavailableMessage || statusMessage ? (
              <View style={styles.bottomStatusStack}>
                {checkoutUnavailableMessage ? <StatusBanner message={checkoutUnavailableMessage} tone="warning" /> : null}

                {statusMessage ? (
                  <StatusBanner message={statusMessage} tone={statusTone === "warning" ? "warning" : "info"} />
                ) : null}
              </View>
            ) : null}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: uiPalette.background
  },
  handleWrap: {
    position: "absolute",
    top: 14,
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
  headerArea: {
    paddingHorizontal: 20,
    paddingTop: 30,
    paddingBottom: 8
  },
  headerUtilityRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    marginBottom: 12
  },
  inlineAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4
  },
  inlineActionPressed: {
    opacity: 0.72
  },
  inlineActionText: {
    fontSize: 14,
    lineHeight: 18,
    color: uiPalette.textSecondary
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
    maxWidth: 320,
    fontSize: 13,
    lineHeight: 18,
    color: uiPalette.textSecondary
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 4,
    gap: 12
  },
  emptyState: {
    marginTop: 6,
    gap: 14
  },
  emptyTitle: {
    fontSize: 30,
    lineHeight: 34,
    color: uiPalette.text,
    fontFamily: uiTypography.displayFamily
  },
  emptyBody: {
    fontSize: 15,
    lineHeight: 22,
    color: uiPalette.textSecondary
  },
  banner: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 18,
    backgroundColor: uiPalette.surfaceMuted,
    borderWidth: 1,
    borderColor: uiPalette.border
  },
  bannerWarning: {
    backgroundColor: "rgba(176, 122, 58, 0.08)",
    borderColor: "rgba(176, 122, 58, 0.18)"
  },
  bannerText: {
    fontSize: 13,
    lineHeight: 19,
    color: uiPalette.textSecondary
  },
  bannerTextWarning: {
    color: uiPalette.text
  },
  sectionCard: {
    gap: 0
  },
  sectionTitle: {
    marginTop: 8,
    fontSize: 22,
    lineHeight: 26,
    fontWeight: "700",
    color: uiPalette.text,
    fontFamily: uiTypography.displayFamily
  },
  sectionBody: {
    marginTop: 10,
    fontSize: 13,
    lineHeight: 18,
    color: uiPalette.textSecondary
  },
  summaryMetaRow: {
    marginTop: 10,
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 8
  },
  summaryMetaText: {
    fontSize: 13,
    lineHeight: 18,
    color: uiPalette.textSecondary
  },
  summaryMetaDot: {
    fontSize: 13,
    lineHeight: 18,
    color: uiPalette.textMuted
  },
  bagList: {
    marginTop: 16,
    gap: 14
  },
  bagItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12
  },
  bagQuantity: {
    width: 28,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "700",
    color: uiPalette.textSecondary
  },
  bagCopy: {
    flex: 1,
    gap: 4
  },
  bagItemTitle: {
    fontSize: 15,
    lineHeight: 19,
    color: uiPalette.text,
    fontWeight: "700"
  },
  bagItemMeta: {
    fontSize: 13,
    lineHeight: 18,
    color: uiPalette.textSecondary
  },
  bagItemPrice: {
    fontSize: 15,
    lineHeight: 19,
    color: uiPalette.text,
    fontWeight: "700"
  },
  sectionDivider: {
    marginVertical: 18,
    height: 1,
    backgroundColor: uiPalette.border
  },
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 4
  },
  summaryLabel: {
    fontSize: 14,
    lineHeight: 20,
    color: uiPalette.textSecondary
  },
  summaryLabelEmphasized: {
    color: uiPalette.text,
    fontWeight: "700"
  },
  summaryValue: {
    fontSize: 14,
    lineHeight: 20,
    color: uiPalette.text
  },
  summaryValueEmphasized: {
    fontSize: 18,
    lineHeight: 22,
    fontWeight: "700"
  },
  primaryField: {
    marginTop: 16
  },
  fieldLabel: {
    marginBottom: 8,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 1.5,
    textTransform: "uppercase",
    color: uiPalette.textSecondary,
    fontWeight: "700"
  },
  fieldInput: {
    minHeight: 56,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: uiPalette.border,
    backgroundColor: uiPalette.surfaceStrong,
    paddingHorizontal: 14,
    color: uiPalette.text,
    fontSize: 16,
    lineHeight: 20
  },
  fieldGrid: {
    marginTop: 14,
    flexDirection: "row",
    gap: 10
  },
  fieldGridItem: {
    flex: 1
  },
  fullWidthButton: {
    marginTop: 16
  },
  actions: {
    marginTop: 16,
    flexDirection: "row",
    gap: 10
  },
  actionButton: {
    flex: 1
  },
  bottomStatusStack: {
    marginTop: 4,
    gap: 12
  },
  bottomDock: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 20,
    paddingTop: 16
  },
  applePayPressable: {
    width: "100%"
  },
  applePayPressableDisabled: {
    opacity: 1
  },
  applePayPressablePressed: {
    opacity: 0.88
  },
  applePayNativeButton: {
    height: 54,
    width: "100%",
    borderRadius: 18
  }
});
