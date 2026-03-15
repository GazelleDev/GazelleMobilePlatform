import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { useCheckoutFlow } from "../src/orders/flow";
import { formatOrderDateTime, formatOrderStatus } from "../src/orders/history";
import { Button, Card, GlassCard, ScreenScroll, SectionLabel, TitleBlock, uiPalette } from "../src/ui/system";

function MetricTile({
  label,
  value
}: {
  label: string;
  value: string;
}) {
  return (
    <View style={styles.metricTile}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

export default function CheckoutSuccessScreen() {
  const router = useRouter();
  const { confirmation, clearConfirmation } = useCheckoutFlow();

  if (!confirmation) {
    return (
      <ScreenScroll>
        <TitleBlock title="Order Confirmed" subtitle="Your last checkout finished, but this screen no longer has the confirmation payload in memory." />
        <Card style={{ marginTop: 16 }}>
          <Text style={styles.bodyText}>You can still review the latest order from the Orders tab.</Text>
          <Button
            label="Go to Orders"
            onPress={() => router.replace("/(tabs)/orders")}
            style={{ marginTop: 14, alignSelf: "flex-start" }}
          />
        </Card>
      </ScreenScroll>
    );
  }

  return (
    <ScreenScroll>
      <TitleBlock title="Order Confirmed" subtitle="Payment completed successfully and the order is now in your live timeline." />

      <GlassCard style={{ marginTop: 16 }}>
        <SectionLabel label="Pickup Ready" />
        <View style={styles.heroHeader}>
          <View style={styles.heroIconWrap}>
            <Ionicons name="checkmark-outline" size={22} color={uiPalette.primaryText} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroTitle}>Your order is in.</Text>
            <Text style={styles.heroCopy}>
              Save the pickup code below, then follow progress from Orders.
            </Text>
          </View>
        </View>

        <Text style={styles.pickupCodeLabel}>Pickup code</Text>
        <Text style={styles.pickupCodeValue}>{confirmation.pickupCode}</Text>

        <View style={styles.metricGrid}>
          <MetricTile label="Status" value={formatOrderStatus(confirmation.status)} />
          <MetricTile label="Total" value={`$${(confirmation.total.amountCents / 100).toFixed(2)}`} />
          <MetricTile label="Updated" value={formatOrderDateTime(confirmation.occurredAt)} />
        </View>
      </GlassCard>

      <Card style={{ marginTop: 12 }}>
        <SectionLabel label="Next Step" />
        <Text style={styles.bodyText}>
          Orders will now show the live status of this pickup, while the cart stays clear for the next order.
        </Text>
        <Button
          label="View Orders"
          onPress={() => {
            clearConfirmation();
            router.replace("/(tabs)/orders");
          }}
          style={{ marginTop: 14 }}
          left={<Ionicons name="receipt-outline" size={16} color={uiPalette.primaryText} />}
        />
        <Button
          label="Back to Menu"
          variant="ghost"
          onPress={() => {
            clearConfirmation();
            router.replace("/(tabs)/menu");
          }}
          style={{ marginTop: 10 }}
        />
      </Card>
    </ScreenScroll>
  );
}

const styles = StyleSheet.create({
  heroHeader: {
    marginTop: 8,
    flexDirection: "row",
    gap: 16,
    alignItems: "flex-start"
  },
  heroIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: uiPalette.primary
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: "700",
    color: uiPalette.text,
    letterSpacing: -0.8
  },
  heroCopy: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 22,
    color: uiPalette.textSecondary
  },
  pickupCodeLabel: {
    marginTop: 18,
    fontSize: 12,
    fontWeight: "700",
    color: uiPalette.textMuted,
    textTransform: "uppercase",
    letterSpacing: 1
  },
  pickupCodeValue: {
    marginTop: 6,
    fontSize: 32,
    fontWeight: "700",
    letterSpacing: 2.4,
    color: uiPalette.walnut
  },
  metricGrid: {
    marginTop: 18,
    gap: 10
  },
  metricTile: {
    borderRadius: 18,
    padding: 14,
    backgroundColor: "rgba(255, 248, 240, 0.76)",
    borderWidth: 1,
    borderColor: uiPalette.border
  },
  metricLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: uiPalette.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.8
  },
  metricValue: {
    marginTop: 8,
    fontSize: 16,
    fontWeight: "700",
    color: uiPalette.text
  },
  bodyText: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 20,
    color: uiPalette.textSecondary
  }
});
