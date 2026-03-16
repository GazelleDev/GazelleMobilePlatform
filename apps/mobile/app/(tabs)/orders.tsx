import { Ionicons } from "@expo/vector-icons";
import { Link, useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useAuthSession } from "../../src/auth/session";
import {
  findActiveOrder,
  useLoyaltyLedgerQuery,
  useOrderHistoryQuery,
  type OrderHistoryEntry
} from "../../src/account/data";
import { formatUsd } from "../../src/menu/catalog";
import { findLatestOrderTime, formatOrderDateTime, formatOrderStatus, hasRefundActivity } from "../../src/orders/history";
import { Button, Card, GlassCard, ScreenScroll, SectionLabel, TitleBlock, uiPalette, uiTypography } from "../../src/ui/system";

function StatusPill({ status }: { status: string }) {
  return (
    <View style={styles.statusPill}>
      <Text style={styles.statusPillText}>{formatOrderStatus(status)}</Text>
    </View>
  );
}

function HistoryRow({
  order,
  canOpenRefund,
  onOpenRefund
}: {
  order: OrderHistoryEntry;
  canOpenRefund: boolean;
  onOpenRefund: () => void;
}) {
  return (
    <View style={styles.historyRow}>
      <View style={styles.historyIcon}>
        <Ionicons name="receipt-outline" size={18} color={uiPalette.accent} />
      </View>
      <View style={{ flex: 1 }}>
        <View style={styles.historyTop}>
          <StatusPill status={order.status} />
          <Text style={styles.historyAmount}>{formatUsd(order.total.amountCents)}</Text>
        </View>
        <Text style={styles.historyCode}>{order.pickupCode}</Text>
        <Text style={styles.historyMeta}>{formatOrderDateTime(findLatestOrderTime(order))}</Text>
        {canOpenRefund ? (
          <Pressable style={styles.inlineAction} onPress={onOpenRefund}>
            <Text style={styles.inlineActionText}>Refund details</Text>
            <Ionicons name="chevron-forward" size={14} color={uiPalette.textMuted} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

export default function OrdersScreen() {
  const router = useRouter();
  const { isAuthenticated } = useAuthSession();
  const ordersQuery = useOrderHistoryQuery(isAuthenticated);
  const loyaltyLedgerQuery = useLoyaltyLedgerQuery(isAuthenticated);

  const orders = ordersQuery.data ?? [];
  const loyaltyLedger = loyaltyLedgerQuery.data ?? [];
  const activeOrder = findActiveOrder(orders);
  const orderHistory = activeOrder ? orders.filter((order) => order.id !== activeOrder.id) : orders;

  if (!isAuthenticated) {
    return (
      <ScreenScroll>
        <TitleBlock title="Orders" subtitle="Live status, pickup codes, and recent orders stay together." />

        <GlassCard style={{ marginTop: 18 }}>
          <SectionLabel label="Sign in required" />
          <Text style={styles.heroTitle}>Order tracking lives here.</Text>
          <Text style={styles.heroBody}>
            Sign in once to follow active orders, revisit recent pickups, and keep refund-related follow-up attached to the right order.
          </Text>
          <Link href={{ pathname: "/auth", params: { returnTo: "/(tabs)/orders" } }} asChild>
            <Pressable>
              <Button
                label="Sign In"
                style={{ marginTop: 18, alignSelf: "flex-start" }}
                left={<Ionicons name="log-in-outline" size={16} color={uiPalette.primaryText} />}
              />
            </Pressable>
          </Link>
        </GlassCard>
      </ScreenScroll>
    );
  }

  return (
    <ScreenScroll
      bottomInset={156}
      refreshing={ordersQuery.isRefetching || loyaltyLedgerQuery.isRefetching}
      onRefresh={() => {
        void ordersQuery.refetch();
        void loyaltyLedgerQuery.refetch();
      }}
    >
      <TitleBlock
        title="Orders"
        subtitle="The current order stays at the top. Everything else follows below as history."
        action={<Button label="Refresh" variant="secondary" onPress={() => {
          void ordersQuery.refetch();
          void loyaltyLedgerQuery.refetch();
        }} />}
      />

      <GlassCard style={{ marginTop: 18 }}>
        <SectionLabel label="Active" />
        <Text style={styles.heroTitle}>{activeOrder ? "Your current pickup is in motion." : "No active order right now."}</Text>
        <Text style={styles.heroBody}>
          {activeOrder
            ? "Pickup code, live status, and the next action stay in one place."
            : "When the next order is placed, it will appear here automatically."}
        </Text>
        {activeOrder ? (
          <View style={styles.activeCard}>
            <View style={styles.activeTop}>
              <StatusPill status={activeOrder.status} />
              <Text style={styles.activeAmount}>{formatUsd(activeOrder.total.amountCents)}</Text>
            </View>
            <Text style={styles.pickupLabel}>Pickup code</Text>
            <Text style={styles.pickupValue}>{activeOrder.pickupCode}</Text>
            <Text style={styles.activeMeta}>{formatOrderDateTime(findLatestOrderTime(activeOrder))}</Text>
            {activeOrder.status === "PENDING_PAYMENT" ? (
              <Button
                label="Complete Payment"
                onPress={() => router.push("/cart")}
                style={{ marginTop: 16, alignSelf: "flex-start" }}
                left={<Ionicons name="logo-apple" size={16} color={uiPalette.primaryText} />}
              />
            ) : null}
          </View>
        ) : null}
      </GlassCard>

      <Card style={{ marginTop: 14 }}>
        <SectionLabel label="Recent orders" />
        {ordersQuery.isLoading ? <Text style={styles.bodyText}>Loading recent orders…</Text> : null}
        {ordersQuery.error ? <Text style={styles.bodyText}>Unable to load recent orders.</Text> : null}
        {!ordersQuery.isLoading && !ordersQuery.error && orderHistory.length === 0 ? (
          <Text style={styles.bodyText}>Your recent order history will appear here.</Text>
        ) : null}

        {!ordersQuery.isLoading && !ordersQuery.error && orderHistory.length > 0 ? (
          <View style={styles.groupedList}>
            {orderHistory.map((order, index) => (
              <View key={order.id}>
                <HistoryRow
                  order={order}
                  canOpenRefund={hasRefundActivity(order, loyaltyLedger)}
                  onOpenRefund={() => router.push(`/refunds/${order.id}`)}
                />
                {index < orderHistory.length - 1 ? <View style={styles.divider} /> : null}
              </View>
            ))}
          </View>
        ) : null}
      </Card>
    </ScreenScroll>
  );
}

const styles = StyleSheet.create({
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
  activeCard: {
    marginTop: 18,
    padding: 18,
    borderRadius: 20,
    backgroundColor: uiPalette.surfaceStrong,
    borderWidth: 1,
    borderColor: uiPalette.border
  },
  activeTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "center"
  },
  activeAmount: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: "600",
    color: uiPalette.text
  },
  pickupLabel: {
    marginTop: 16,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 1,
    textTransform: "uppercase",
    color: uiPalette.textMuted,
    fontWeight: "700"
  },
  pickupValue: {
    marginTop: 6,
    fontSize: 28,
    lineHeight: 32,
    fontWeight: "700",
    letterSpacing: -0.8,
    color: uiPalette.text,
    fontFamily: uiTypography.displayFamily
  },
  activeMeta: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 19,
    color: uiPalette.textSecondary
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: uiPalette.accentSoft
  },
  statusPillText: {
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 1,
    textTransform: "uppercase",
    fontWeight: "700",
    color: uiPalette.accent
  },
  bodyText: {
    marginTop: 14,
    fontSize: 14,
    lineHeight: 22,
    color: uiPalette.textSecondary
  },
  groupedList: {
    marginTop: 14
  },
  historyRow: {
    minHeight: 82,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14
  },
  historyIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: uiPalette.accentSoft
  },
  historyTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "center"
  },
  historyAmount: {
    fontSize: 15,
    lineHeight: 18,
    fontWeight: "600",
    color: uiPalette.text
  },
  historyCode: {
    marginTop: 8,
    fontSize: 16,
    lineHeight: 20,
    fontWeight: "600",
    color: uiPalette.text
  },
  historyMeta: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 18,
    color: uiPalette.textSecondary
  },
  inlineAction: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 4
  },
  inlineActionText: {
    fontSize: 13,
    lineHeight: 17,
    fontWeight: "600",
    color: uiPalette.text
  },
  divider: {
    height: 1,
    backgroundColor: uiPalette.border
  }
});
