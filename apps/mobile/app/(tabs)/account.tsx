import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useAuthSession } from "../../src/auth/session";
import {
  useLoyaltyBalanceQuery,
  useLoyaltyLedgerQuery,
  usePushTokenRegistrationMutation
} from "../../src/account/data";
import { Button, Card, Chip, GlassCard, ScreenScroll, SectionLabel, TitleBlock, uiPalette, uiTypography } from "../../src/ui/system";

function formatDateTime(value: string) {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return value;
  return new Date(parsed).toLocaleString();
}

function Metric({
  label,
  value
}: {
  label: string;
  value: string;
}) {
  return (
    <View style={styles.metricCard}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

export default function AccountScreen() {
  const router = useRouter();
  const { isAuthenticated, session, signOut } = useAuthSession();
  const loyaltyBalanceQuery = useLoyaltyBalanceQuery(isAuthenticated);
  const loyaltyLedgerQuery = useLoyaltyLedgerQuery(isAuthenticated);
  const pushTokenMutation = usePushTokenRegistrationMutation();
  const showNotificationTesting = __DEV__;
  const [statusMessage, setStatusMessage] = useState("");
  const [signOutPending, setSignOutPending] = useState(false);
  const [isManualRefresh, setIsManualRefresh] = useState(false);

  const loyaltyBalance = loyaltyBalanceQuery.data;
  const loyaltyLedger = loyaltyLedgerQuery.data ?? [];

  async function handleSignOut() {
    setSignOutPending(true);
    try {
      await signOut();
    } finally {
      setSignOutPending(false);
    }
  }

  function handleRefresh() {
    if (isManualRefresh) return;

    setIsManualRefresh(true);
    void Promise.allSettled([loyaltyBalanceQuery.refetch(), loyaltyLedgerQuery.refetch()]).finally(() => {
      setIsManualRefresh(false);
    });
  }

  function handleSignIn() {
    router.push({ pathname: "/auth", params: { returnTo: "/(tabs)/account" } });
  }

  function handleRegisterPushToken() {
    const userIdFragment = session?.userId.slice(0, 8) ?? "guest";
    const tokenSeed = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

    setStatusMessage("Registering push token…");
    pushTokenMutation.mutate(
      {
        deviceId: `mobile-${userIdFragment}`,
        platform: "ios",
        expoPushToken: `ExponentPushToken[${tokenSeed}]`
      },
      {
        onSuccess: () => setStatusMessage("Push token registration updated."),
        onError: (error) => setStatusMessage(error instanceof Error ? error.message : "Unexpected error")
      }
    );
  }

  if (!isAuthenticated) {
    return (
      <ScreenScroll>
        <TitleBlock
          title="Account"
          subtitle="Rewards, alerts, and session settings stay separate from the order flow."
          action={
            <Button
              label="Sign In"
              variant="secondary"
              onPress={handleSignIn}
              left={<Ionicons name="log-in-outline" size={16} color={uiPalette.text} />}
            />
          }
        />

        <GlassCard style={{ marginTop: 18 }}>
          <SectionLabel label="Sign in required" />
          <Text style={styles.heroTitle}>Account details live here.</Text>
          <Text style={styles.heroBody}>
            Sign in to keep rewards, alerts, and your session attached to one account without adding friction to ordering.
          </Text>
        </GlassCard>
      </ScreenScroll>
    );
  }

  return (
    <ScreenScroll
      bottomInset={156}
      refreshing={isManualRefresh}
      onRefresh={handleRefresh}
    >
      <TitleBlock
        title="Account"
        subtitle="A separate place for rewards, session, and alert settings."
        action={<Button label="Refresh" variant="secondary" onPress={handleRefresh} />}
      />

      <GlassCard style={{ marginTop: 18 }}>
        <SectionLabel label="Overview" />
        <Text style={styles.heroTitle}>Session and rewards stay lightweight.</Text>
        <Text style={styles.heroBody}>
          Orders live in their own tab. This screen stays focused on account information and preferences.
        </Text>
        <View style={styles.metricGrid}>
          <Metric label="Available" value={loyaltyBalance ? `${loyaltyBalance.availablePoints} pts` : "Loading"} />
          <Metric label="Pending" value={loyaltyBalance ? `${loyaltyBalance.pendingPoints} pts` : "--"} />
          <Metric label="Lifetime" value={loyaltyBalance ? `${loyaltyBalance.lifetimeEarned} pts` : "--"} />
        </View>
        <Text style={styles.sessionMeta}>Session active until {formatDateTime(session?.expiresAt ?? "")}</Text>
      </GlassCard>

      <Card style={{ marginTop: 14 }}>
        <SectionLabel label="Rewards activity" />
        {loyaltyLedger.length === 0 ? (
          <Text style={styles.bodyText}>Rewards activity will appear here after your next completed order.</Text>
        ) : (
          <View style={styles.groupedList}>
            {loyaltyLedger.slice(0, 5).map((entry, index) => (
              <View key={entry.id}>
                <View style={styles.ledgerRow}>
                  <Chip label={`${entry.type} ${entry.points > 0 ? `+${entry.points}` : entry.points}`} active={entry.points > 0} />
                  <Text style={styles.ledgerMeta}>{formatDateTime(entry.createdAt)}</Text>
                </View>
                {index < Math.min(loyaltyLedger.length, 5) - 1 ? <View style={styles.divider} /> : null}
              </View>
            ))}
          </View>
        )}
      </Card>

      <Card style={{ marginTop: 14 }}>
        <SectionLabel label="Alerts" />
        <Text style={styles.bodyText}>Notification controls should support pickup, not compete with it.</Text>
        {showNotificationTesting ? (
          <>
            <Button
              label={pushTokenMutation.isPending ? "Saving…" : "Enable Test Updates"}
              onPress={handleRegisterPushToken}
              style={{ marginTop: 16 }}
            />
            {statusMessage ? <Text style={styles.statusText}>{statusMessage}</Text> : null}
          </>
        ) : (
          <Text style={styles.bodyText}>Push alert settings will appear here once device permissions are enabled.</Text>
        )}
      </Card>

      <View style={styles.footerActions}>
        <Button
          label={signOutPending ? "Signing Out…" : "Sign Out"}
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
  metricGrid: {
    marginTop: 18,
    flexDirection: "row",
    gap: 10
  },
  metricCard: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 14,
    borderRadius: 18,
    backgroundColor: uiPalette.surfaceStrong,
    borderWidth: 1,
    borderColor: uiPalette.border
  },
  metricLabel: {
    fontSize: 11,
    lineHeight: 14,
    textTransform: "uppercase",
    letterSpacing: 1,
    color: uiPalette.textMuted,
    fontWeight: "700"
  },
  metricValue: {
    marginTop: 6,
    fontSize: 16,
    lineHeight: 20,
    fontWeight: "600",
    color: uiPalette.text
  },
  sessionMeta: {
    marginTop: 16,
    fontSize: 12,
    lineHeight: 18,
    color: uiPalette.textSecondary
  },
  groupedList: {
    marginTop: 14
  },
  ledgerRow: {
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12
  },
  ledgerMeta: {
    flex: 1,
    textAlign: "right",
    fontSize: 12,
    lineHeight: 18,
    color: uiPalette.textSecondary
  },
  divider: {
    height: 1,
    backgroundColor: uiPalette.border
  },
  bodyText: {
    marginTop: 14,
    fontSize: 14,
    lineHeight: 22,
    color: uiPalette.textSecondary
  },
  statusText: {
    marginTop: 12,
    fontSize: 13,
    lineHeight: 19,
    color: uiPalette.text
  },
  footerActions: {
    marginTop: 14,
    alignItems: "flex-start"
  }
});
