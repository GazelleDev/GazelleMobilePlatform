import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuthSession } from "../../src/auth/session";
import { useLoyaltyBalanceQuery, useLoyaltyLedgerQuery } from "../../src/account/data";
import { AccountFloatingHeader, ACCOUNT_HEADER_HEIGHT } from "../../src/account/AccountFloatingHeader";
import { resolveAppConfigData, useAppConfigQuery } from "../../src/menu/catalog";
import { TAB_BAR_HEIGHT, getTabBarBottomOffset } from "../../src/navigation/tabBarMetrics";
import { Button, Chip, GlassCard, ScreenScroll, SectionLabel, uiPalette, uiTypography } from "../../src/ui/system";

function formatMemberLabel(userId: string | undefined) {
  if (!userId) {
    return "Member";
  }

  return `Member ${userId.slice(0, 8).toUpperCase()}`;
}

function AccountPageRow({
  label,
  isLast = false,
  onPress
}: {
  label: string;
  isLast?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.pageRow, pressed ? styles.pageRowPressed : null]}>
      <View style={styles.pageRowInner}>
        <Text numberOfLines={1} style={styles.pageRowLabel}>
          {label}
        </Text>
        <Ionicons name="arrow-forward" size={16} color={uiPalette.text} style={styles.pageRowChevron} />
      </View>
      {isLast ? null : <View style={styles.pageRowDivider} />}
    </Pressable>
  );
}

export default function AccountScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isAuthenticated, session } = useAuthSession();
  const appConfigQuery = useAppConfigQuery();
  const appConfig = resolveAppConfigData(appConfigQuery.data);
  const loyaltyEnabled = appConfig.loyaltyEnabled && appConfig.featureFlags.loyalty;
  const loyaltyBalanceQuery = useLoyaltyBalanceQuery(isAuthenticated && loyaltyEnabled);
  const loyaltyLedgerQuery = useLoyaltyLedgerQuery(isAuthenticated && loyaltyEnabled);
  const [isManualRefresh, setIsManualRefresh] = useState(false);

  const loyaltyBalance = loyaltyBalanceQuery.data;
  const memberLabel = formatMemberLabel(session?.userId);
  const headerOffset = insets.top + ACCOUNT_HEADER_HEIGHT;
  const contentBottomInset = Math.max(getTabBarBottomOffset(insets.bottom > 0) + TAB_BAR_HEIGHT + 24 - insets.bottom, 24);

  function handleRefresh() {
    if (isManualRefresh) return;

    setIsManualRefresh(true);
    void Promise.allSettled([
      appConfigQuery.refetch(),
      loyaltyBalanceQuery.refetch(),
      loyaltyLedgerQuery.refetch()
    ]).finally(() => {
      setIsManualRefresh(false);
    });
  }

  function openAccountRoute(pathname: "/account/rewards" | "/account/alerts" | "/account/session" | "/account/settings") {
    if (!isAuthenticated) {
      router.push({ pathname: "/auth", params: { returnTo: "/(tabs)/account" } });
      return;
    }

    router.push(pathname);
  }

  return (
    <View style={styles.screenShell}>
      <ScreenScroll
        bottomInset={contentBottomInset}
        refreshing={isAuthenticated && isManualRefresh}
        onRefresh={isAuthenticated ? handleRefresh : undefined}
        contentContainerStyle={[styles.screenContentNoTopPadding, { paddingTop: headerOffset }]}
      >
        <GlassCard style={styles.heroCard}>
          {isAuthenticated ? (
            <>
              <View style={styles.heroTopRow}>
                <View style={styles.heroCopy}>
                  <SectionLabel label="Member" />
                  <Text style={styles.heroTitle}>{memberLabel}</Text>
                  <Text style={styles.heroBody}>{appConfig.brand.locationName}</Text>
                </View>
                <Chip label={loyaltyEnabled ? "Loyalty On" : "Loyalty Off"} active={loyaltyEnabled} />
              </View>

              <View style={styles.pointsWrap}>
                <Text style={styles.pointsLabel}>Available points</Text>
                <Text style={styles.pointsValue}>{loyaltyEnabled ? (loyaltyBalance ? `${loyaltyBalance.availablePoints}` : "…") : "Off"}</Text>
                <View style={styles.pointsMetaRow}>
                  <Text style={styles.pointsMeta}>{loyaltyEnabled ? `Pending ${loyaltyBalance ? loyaltyBalance.pendingPoints : "--"} pts` : "Loyalty unavailable"}</Text>
                </View>
              </View>
            </>
          ) : (
            <>
              <SectionLabel label="Member access" />
              <Text style={styles.heroTitle}>Rewards travel with you.</Text>
              <Text style={styles.heroBody}>
                Sign in once to keep points, alerts, and session settings attached to the same customer account.
              </Text>
              <Button
                label="Sign In"
                variant="secondary"
                onPress={() => router.push({ pathname: "/auth", params: { returnTo: "/(tabs)/account" } })}
                style={styles.signInAction}
                left={<Ionicons name="log-in-outline" size={16} color={uiPalette.text} />}
              />
            </>
          )}
        </GlassCard>

        <View style={styles.listSection}>
          <View style={styles.pageList}>
            <AccountPageRow label="Rewards activity" onPress={() => openAccountRoute("/account/rewards")} />
            <AccountPageRow label="Alerts" onPress={() => openAccountRoute("/account/alerts")} />
            <AccountPageRow label="Session" onPress={() => openAccountRoute("/account/session")} />
            <AccountPageRow label="Settings" isLast onPress={() => openAccountRoute("/account/settings")} />
          </View>
        </View>
      </ScreenScroll>

      <AccountFloatingHeader title="Account" insetTop={insets.top} />
    </View>
  );
}

