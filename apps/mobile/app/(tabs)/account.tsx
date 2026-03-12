import { Ionicons } from "@expo/vector-icons";
import { Link } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useAuthSession } from "../../src/auth/session";
import {
  findActiveOrder,
  useLoyaltyBalanceQuery,
  useLoyaltyLedgerQuery,
  useOrderHistoryQuery,
  usePushTokenRegistrationMutation
} from "../../src/account/data";
import { formatUsd } from "../../src/menu/catalog";
import { Button, Card, Chip, ScreenScroll, SectionLabel, TitleBlock, uiPalette } from "../../src/ui/system";

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unexpected error";
}

function formatDateTime(value: string) {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    return value;
  }

  return new Date(parsed).toLocaleString();
}

function formatOrderStatus(status: string) {
  return status.replaceAll("_", " ");
}

function OrderStatusChip({ status }: { status: string }) {
  const isPositive = status === "READY" || status === "COMPLETED";
  const isCritical = status === "CANCELED";

  return (
    <View
      style={[
        styles.statusPill,
        isPositive ? styles.statusPillPositive : null,
        isCritical ? styles.statusPillCritical : null
      ]}
    >
      <Text
        style={[
          styles.statusPillText,
          isPositive ? styles.statusPillTextPositive : null,
          isCritical ? styles.statusPillTextCritical : null
        ]}
      >
        {formatOrderStatus(status)}
      </Text>
    </View>
  );
}

