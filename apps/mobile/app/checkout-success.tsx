import { useRouter } from "expo-router";
import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { GlassActionPill } from "../src/cart/GlassActionPill";
import { formatUsd } from "../src/menu/catalog";
import { useCheckoutFlow, type CheckoutConfirmation } from "../src/orders/flow";
import { formatOrderStatus } from "../src/orders/history";
import { uiPalette, uiTypography } from "../src/ui/system";

const DEV_PREVIEW_CONFIRMATION: CheckoutConfirmation = {
  orderId: "dev-order-confirmation-preview",
  pickupCode: "47311C",
  status: "PAID",
  total: { amountCents: 795, currency: "USD" },
  occurredAt: "2026-03-20T09:15:00.000Z"
};

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
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={[styles.summaryValue, emphasized ? styles.summaryValueStrong : null]}>{value}</Text>
    </View>
  );
}

export default function CheckoutSuccessScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { confirmation, clearConfirmation } = useCheckoutFlow();
  const resolvedConfirmation = confirmation ?? (__DEV__ ? DEV_PREVIEW_CONFIRMATION : null);

  useEffect(() => {
    return () => {
      clearConfirmation();
    };
  }, [clearConfirmation]);

  function goToOrders() {
    clearConfirmation();
    router.dismissTo("/(tabs)/orders");
  }

  function goToMenu() {
    clearConfirmation();
    router.dismissTo("/(tabs)/menu");
  }

  return (
    <View style={styles.screen}>
      <View style={styles.content}>
        <View style={styles.mainContent}>
          {resolvedConfirmation ? (
            <>
              <View style={styles.heroBlock}>
                <Text style={styles.title}>Order Confirmed</Text>
                <Text style={styles.body}>Your pickup code is below. Track live progress anytime from Orders.</Text>
              </View>

              <View style={styles.pickupCodeStage}>
                <View style={styles.pickupCodeBlock}>
                  <Text style={styles.pickupCodeLabel}>Pickup code</Text>
                  <Text style={styles.pickupCodeValue}>{resolvedConfirmation.pickupCode}</Text>
                  <Text style={styles.pickupCodeFootnote}>Show this at the counter when your order is ready.</Text>
                </View>
              </View>

              <View style={styles.summarySection}>
                <SummaryRow label="Status" value={formatOrderStatus(resolvedConfirmation.status)} />
                <SummaryRow label="Total" value={formatUsd(resolvedConfirmation.total.amountCents)} emphasized />
              </View>
            </>
          ) : (
            <View style={styles.heroBlockEmpty}>
              <Text style={styles.title}>Confirmation unavailable.</Text>
              <Text style={styles.body}>
                This checkout finished, but the in-memory confirmation is no longer available. You can still review the latest order from Orders.
              </Text>
            </View>
          )}
        </View>

        <View style={[styles.footerContent, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          {resolvedConfirmation ? (
            <>
              <GlassActionPill label="Track Order" onPress={goToOrders} tone="dark" />
              <GlassActionPill label="Back to Menu" onPress={goToMenu} />
            </>
          ) : (
            <>
              <GlassActionPill label="View Orders" onPress={goToOrders} tone="dark" />
              <GlassActionPill label="Back to Menu" onPress={goToMenu} />
            </>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: uiPalette.surfaceStrong
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 40,
    justifyContent: "space-between"
  },
  mainContent: {
    flex: 1
  },
  heroBlock: {
    paddingBottom: 18,
    borderBottomWidth: 1,
    borderBottomColor: uiPalette.border
  },
  heroBlockEmpty: {
    paddingBottom: 0
  },
  title: {
    fontSize: 19,
    lineHeight: 24,
    letterSpacing: 2,
    textTransform: "uppercase",
    color: uiPalette.text,
    fontFamily: uiTypography.displayFamily,
    fontWeight: "600"
  },
  body: {
    marginTop: 8,
    maxWidth: 520,
    fontSize: 15,
    lineHeight: 22,
    color: uiPalette.textSecondary
  },
  pickupCodeStage: {
    flex: 1,
    justifyContent: "center"
  },
  pickupCodeBlock: {
    paddingTop: 18,
    paddingBottom: 18,
    alignItems: "center",
    justifyContent: "center"
  },
  pickupCodeLabel: {
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 1.1,
    textTransform: "uppercase",
    color: uiPalette.textMuted,
    fontWeight: "700",
    textAlign: "center"
  },
  pickupCodeValue: {
    marginTop: 8,
    fontSize: 34,
    lineHeight: 40,
    letterSpacing: 1.2,
    color: uiPalette.text,
    fontFamily: uiTypography.displayFamily,
    fontWeight: "700",
    textAlign: "center"
  },
  pickupCodeFootnote: {
    marginTop: 6,
    fontSize: 14,
    lineHeight: 20,
    color: uiPalette.textSecondary,
    textAlign: "center"
  },
  summarySection: {
    paddingTop: 2
  },
  summaryRow: {
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: uiPalette.border,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16
  },
  summaryLabel: {
    fontSize: 14,
    lineHeight: 20,
    color: uiPalette.textSecondary
  },
  summaryValue: {
    flexShrink: 1,
    fontSize: 14,
    lineHeight: 20,
    color: uiPalette.text,
    textAlign: "right"
  },
  summaryValueStrong: {
    fontFamily: uiTypography.displayFamily,
    fontWeight: "600",
    letterSpacing: 1,
    textTransform: "uppercase"
  },
  footerContent: {
    marginTop: "auto",
    paddingTop: 18,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: uiPalette.border,
    gap: 12
  }
});