const styles = StyleSheet.create({
  screenShell: {
    flex: 1
  },
  screenContentNoTopPadding: {
    paddingTop: 0
  },
  heroCard: {
    marginTop: 18
  },
  heroTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 16
  },
  heroCopy: {
    flex: 1
  },
  heroTitle: {
    marginTop: 10,
    fontSize: 30,
    lineHeight: 34,
    letterSpacing: -0.8,
    color: uiPalette.text,
    fontFamily: uiTypography.displayFamily,
    fontWeight: "700"
  },
  heroBody: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 21,
    color: uiPalette.textSecondary
  },
  pointsWrap: {
    marginTop: 22,
    paddingTop: 18,
    borderTopWidth: 1,
    borderTopColor: uiPalette.border
  },
  pointsLabel: {
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 1.1,
    textTransform: "uppercase",
    color: uiPalette.textMuted,
    fontWeight: "700"
  },
  pointsValue: {
    marginTop: 10,
    fontSize: 46,
    lineHeight: 50,
    letterSpacing: -1.6,
    color: uiPalette.text,
    fontFamily: uiTypography.displayFamily,
    fontWeight: "700"
  },
  pointsMetaRow: {
    marginTop: 10,
    gap: 4
  },
  pointsMeta: {
    fontSize: 13,
    lineHeight: 18,
    color: uiPalette.textSecondary
  },
  signInAction: {
    marginTop: 18,
    alignSelf: "flex-start"
  },
  listSection: {
    marginTop: 28
  },
  pageList: {
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: uiPalette.border,
    borderBottomWidth: 1,
    borderBottomColor: uiPalette.border
  },
  pageRow: {
    minHeight: 68
  },
  pageRowPressed: {
    opacity: 0.72
  },
  pageRowInner: {
    minHeight: 68,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16
  },
  pageRowLabel: {
    flex: 1,
    fontSize: 15,
    lineHeight: 20,
    letterSpacing: 1,
    textTransform: "uppercase",
    color: uiPalette.text,
    fontFamily: uiTypography.displayFamily,
    fontWeight: "600"
  },
  pageRowChevron: {
    flexShrink: 0
  },
  pageRowDivider: {
    marginHorizontal: 12,
    height: 1,
    backgroundColor: uiPalette.border
  }
});