export default function AccountScreen() {
  const { isAuthenticated, session, signOut } = useAuthSession();
  const ordersQuery = useOrderHistoryQuery(isAuthenticated);
  const loyaltyBalanceQuery = useLoyaltyBalanceQuery(isAuthenticated);
  const loyaltyLedgerQuery = useLoyaltyLedgerQuery(isAuthenticated);
  const pushTokenMutation = usePushTokenRegistrationMutation();

  const [notificationStatus, setNotificationStatus] = useState("");
  const [signOutPending, setSignOutPending] = useState(false);

  const orders = ordersQuery.data ?? [];
  const activeOrder = findActiveOrder(orders);
  const loyaltyBalance = loyaltyBalanceQuery.data;
  const loyaltyLedger = loyaltyLedgerQuery.data ?? [];

  const isRefreshing =
    ordersQuery.isFetching ||
    loyaltyBalanceQuery.isFetching ||
    loyaltyLedgerQuery.isFetching ||
    pushTokenMutation.isPending;

  async function handleSignOut() {
    setSignOutPending(true);
    try {
      await signOut();
    } finally {
      setSignOutPending(false);
    }
  }

  function handleRefresh() {
    void ordersQuery.refetch();
    void loyaltyBalanceQuery.refetch();
    void loyaltyLedgerQuery.refetch();
  }

  function handleRegisterPushToken() {
    const userIdFragment = session?.userId.slice(0, 8) ?? "guest";
    const tokenSeed = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

    setNotificationStatus("Registering push token...");
    pushTokenMutation.mutate(
      {
        deviceId: `mobile-${userIdFragment}`,
        platform: "ios",
        expoPushToken: `ExponentPushToken[${tokenSeed}]`
      },
      {
        onSuccess: () => setNotificationStatus("Push token registration updated."),
        onError: (error) => setNotificationStatus(toErrorMessage(error))
      }
    );
  }

  if (!isAuthenticated) {
    return (
      <ScreenScroll>
        <TitleBlock
          title="Account"
          subtitle="Sign in to access order tracking, loyalty balances, and notification preferences."
        />

        <Card style={{ marginTop: 16 }}>
          <SectionLabel label="Profile Access" />
          <Text style={styles.emptyBody}>
            Your account dashboard shows active order progress, recent history, and rewards activity.
          </Text>
          <Link href={{ pathname: "/auth", params: { returnTo: "/(tabs)/account" } }} asChild>
            <Pressable style={styles.signInCta}>
              <Ionicons name="log-in-outline" size={16} color="#FFFFFF" />
              <Text style={styles.signInCtaText}>Sign In</Text>
            </Pressable>
          </Link>
        </Card>
      </ScreenScroll>
    );
  }

  return (
    <ScreenScroll>
      <TitleBlock
        title="Account"
        subtitle="Manage profile, loyalty rewards, order history, and push notifications."
        action={
          <Button
            label={isRefreshing ? "Refreshing" : "Refresh"}
            variant="secondary"
            onPress={handleRefresh}
            disabled={isRefreshing}
          />
        }
      />

      <Card style={{ marginTop: 16 }}>
        <SectionLabel label="Profile" />
        <Text style={styles.profileValue}>{session?.userId ?? "Unknown user"}</Text>
        <Text style={styles.profileMeta}>Session expires {formatDateTime(session?.expiresAt ?? "")}</Text>
      </Card>

      <Card style={{ marginTop: 12 }}>
        <SectionLabel label="Active Order" />
        {ordersQuery.isLoading ? <Text style={styles.bodyText}>Loading active order...</Text> : null}

        {ordersQuery.error ? (
          <View style={{ marginTop: 10 }}>
            <Text style={styles.errorText}>{toErrorMessage(ordersQuery.error)}</Text>
            <Button label="Retry" variant="ghost" onPress={() => void ordersQuery.refetch()} style={{ marginTop: 8, alignSelf: "flex-start" }} />
          </View>
        ) : null}

        {!ordersQuery.isLoading && !ordersQuery.error ? (
          activeOrder ? (
            <View style={styles.activeOrderCard}>
              <OrderStatusChip status={activeOrder.status} />
              <Text style={styles.pickupCodeLabel}>Pickup code</Text>
              <Text style={styles.pickupCodeValue}>{activeOrder.pickupCode}</Text>
              <Text style={styles.profileMeta}>
                Updated {formatDateTime(activeOrder.timeline[activeOrder.timeline.length - 1]?.occurredAt ?? "")}
              </Text>
            </View>
          ) : (
            <Text style={styles.bodyText}>No active order right now.</Text>
          )
        ) : null}
      </Card>

      <Card style={{ marginTop: 12 }}>
        <SectionLabel label="Order History" />
        {ordersQuery.isLoading ? <Text style={styles.bodyText}>Loading history...</Text> : null}
        {ordersQuery.error ? <Text style={styles.errorText}>Unable to load order history.</Text> : null}

        {!ordersQuery.isLoading && !ordersQuery.error && orders.length === 0 ? (
          <Text style={styles.bodyText}>No completed orders yet.</Text>
        ) : null}

        {!ordersQuery.isLoading && !ordersQuery.error && orders.length > 0 ? (
          <View style={styles.listWrap}>
            {orders.slice(0, 5).map((order) => (
              <View key={order.id} style={styles.listItem}>
                <View style={styles.listItemTop}>
                  <OrderStatusChip status={order.status} />
                  <Text style={styles.listItemAmount}>{formatUsd(order.total.amountCents)}</Text>
                </View>
                <Text style={styles.listItemCode}>{order.pickupCode}</Text>
                <Text style={styles.listItemMeta}>
                  {formatDateTime(order.timeline[order.timeline.length - 1]?.occurredAt ?? "")}
                </Text>
              </View>
            ))}
          </View>
        ) : null}
      </Card>

      <Card style={{ marginTop: 12 }}>
        <SectionLabel label="Loyalty" />
        {loyaltyBalanceQuery.isLoading ? <Text style={styles.bodyText}>Loading loyalty balance...</Text> : null}
        {loyaltyBalanceQuery.error ? <Text style={styles.errorText}>Unable to load loyalty balance.</Text> : null}

        {loyaltyBalance ? (
          <View style={styles.pointsPanel}>
            <Text style={styles.pointsValue}>{loyaltyBalance.availablePoints} points</Text>
            <Text style={styles.pointsMeta}>
              Pending {loyaltyBalance.pendingPoints} • Lifetime earned {loyaltyBalance.lifetimeEarned}
            </Text>
          </View>
        ) : null}

        {loyaltyLedger.length > 0 ? (
          <View style={styles.ledgerWrap}>
            {loyaltyLedger.slice(0, 4).map((entry) => (
              <View key={entry.id} style={styles.ledgerItem}>
                <Chip
                  label={`${entry.type} ${entry.points > 0 ? `+${entry.points}` : entry.points}`}
                  active={entry.points > 0}
                />
                <Text style={styles.ledgerMeta}>{formatDateTime(entry.createdAt)}</Text>
              </View>
            ))}
          </View>
        ) : null}
      </Card>

      <Card style={{ marginTop: 12 }}>
        <SectionLabel label="Notification Settings" />
        <Text style={styles.bodyText}>Register this device token to receive order updates in real time.</Text>
        <Button
          label={pushTokenMutation.isPending ? "Saving..." : "Register Push Updates"}
          onPress={handleRegisterPushToken}
          disabled={pushTokenMutation.isPending}
          style={{ marginTop: 10 }}
        />
        {notificationStatus ? <Text style={styles.statusText}>{notificationStatus}</Text> : null}
      </Card>

      <Button
        label={signOutPending ? "Signing Out..." : "Sign Out"}
        variant="ghost"
        onPress={() => {
          void handleSignOut();
        }}
        disabled={signOutPending}
        style={{ marginTop: 12 }}
      />
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
  signInCta: {
    marginTop: 12,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 11,
    backgroundColor: uiPalette.primary
  },
  signInCtaText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.3
  },
  profileValue: {
    marginTop: 8,
    fontSize: 15,
    fontWeight: "700",
    color: uiPalette.text
  },
  profileMeta: {
    marginTop: 4,
    fontSize: 12,
    color: uiPalette.textMuted
  },
  bodyText: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 20,
    color: uiPalette.textSecondary
  },
  errorText: {
    marginTop: 8,
    fontSize: 13,
    color: uiPalette.danger
  },
  activeOrderCard: {
    marginTop: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: uiPalette.border,
    backgroundColor: "rgba(255,255,255,0.8)",
    padding: 12
  },
  pickupCodeLabel: {
    marginTop: 8,
    fontSize: 12,
    color: uiPalette.textMuted,
    textTransform: "uppercase",
    letterSpacing: 1
  },
  pickupCodeValue: {
    marginTop: 4,
    fontSize: 22,
    fontWeight: "700",
    letterSpacing: 0.6,
    color: uiPalette.text
  },
  statusPill: {
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "rgba(15,23,42,0.08)",
    borderWidth: 1,
    borderColor: "rgba(15,23,42,0.12)"
  },
  statusPillPositive: {
    backgroundColor: "rgba(52,199,89,0.14)",
    borderColor: "rgba(52,199,89,0.34)"
  },
  statusPillCritical: {
    backgroundColor: "rgba(255,59,48,0.14)",
    borderColor: "rgba(255,59,48,0.34)"
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.6,
    color: uiPalette.textSecondary,
    textTransform: "uppercase"
  },
  statusPillTextPositive: {
    color: "#118C43"
  },
  statusPillTextCritical: {
    color: "#B52821"
  },
  listWrap: {
    marginTop: 10,
    gap: 8
  },
  listItem: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: uiPalette.border,
    backgroundColor: "rgba(255,255,255,0.84)",
    padding: 10
  },
  listItemTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8
  },
  listItemAmount: {
    fontSize: 13,
    fontWeight: "700",
    color: uiPalette.text
  },
  listItemCode: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: "600",
    color: uiPalette.text
  },
  listItemMeta: {
    marginTop: 3,
    fontSize: 12,
    color: uiPalette.textMuted
  },
  pointsPanel: {
    marginTop: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: uiPalette.border,
    backgroundColor: "rgba(255,255,255,0.8)",
    padding: 12
  },
  pointsValue: {
    fontSize: 20,
    fontWeight: "700",
    color: uiPalette.text
  },
  pointsMeta: {
    marginTop: 4,
    fontSize: 12,
    color: uiPalette.textMuted
  },
  ledgerWrap: {
    marginTop: 10,
    gap: 8
  },
  ledgerItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: uiPalette.border,
    padding: 8,
    backgroundColor: "rgba(255,255,255,0.76)"
  },
  ledgerMeta: {
    fontSize: 12,
    color: uiPalette.textMuted
  },
  statusText: {
    marginTop: 8,
    fontSize: 12,
    lineHeight: 17,
    color: uiPalette.textSecondary
  }
});
