import { Ionicons } from "@expo/vector-icons";
import { Link } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuthSession } from "../../src/auth/session";
import { buildPricingSummary, describeCustomization } from "../../src/cart/model";
import { useCart } from "../../src/cart/store";
import { formatUsd, resolveStoreConfigData, useStoreConfigQuery } from "../../src/menu/catalog";
import {
  canAttemptNativeApplePay,
  requestNativeApplePayWallet,
  type ApplePayWalletPayload
} from "../../src/orders/applePay";
import { createDemoApplePayToken, useApplePayCheckoutMutation } from "../../src/orders/checkout";
import { Button, Card, ScreenScroll, SectionLabel, TitleBlock, uiPalette } from "../../src/ui/system";

function SummaryRow({ label, value, emphasized = false }: { label: string; value: string; emphasized?: boolean }) {
  return (
    <View style={styles.summaryRow}>
      <Text style={[styles.summaryLabel, emphasized ? styles.summaryStrong : null]}>{label}</Text>
      <Text style={[styles.summaryLabel, emphasized ? styles.summaryStrong : null]}>{value}</Text>
    </View>
  );
}

export default function CartScreen() {
  const insets = useSafeAreaInsets();
  const { isAuthenticated } = useAuthSession();
  const { items, itemCount, subtotalCents, setQuantity, removeItem, clear } = useCart();
  const storeConfigQuery = useStoreConfigQuery();
  const storeConfig = resolveStoreConfigData(storeConfigQuery.data);
  const pricingSummary = buildPricingSummary(subtotalCents, storeConfig.taxRateBasisPoints);
  const checkoutMutation = useApplePayCheckoutMutation();
  const nativeApplePayAvailable = canAttemptNativeApplePay();
  const [applePayToken, setApplePayToken] = useState("demo-apple-pay-token");
  const [nativeApplePayPending, setNativeApplePayPending] = useState(false);
  const [checkoutStatus, setCheckoutStatus] = useState("");

  function submitCheckout(paymentInput: { applePayToken: string } | { applePayWallet: ApplePayWalletPayload }) {
    setCheckoutStatus("Submitting Apple Pay payment...");

    checkoutMutation.mutate(
      {
        locationId: storeConfig.locationId,
        items,
        ...paymentInput
      },
      {
        onSuccess: (paidOrder) => {
          setNativeApplePayPending(false);
          clear();
          setCheckoutStatus(`Payment accepted. Pickup code ${paidOrder.pickupCode}.`);
        },
        onError: (error) => {
          setNativeApplePayPending(false);
          const message = error instanceof Error ? error.message : "Checkout failed.";
          setCheckoutStatus(message);
        }
      }
    );
  }

  function handleApplePayTokenCheckout() {
    const token = applePayToken.trim();
    if (!token) {
      setCheckoutStatus("Enter an Apple Pay token before checkout.");
      return;
    }

    setApplePayToken("");
    submitCheckout({ applePayToken: token });
  }

  async function handleNativeApplePayCheckout() {
    if (!nativeApplePayAvailable) {
      setCheckoutStatus("Native Apple Pay is unavailable in this build. Use fallback token mode.");
      return;
    }

    setNativeApplePayPending(true);
    setCheckoutStatus("Opening Apple Pay sheet...");

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
      setCheckoutStatus(message);
    }
  }

  return (
    <ScreenScroll>
      <TitleBlock title="Cart" subtitle="Review line items, pricing, and checkout details before submitting." />

      {items.length === 0 ? (
        <Card style={{ marginTop: 14 }}>
          <SectionLabel label="Empty Cart" />
          <Text style={styles.emptyBody}>Your cart is empty. Add items from the menu to begin checkout.</Text>
          <Link href="/(tabs)/menu" asChild>
            <Pressable>
              <Button
                label="Browse Menu"
                style={{ marginTop: 12, alignSelf: "flex-start" }}
                left={<Ionicons name="cafe-outline" size={15} color="#FFFFFF" />}
              />
            </Pressable>
          </Link>
        </Card>
      ) : (
        <View style={{ marginTop: 14, gap: 12 }}>
          {items.map((item) => (
            <Card key={item.lineId}>
              <View style={styles.itemTopRow}>
                <Text style={styles.itemName}>{item.name}</Text>
                <Text style={styles.itemLinePrice}>{formatUsd(item.unitPriceCents * item.quantity)}</Text>
              </View>
              <Text style={styles.itemMeta}>{describeCustomization(item.customization)}</Text>
              <Text style={styles.itemMetaMuted}>{formatUsd(item.unitPriceCents)} each</Text>

              <View style={styles.controlsRow}>
                <View style={styles.quantityControls}>
                  <Pressable style={styles.qtyButton} onPress={() => setQuantity(item.lineId, item.quantity - 1)}>
                    <Ionicons name="remove" size={16} color={uiPalette.text} />
                  </Pressable>
                  <Text style={styles.qtyValue}>{item.quantity}</Text>
                  <Pressable style={styles.qtyButton} onPress={() => setQuantity(item.lineId, item.quantity + 1)}>
                    <Ionicons name="add" size={16} color={uiPalette.text} />
                  </Pressable>
                </View>

                <Button label="Remove" variant="ghost" onPress={() => removeItem(item.lineId)} />
              </View>
            </Card>
          ))}

          <Card>
            <SectionLabel label="Pricing Summary" />
            <View style={{ marginTop: 10, gap: 8 }}>
              <SummaryRow label={`Items (${itemCount})`} value={formatUsd(pricingSummary.subtotalCents)} />
              <SummaryRow
                label={`Tax (${(storeConfig.taxRateBasisPoints / 100).toFixed(2)}%)`}
                value={formatUsd(pricingSummary.taxCents)}
              />
              <View style={styles.summaryDivider} />
              <SummaryRow label="Estimated Total" value={formatUsd(pricingSummary.totalCents)} emphasized />
            </View>
          </Card>

          <Card>
            <SectionLabel label="Pickup" />
            <Text style={styles.pickupBody}>{storeConfig.pickupInstructions}</Text>
            <Text style={styles.pickupMeta}>Estimated prep time: {storeConfig.prepEtaMinutes} min</Text>
          </Card>

          {isAuthenticated ? (
            <Card>
              <SectionLabel label="Apple Pay" />
              <Button
                label={
                  nativeApplePayPending ? "Opening Apple Pay..." : checkoutMutation.isPending ? "Processing..." : "Pay with Apple Pay"
                }
                disabled={nativeApplePayPending || checkoutMutation.isPending || !nativeApplePayAvailable}
                onPress={handleNativeApplePayCheckout}
                style={{ marginTop: 10 }}
              />
              <Text style={styles.checkoutHint}>
                Native Apple Pay requires iOS support and a build with Apple Pay entitlements.
              </Text>

              <SectionLabel label="Fallback Token Mode (Dev)" />
              <TextInput
                value={applePayToken}
                onChangeText={setApplePayToken}
                autoCapitalize="none"
                autoCorrect={false}
                secureTextEntry
                placeholder="Apple Pay token"
                placeholderTextColor={uiPalette.textMuted}
                style={styles.tokenInput}
              />
              <View style={styles.fallbackActions}>
                <Button label="Use Demo Token" variant="secondary" onPress={() => setApplePayToken(createDemoApplePayToken())} />
                <Button
                  label={checkoutMutation.isPending ? "Processing..." : "Pay with Token"}
                  variant="ghost"
                  disabled={checkoutMutation.isPending || nativeApplePayPending}
                  onPress={handleApplePayTokenCheckout}
                />
              </View>
              <Text style={styles.checkoutHint}>Token fallback is for local simulation and manual testing only.</Text>
            </Card>
          ) : (
            <Link href={{ pathname: "/auth", params: { returnTo: "/(tabs)/cart" } }} asChild>
              <Pressable>
                <Button label="Sign In to Checkout" style={{ marginTop: 2 }} />
              </Pressable>
            </Link>
          )}

          <Button
            label="Clear Cart"
            variant="ghost"
            onPress={() => {
              clear();
              setCheckoutStatus("");
            }}
          />

          {checkoutStatus ? <Text style={styles.checkoutStatus}>{checkoutStatus}</Text> : null}

          {storeConfigQuery.error ? (
            <Text style={styles.checkoutHint}>Using fallback store settings while live config is unavailable.</Text>
          ) : null}
        </View>
      )}

      <View style={{ height: Math.max(insets.bottom, 16) }} />
    </ScreenScroll>
  );
}

