import { Ionicons } from "@expo/vector-icons";
import { Link } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useAuthSession } from "../../src/auth/session";
import {
  useLoyaltyBalanceQuery,
  useLoyaltyLedgerQuery,
  usePushTokenRegistrationMutation
} from "../../src/account/data";
import { Button, Chip, GlassCard, Card, ScreenScroll, SectionLabel, TitleBlock, uiPalette } from "../../src/ui/system";

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

export default function AccountScreen() {
  const { isAuthenticated, session, signOut } = useAuthSession();
  const loyaltyBalanceQuery = useLoyaltyBalanceQuery(isAuthenticated);
  const loyaltyLedgerQuery = useLoyaltyLedgerQuery(isAuthenticated);
  const pushTokenMutation = usePushTokenRegistrationMutation();
  const showNotificationTesting = __DEV__;

  const [notificationStatus, setNotificationStatus] = useState("");
  const [signOutPending, setSignOutPending] = useState(false);

  const loyaltyBalance = loyaltyBalanceQuery.data;
  const loyaltyLedger = loyaltyLedgerQuery.data ?? [];
  const isRefreshing =
    loyaltyBalanceQuery.isFetching || loyaltyLedgerQuery.isFetching || pushTokenMutation.isPending;
  const isPullRefreshing = loyaltyBalanceQuery.isRefetching || loyaltyLedgerQuery.isRefetching;

  async function handleSignOut() {
    setSignOutPending(true);
    try {
      await signOut();
    } finally {
      setSignOutPending(false);
    }
  }

  function handleRefresh() {
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
          subtitle="Sign in once to keep rewards, alerts, and your secure session in one polished place."
        />

        <GlassCard style={{ marginTop: 16 }}>
          <SectionLabel label="Customer Access" />
          <View style={styles.emptyHeroHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.emptyTitle}>Your profile belongs here.</Text>
              <Text style={styles.emptyBody}>
                Keep rewards progress, notification preferences, and session controls attached to one account.
              </Text>
            </View>
            <View style={styles.heroIconWrap}>
              <Ionicons name="person-circle-outline" size={24} color={uiPalette.walnut} />
            </View>
          </View>
          <View style={styles.detailRow}>
            <DetailPill icon="star-outline" label="Rewards" />
            <DetailPill icon="notifications-outline" label="Pickup alerts" />
            <DetailPill icon="shield-checkmark-outline" label="Secure session" />
          </View>
          <Link href={{ pathname: "/auth", params: { returnTo: "/(tabs)/account" } }} asChild>
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
      onRefresh={handleRefresh}
    >
      <TitleBlock
        title="Account"
        subtitle="Rewards, alerts, and session controls stay here while Orders handles the live pickup timeline."
        action={
          <Button
            label={isRefreshing ? "Updating" : "Refresh"}
            variant="secondary"
            onPress={handleRefresh}
            disabled={isRefreshing}
          />
        }
      />

      <GlassCard style={{ marginTop: 16 }}>
        <SectionLabel label="Overview" />
        <View style={styles.profileHeader}>
          <View style={styles.heroIconWrap}>
            <Ionicons name="sparkles-outline" size={22} color={uiPalette.walnut} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroTitle}>The account layer stays calm and useful.</Text>
            <Text style={styles.heroCopy}>
              Rewards progress, alert controls, and secure session details are close by without competing with active orders.
            </Text>
          </View>
        </View>
        <View style={styles.metricGrid}>
          <MetricTile label="Available" value={loyaltyBalance ? `${loyaltyBalance.availablePoints} pts` : "Loading"} />
          <MetricTile label="Pending" value={loyaltyBalance ? `${loyaltyBalance.pendingPoints} pts` : "--"} />
          <MetricTile label="Lifetime" value={loyaltyBalance ? `${loyaltyBalance.lifetimeEarned} pts` : "--"} />
        </View>
        <Text style={styles.profileMeta}>Secure session active until {formatDateTime(session?.expiresAt ?? "")}</Text>
      </GlassCard>

      <Card style={{ marginTop: 12 }}>
        <SectionLabel label="Rewards" />
        {loyaltyBalanceQuery.isLoading ? <Text style={styles.bodyText}>Loading rewards balance...</Text> : null}
        {loyaltyBalanceQuery.error ? <Text style={styles.errorText}>Unable to load rewards balance.</Text> : null}

        {loyaltyBalance ? (
          <View style={styles.rewardsGrid}>
            <MetricTile label="Available" value={`${loyaltyBalance.availablePoints} pts`} />
            <MetricTile label="Pending" value={`${loyaltyBalance.pendingPoints} pts`} />
            <MetricTile label="Lifetime" value={`${loyaltyBalance.lifetimeEarned} pts`} />
          </View>
        ) : null}

        {loyaltyLedger.length > 0 ? (
          <View style={styles.ledgerWrap}>
            {loyaltyLedger.slice(0, 5).map((entry) => (
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
        <SectionLabel label="Order Alerts" />
        <Text style={styles.bodyText}>
          Keep pickup updates close at hand so the handoff feels as smooth as the ordering flow.
        </Text>
        {showNotificationTesting ? (
          <>
            <Button
              label={pushTokenMutation.isPending ? "Saving..." : "Enable Test Updates"}
              onPress={handleRegisterPushToken}
              disabled={pushTokenMutation.isPending}
              style={{ marginTop: 12 }}
            />
            {notificationStatus ? <Text style={styles.statusText}>{notificationStatus}</Text> : null}
            <Text style={styles.profileMeta}>Developer test registration is only shown in development builds.</Text>
          </>
        ) : (
          <View style={styles.emptyPanel}>
            <Ionicons name="notifications-outline" size={18} color={uiPalette.walnut} />
            <Text style={styles.bodyText}>Push alert preferences will appear here once device permissions are enabled.</Text>
          </View>
        )}
      </Card>

      <View style={styles.footerActions}>
        <Button
          label={signOutPending ? "Signing Out..." : "Sign Out"}
          variant="ghost"
          onPress={() => {
            void handleSignOut();
          }}
          disabled={signOutPending}
        />
      </View>
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
  profileHeader: {
    marginTop: 8,
    flexDirection: "row",
    gap: 16,
    alignItems: "flex-start"
  },
  heroTitle: {
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
  profileMeta: {
    marginTop: 14,
    fontSize: 12,
    color: uiPalette.textMuted
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
  metricGrid: {
    marginTop: 16,
    flexDirection: "row",
    gap: 10
  },
  metricTile: {
    flex: 1,
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
    fontSize: 18,
    fontWeight: "700",
    color: uiPalette.text
  },
  rewardsGrid: {
    marginTop: 12,
    flexDirection: "row",
    gap: 10
  },
  ledgerWrap: {
    marginTop: 14,
    gap: 10
  },
  ledgerItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12
  },
  ledgerMeta: {
    fontSize: 12,
    color: uiPalette.textMuted
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
  emptyPanel: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  statusText: {
    marginTop: 10,
    fontSize: 13,
    lineHeight: 19,
    color: uiPalette.text
  },
  footerActions: {
    marginTop: 12
  }
});
