import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { useCheckoutFlow } from "../src/orders/flow";
import { formatOrderDateTime } from "../src/orders/history";
import { Button, Card, GlassCard, ScreenScroll, SectionLabel, TitleBlock, uiPalette } from "../src/ui/system";

export default function CheckoutFailureScreen() {
  const router = useRouter();
  const { failure, retryOrder, clearFailure } = useCheckoutFlow();

  const createdButUnpaid = failure?.stage === "pay" && failure.order;

  return (
    <ScreenScroll>
      <TitleBlock
        title="Payment Not Completed"
        subtitle="The cart stays intact so you can recover cleanly instead of starting over."
      />

      <GlassCard style={{ marginTop: 16 }}>
        <SectionLabel label="Checkout Outcome" />
        <View style={styles.heroHeader}>
          <View style={styles.heroIconWrap}>
            <Ionicons name="alert-circle-outline" size={22} color={uiPalette.primaryText} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroTitle}>
              {createdButUnpaid ? "The order exists, but payment did not finish." : "Payment did not go through."}
            </Text>
            <Text style={styles.heroCopy}>
              {createdButUnpaid
                ? "Retry from the cart and the app will attempt payment on the same pending order instead of creating a duplicate."
                : "You can return to the cart, review the order, and try again."}
            </Text>
          </View>
        </View>

        {failure ? (
          <View style={styles.metaCard}>
            <Text style={styles.metaLabel}>Latest message</Text>
            <Text style={styles.metaValue}>{failure.message}</Text>
            <Text style={styles.metaFootnote}>{formatOrderDateTime(failure.occurredAt)}</Text>
          </View>
        ) : null}

        {failure?.order ? (
          <View style={styles.metaCard}>
            <Text style={styles.metaLabel}>Pending order</Text>
            <Text style={styles.pendingCode}>{failure.order.pickupCode}</Text>
            <Text style={styles.metaFootnote}>A payment retry will target this order first.</Text>
          </View>
        ) : null}
      </GlassCard>

      <Card style={{ marginTop: 12 }}>
        <SectionLabel label="Next Step" />
        <Text style={styles.bodyText}>
          You can retry immediately, switch back to browsing, or review active orders and their status separately.
        </Text>
        <Button
          label={retryOrder ? "Retry Payment" : "Return to Cart"}
          onPress={() => {
            clearFailure();
            router.replace("/cart");
          }}
          style={{ marginTop: 14 }}
          left={<Ionicons name="refresh-outline" size={16} color={uiPalette.primaryText} />}
        />
        <Button
          label="View Orders"
          variant="secondary"
          onPress={() => {
            clearFailure();
            router.replace("/(tabs)/orders");
          }}
          style={{ marginTop: 10 }}
        />
        <Button
          label="Back to Menu"
          variant="ghost"
          onPress={() => {
            clearFailure();
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
    backgroundColor: uiPalette.warning
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
  metaCard: {
    marginTop: 16,
    borderRadius: 18,
    padding: 14,
    backgroundColor: "rgba(255, 248, 240, 0.76)",
    borderWidth: 1,
    borderColor: uiPalette.border
  },
  metaLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: uiPalette.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.8
  },
  metaValue: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 21,
    color: uiPalette.text
  },
  metaFootnote: {
    marginTop: 8,
    fontSize: 12,
    color: uiPalette.textMuted
  },
  pendingCode: {
    marginTop: 8,
    fontSize: 24,
    fontWeight: "700",
    letterSpacing: 1.8,
    color: uiPalette.walnut
  },
  bodyText: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 20,
    color: uiPalette.textSecondary
  }
});