const styles = StyleSheet.create({
  emptyBody: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 20,
    color: uiPalette.textSecondary
  },
  itemTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10
  },
  itemName: {
    flex: 1,
    fontSize: 16,
    fontWeight: "700",
    color: uiPalette.text
  },
  itemLinePrice: {
    fontSize: 14,
    fontWeight: "700",
    color: uiPalette.text
  },
  itemMeta: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 18,
    color: uiPalette.textSecondary
  },
  itemMetaMuted: {
    marginTop: 2,
    fontSize: 12,
    color: uiPalette.textMuted
  },
  controlsRow: {
    marginTop: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10
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
    borderWidth: 1,
    borderColor: uiPalette.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.9)"
  },
  qtyValue: {
    width: 22,
    textAlign: "center",
    fontSize: 14,
    fontWeight: "700",
    color: uiPalette.text
  },
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  summaryLabel: {
    fontSize: 13,
    color: uiPalette.textSecondary
  },
  summaryStrong: {
    fontSize: 15,
    fontWeight: "700",
    color: uiPalette.text
  },
  summaryDivider: {
    marginVertical: 3,
    height: 1,
    backgroundColor: uiPalette.border
  },
  pickupBody: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 20,
    color: uiPalette.textSecondary
  },
  pickupMeta: {
    marginTop: 4,
    fontSize: 12,
    color: uiPalette.textMuted
  },
  checkoutHint: {
    marginTop: 10,
    fontSize: 12,
    lineHeight: 16,
    color: uiPalette.textMuted
  },
  tokenInput: {
    marginTop: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: uiPalette.border,
    backgroundColor: "rgba(255,255,255,0.88)",
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: uiPalette.text
  },
  fallbackActions: {
    marginTop: 10,
    flexDirection: "row",
    gap: 8
  },
  checkoutStatus: {
    fontSize: 12,
    lineHeight: 17,
    color: uiPalette.textSecondary
  }
});
