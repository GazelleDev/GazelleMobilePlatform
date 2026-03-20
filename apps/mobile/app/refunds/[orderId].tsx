import { Ionicons } from "@expo/vector-icons";
import { Link, useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useAuthSession } from "../../src/auth/session";
import { useLoyaltyLedgerQuery, useOrderHistoryQuery } from "../../src/account/data";
import { formatUsd } from "../../src/menu/catalog";
import {
  findLatestOrderTime,
  findRefundEntriesForOrder,
  formatOrderDateTime,
  formatOrderStatus,
  formatOrderTimelineNote
} from "../../src/orders/history";
import { Button, Card, GlassCard, ScreenScroll, SectionLabel, TitleBlock, uiPalette } from "../../src/ui/system";

export default function RefundDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ orderId?: string | string[] }>();
  const orderId = Array.isArray(params.orderId) ? params.orderId[0] : params.orderId;
  const { isAuthenticated } = useAuthSession();
  const ordersQuery = useOrderHistoryQuery(isAuthenticated);
  const loyaltyLedgerQuery = useLoyaltyLedgerQuery(isAuthenticated);
  const [isPullRefreshing, setIsPullRefreshing] = useState(false);

  const order = (ordersQuery.data ?? []).find((entry) => entry.id === orderId);
  const refundEntries = orderId ? findRefundEntriesForOrder(orderId, loyaltyLedgerQuery.data ?? []) : [];

  if (!isAuthenticated) {
    return (
      <ScreenScroll>
        <TitleBlock title="Refund Details" subtitle="Sign in to review refund-related activity attached to your order history." />
        <GlassCard style={{ marginTop: 16 }}>
          <SectionLabel label="Customer Access" />
          <Text style={styles.bodyText}>
            Refund details are tied to your signed-in order history so they stay attached to the correct visit.
          </Text>
          <Link href={{ pathname: "/auth", params: { returnTo: "/(tabs)/orders" } }} asChild>
            <Pressable>
              <Button
                label="Sign In"
                style={{ marginTop: 14, alignSelf: "flex-start" }}
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
      refreshing={isPullRefreshing}
      onRefresh={() => {
        if (isPullRefreshing) return;

        setIsPullRefreshing(true);
        void Promise.allSettled([ordersQuery.refetch(), loyaltyLedgerQuery.refetch()]).finally(() => {
          setIsPullRefreshing(false);
        });
      }}
    >
      <TitleBlock title="Refund Details" subtitle="Refund and cancellation context stays attached to the original order instead of disappearing into support email." />

      <GlassCard style={{ marginTop: 16 }}>
        <SectionLabel label="Order" />
        {ordersQuery.isLoading ? <Text style={styles.bodyText}>Loading order details...</Text> : null}
        {ordersQuery.error ? <Text style={styles.errorText}>Unable to load the order right now.</Text> : null}
        {!ordersQuery.isLoading && !ordersQuery.error && !order ? (
          <Text style={styles.bodyText}>This order could not be found in your current history.</Text>
        ) : null}

        {order ? (
          <>
            <View style={styles.heroHeader}>
              <View style={styles.heroIconWrap}>
                <Ionicons name="return-up-back-outline" size={22} color={uiPalette.walnut} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.heroTitle}>Order {order.pickupCode}</Text>
                <Text style={styles.heroCopy}>
                  {formatOrderStatus(order.status)} • {formatUsd(order.total.amountCents)}
                </Text>
              </View>
            </View>
            <View style={styles.infoCard}>
              <Text style={styles.infoLabel}>Latest update</Text>
              <Text style={styles.infoValue}>{formatOrderDateTime(findLatestOrderTime(order))}</Text>
            </View>
          </>
        ) : null}
      </GlassCard>

      <Card style={{ marginTop: 12 }}>
        <SectionLabel label="Refund Activity" />
        {loyaltyLedgerQuery.isLoading ? <Text style={styles.bodyText}>Loading refund-related activity...</Text> : null}
        {loyaltyLedgerQuery.error ? <Text style={styles.errorText}>Unable to load refund activity right now.</Text> : null}

        {!loyaltyLedgerQuery.isLoading && !loyaltyLedgerQuery.error && refundEntries.length === 0 ? (
          <Text style={styles.bodyText}>
            No explicit refund ledger entries are attached to this order in the current mobile contract. If the order was canceled, any refund notes or returned points will appear here when exposed.
          </Text>
        ) : null}

        {refundEntries.length > 0 ? (
          <View style={styles.activityList}>
            {refundEntries.map((entry) => (
              <View key={entry.id} style={styles.activityCard}>
                <Text style={styles.infoLabel}>Refund entry</Text>
                <Text style={styles.activityValue}>
                  {entry.points > 0 ? `+${entry.points}` : entry.points} points
                </Text>
                <Text style={styles.activityMeta}>{formatOrderDateTime(entry.createdAt)}</Text>
              </View>
            ))}
          </View>
        ) : null}
      </Card>

      {order?.timeline.length ? (
        <Card style={{ marginTop: 12 }}>
          <SectionLabel label="Order Timeline" />
          <View style={styles.timelineList}>
            {order.timeline.map((entry, index) => (
              <View key={`${entry.occurredAt}-${index}`} style={styles.timelineRow}>
                <View style={styles.timelineDot} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.timelineTitle}>{formatOrderStatus(entry.status)}</Text>
                  <Text style={styles.timelineMeta}>{formatOrderDateTime(entry.occurredAt)}</Text>
                  {entry.note ? <Text style={styles.timelineNote}>{formatOrderTimelineNote(entry.note)}</Text> : null}
                </View>
              </View>
            ))}
          </View>
        </Card>
      ) : null}

      <Card style={{ marginTop: 12 }}>
        <SectionLabel label="Next Step" />
        <Text style={styles.bodyText}>
          If more detailed payment-refund metadata is added to the API later, this screen is where it should surface.
        </Text>
        <Button
          label="Back to Orders"
          onPress={() => router.replace("/(tabs)/orders")}
          style={{ marginTop: 14 }}
          left={<Ionicons name="receipt-outline" size={16} color={uiPalette.primaryText} />}
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
    backgroundColor: "rgba(198, 156, 109, 0.18)",
    borderWidth: 1,
    borderColor: "rgba(198, 156, 109, 0.22)"
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
  infoCard: {
    marginTop: 16,
    borderRadius: 18,
    padding: 14,
    backgroundColor: "rgba(255, 248, 240, 0.76)",
    borderWidth: 1,
    borderColor: uiPalette.border
  },
  infoLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: uiPalette.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.8
  },
  infoValue: {
    marginTop: 8,
    fontSize: 15,
    fontWeight: "700",
    color: uiPalette.text
  },
  activityList: {
    marginTop: 12,
    gap: 10
  },
  activityCard: {
    borderRadius: 18,
    padding: 14,
    backgroundColor: "rgba(255, 248, 240, 0.76)",
    borderWidth: 1,
    borderColor: uiPalette.border
  },
  activityValue: {
    marginTop: 8,
    fontSize: 18,
    fontWeight: "700",
    color: uiPalette.walnut
  },
  activityMeta: {
    marginTop: 8,
    fontSize: 12,
    color: uiPalette.textMuted
  },
  timelineList: {
    marginTop: 12,
    gap: 12
  },
  timelineRow: {
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start"
  },
  timelineDot: {
    width: 10,
    height: 10,
    marginTop: 6,
    borderRadius: 999,
    backgroundColor: uiPalette.brass
  },
  timelineTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: uiPalette.text
  },
  timelineMeta: {
    marginTop: 4,
    fontSize: 12,
    color: uiPalette.textMuted
  },
  timelineNote: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 20,
    color: uiPalette.textSecondary
  }
});
