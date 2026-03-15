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
import {
  findLatestOrderTime,
  formatOrderDateTime,
  formatOrderStatus,
  hasRefundActivity
} from "../../src/orders/history";
import { Button, Card, GlassCard, ScreenScroll, SectionLabel, TitleBlock, uiPalette } from "../../src/ui/system";

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

function OrderStatusChip({ status }: { status: string }) {
  const isPositive = status === "READY" || status === "COMPLETED";
  const isCritical = status === "CANCELED";
  const isPending = status === "PENDING_PAYMENT";

  return (
    <View
      style={[
        styles.statusPill,
        isPositive ? styles.statusPillPositive : null,
        isCritical ? styles.statusPillCritical : null,
        isPending ? styles.statusPillPending : null
      ]}
    >
      <Text
        style={[
          styles.statusPillText,
          isPositive ? styles.statusPillTextPositive : null,
          isCritical ? styles.statusPillTextCritical : null,
          isPending ? styles.statusPillTextPending : null
        ]}
      >
        {formatOrderStatus(status)}
      </Text>
    </View>
  );
}

function HistoryCard({
  order,
  showRefundDetails,
  onOpenRefund
}: {
  order: OrderHistoryEntry;
  showRefundDetails: boolean;
  onOpenRefund: () => void;
}) {
  return (
    <Card style={styles.historyCard}>
      <View style={styles.historyTop}>
        <View style={styles.historyIconWrap}>
          <Ionicons name="receipt-outline" size={16} color={uiPalette.walnut} />
        </View>
        <View style={{ flex: 1 }}>
          <View style={styles.historyHeader}>
            <OrderStatusChip status={order.status} />
            <Text style={styles.historyAmount}>{formatUsd(order.total.amountCents)}</Text>
          </View>
          <Text style={styles.historyCode}>{order.pickupCode}</Text>
          <Text style={styles.historyMeta}>{formatOrderDateTime(findLatestOrderTime(order))}</Text>
        </View>
      </View>

      {showRefundDetails ? (
        <Button
          label="View Refund Details"
          variant="ghost"
          onPress={onOpenRefund}
          style={{ marginTop: 12, alignSelf: "flex-start" }}
        />
      ) : null}
    </Card>
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
  const isRefreshing = ordersQuery.isFetching || loyaltyLedgerQuery.isFetching;
  const isPullRefreshing = ordersQuery.isRefetching || loyaltyLedgerQuery.isRefetching;

  if (!isAuthenticated) {
    return (
      <ScreenScroll>
        <TitleBlock
          title="Orders"
          subtitle="Track what is active now, review recent pickups, and keep refund-related details in one place."
        />

        <GlassCard style={{ marginTop: 16 }}>
          <SectionLabel label="Order Access" />
          <View style={styles.emptyHeroHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.emptyTitle}>Your pickup timeline belongs here.</Text>
              <Text style={styles.emptyBody}>
                Sign in once to follow live orders, revisit recent visits, and keep refund notes attached to the right order.
              </Text>
            </View>
            <View style={styles.heroIconWrap}>
              <Ionicons name="receipt-outline" size={24} color={uiPalette.walnut} />
            </View>
          </View>
          <View style={styles.detailRow}>
            <DetailPill icon="bag-check-outline" label="Active orders" />
            <DetailPill icon="time-outline" label="Pickup history" />
            <DetailPill icon="return-up-back-outline" label="Refund follow-up" />
          </View>
          <Link href={{ pathname: "/auth", params: { returnTo: "/(tabs)/orders" } }} asChild>
            <Pressable>
              <Button
                label="Sign In"
                style={{ marginTop: 16, alignSelf: "flex-start" }}
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
      refreshing={isPullRefreshing}
      onRefresh={() => {
        void ordersQuery.refetch();
        void loyaltyLedgerQuery.refetch();
      }}
    >
      <TitleBlock
        title="Orders"
        subtitle="Active pickup first, then the rest of your history in one clean timeline."
        action={
          <Button
            label={isRefreshing ? "Updating" : "Refresh"}
            variant="secondary"
            onPress={() => {
              void ordersQuery.refetch();
              void loyaltyLedgerQuery.refetch();
            }}
            disabled={isRefreshing}
          />
        }
      />

      <GlassCard style={{ marginTop: 16 }}>
        <SectionLabel label="Overview" />
        <Text style={styles.heroTitle}>
          {activeOrder ? "Your latest order is already in motion." : "No active order right now."}
        </Text>
        <Text style={styles.heroCopy}>
          {activeOrder
            ? "Track pickup progress here first, then drop into recent orders without leaving the tab."
            : "This tab will surface the next order as soon as it is created, then keep the rest of your history below."}
        </Text>
        <View style={styles.detailRow}>
          <DetailPill icon="receipt-outline" label={`${orders.length} total order${orders.length === 1 ? "" : "s"}`} />
          <DetailPill icon="walk-outline" label="Counter pickup" />
          <DetailPill icon="time-outline" label={activeOrder ? formatOrderDateTime(findLatestOrderTime(activeOrder)) : "Waiting for next order"} />
        </View>
      </GlassCard>

      <Card style={{ marginTop: 12 }}>
        <SectionLabel label="Active Order" />
        {ordersQuery.isLoading ? <Text style={styles.bodyText}>Checking your latest order...</Text> : null}
        {ordersQuery.error ? (
          <View style={{ marginTop: 10 }}>
            <Text style={styles.errorText}>We could not load your current order right now.</Text>
            <Button
              label="Retry"
              variant="ghost"
              onPress={() => void ordersQuery.refetch()}
              style={{ marginTop: 10, alignSelf: "flex-start" }}
            />
          </View>
        ) : null}

        {!ordersQuery.isLoading && !ordersQuery.error ? (
          activeOrder ? (
            <View style={styles.activeOrderCard}>
              <View style={styles.activeOrderTop}>
                <OrderStatusChip status={activeOrder.status} />
                <Text style={styles.activeOrderAmount}>{formatUsd(activeOrder.total.amountCents)}</Text>
              </View>
              <Text style={styles.pickupCodeLabel}>Pickup code</Text>
              <Text style={styles.pickupCodeValue}>{activeOrder.pickupCode}</Text>
              <View style={styles.detailRow}>
                <DetailPill icon="time-outline" label={formatOrderDateTime(findLatestOrderTime(activeOrder))} />
                <DetailPill icon="walk-outline" label="Counter pickup" />
              </View>

              {activeOrder.status === "PENDING_PAYMENT" ? (
                <Button
                  label="Complete Payment"
                  onPress={() => router.push("/cart")}
                  style={{ marginTop: 14, alignSelf: "flex-start" }}
                  left={<Ionicons name="logo-apple" size={15} color={uiPalette.primaryText} />}
                />
              ) : null}
            </View>
          ) : (
            <View style={styles.emptyPanel}>
              <Ionicons name="checkmark-done-outline" size={18} color={uiPalette.walnut} />
              <Text style={styles.bodyText}>No order is in progress right now.</Text>
            </View>
          )
        ) : null}
      </Card>

      <Card style={{ marginTop: 12 }}>
        <SectionLabel label="Recent Orders" />
        {ordersQuery.isLoading ? <Text style={styles.bodyText}>Loading recent orders...</Text> : null}
        {ordersQuery.error ? <Text style={styles.errorText}>Unable to load recent orders.</Text> : null}

        {!ordersQuery.isLoading && !ordersQuery.error && orderHistory.length === 0 ? (
          <Text style={styles.bodyText}>Your recent pickup history will appear here.</Text>
        ) : null}

        {!ordersQuery.isLoading && !ordersQuery.error && orderHistory.length > 0 ? (
          <View style={styles.historyList}>
            {orderHistory.map((order) => (
              <HistoryCard
                key={order.id}
                order={order}
                showRefundDetails={hasRefundActivity(order, loyaltyLedger)}
                onOpenRefund={() => router.push(`/refunds/${order.id}`)}
              />
            ))}
          </View>
        ) : null}
      </Card>

      {loyaltyLedger.some((entry) => entry.type === "REFUND") ? (
        <Card style={{ marginTop: 12 }}>
          <SectionLabel label="Refund Activity" />
          <Text style={styles.bodyText}>
            Orders with recorded refund-related activity include a dedicated detail screen so you do not have to guess what happened later.
          </Text>
          <View style={styles.refundList}>
            {loyaltyLedger
              .filter((entry) => entry.type === "REFUND")
              .slice(0, 3)
              .map((entry) => (
                <Pressable
                  key={entry.id}
                  style={styles.refundRow}
                  onPress={() => {
                    if (entry.orderId) {
                      router.push(`/refunds/${entry.orderId}`);
                    }
                  }}
                >
                  <View style={styles.refundIconWrap}>
                    <Ionicons name="return-up-back-outline" size={16} color={uiPalette.walnut} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.refundTitle}>
                      {entry.orderId ? `Order ${entry.orderId.slice(0, 8)}` : "Refund activity"}
                    </Text>
                    <Text style={styles.refundMeta}>
                      {entry.points > 0 ? `+${entry.points}` : entry.points} points • {formatOrderDateTime(entry.createdAt)}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={uiPalette.textMuted} />
                </Pressable>
              ))}
          </View>
        </Card>
      ) : null}
    </ScreenScroll>
  );
}

const styles = StyleSheet.create({
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
    fontSize: 28,
    lineHeight: 33,
    fontWeight: "700",
    letterSpacing: -0.8,
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
  bodyText: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 20,
    color: uiPalette.textSecondary
  },
  errorText: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 20,
    color: uiPalette.danger
  },
  activeOrderCard: {
    marginTop: 12
  },
  activeOrderTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  activeOrderAmount: {
    fontSize: 16,
    fontWeight: "700",
    color: uiPalette.text
  },
  pickupCodeLabel: {
    marginTop: 14,
    fontSize: 12,
    color: uiPalette.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.8
  },
  pickupCodeValue: {
    marginTop: 4,
    fontSize: 28,
    fontWeight: "700",
    letterSpacing: 2,
    color: uiPalette.walnut
  },
  emptyPanel: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  historyList: {
    marginTop: 12,
    gap: 10
  },
  historyCard: {
    gap: 10
  },
  historyTop: {
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start"
  },
  historyIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(198, 156, 109, 0.18)"
  },
  historyHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12
  },
  historyAmount: {
    fontSize: 14,
    fontWeight: "700",
    color: uiPalette.text
  },
  historyCode: {
    marginTop: 6,
    fontSize: 15,
    fontWeight: "700",
    color: uiPalette.text
  },
  historyMeta: {
    marginTop: 4,
    fontSize: 12,
    color: uiPalette.textMuted
  },
  statusPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "rgba(198, 156, 109, 0.18)"
  },
  statusPillPositive: {
    backgroundColor: "rgba(86, 134, 92, 0.16)"
  },
  statusPillCritical: {
    backgroundColor: "rgba(183, 90, 70, 0.14)"
  },
  statusPillPending: {
    backgroundColor: "rgba(200, 137, 56, 0.16)"
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: "700",
    color: uiPalette.walnut,
    textTransform: "uppercase",
    letterSpacing: 0.6
  },
  statusPillTextPositive: {
    color: "#385B3C"
  },
  statusPillTextCritical: {
    color: uiPalette.danger
  },
  statusPillTextPending: {
    color: uiPalette.warning
  },
  refundList: {
    marginTop: 12,
    gap: 10
  },
  refundRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 18,
    backgroundColor: "rgba(255, 248, 240, 0.66)",
    borderWidth: 1,
    borderColor: uiPalette.border
  },
  refundIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(198, 156, 109, 0.18)"
  },
  refundTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: uiPalette.text
  },
  refundMeta: {
    marginTop: 4,
    fontSize: 12,
    color: uiPalette.textMuted
  }
});
