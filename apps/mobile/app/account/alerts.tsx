import { useRouter } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuthSession } from "../../src/auth/session";
import { usePushTokenRegistrationMutation } from "../../src/account/data";
import { AccountFloatingHeader, ACCOUNT_HEADER_HEIGHT } from "../../src/account/AccountFloatingHeader";
import { resolveAppConfigData, useAppConfigQuery } from "../../src/menu/catalog";
import { Button, Card, Chip, GlassCard, ScreenScroll, SectionLabel, uiPalette, uiTypography } from "../../src/ui/system";

export default function AlertsPage() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isAuthenticated, session } = useAuthSession();
  const appConfig = resolveAppConfigData(useAppConfigQuery().data);
  const pushEnabled = appConfig.featureFlags.pushNotifications;
  const pushTokenMutation = usePushTokenRegistrationMutation();
  const [statusMessage, setStatusMessage] = useState("");
  const headerOffset = insets.top + ACCOUNT_HEADER_HEIGHT;
  const showNotificationTesting = __DEV__ && pushEnabled && isAuthenticated;

  function goBack() {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace("/(tabs)/account");
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
      <View style={styles.screenShell}>
        <ScreenScroll bottomInset={48} contentContainerStyle={[styles.screenContentNoTopPadding, { paddingTop: headerOffset }]}>
          <GlassCard style={styles.heroCard}>
            <SectionLabel label="Alerts" />
            <Text style={styles.heroTitle}>Sign in to manage alerts.</Text>
            <Text style={styles.heroBody}>Notification preferences stay attached to one account and device.</Text>
            <Button
              label="Sign In"
              variant="secondary"
              onPress={() => router.push({ pathname: "/auth", params: { returnTo: "/account/alerts" } })}
              style={styles.heroAction}
            />
          </GlassCard>
        </ScreenScroll>

        <AccountFloatingHeader title="Alerts" insetTop={insets.top} onBack={goBack} />
      </View>
    );
  }

  return (
    <View style={styles.screenShell}>
      <ScreenScroll bottomInset={48} contentContainerStyle={[styles.screenContentNoTopPadding, { paddingTop: headerOffset }]}>
        <GlassCard style={styles.heroCard}>
          <View style={styles.heroTopRow}>
            <View style={styles.heroCopy}>
              <SectionLabel label="Notifications" />
              <Text style={styles.heroTitle}>{pushEnabled ? "Pickup alerts ready." : "Alerts are disabled."}</Text>
              <Text style={styles.heroBody}>
                {pushEnabled
                  ? "Use this space for push setup, status awareness, and device-specific alert controls."
                  : "This client has notifications turned off right now."}
              </Text>
            </View>
            <Chip label={pushEnabled ? "Push On" : "Push Off"} active={pushEnabled} />
          </View>
        </GlassCard>

        <Card style={styles.sectionCard}>
          <SectionLabel label="Status" />
          <Text style={styles.bodyText}>
            {pushEnabled
              ? "Pickup and status alerts will appear here once the device grants notification access."
              : "Push notifications are disabled for this client configuration."}
          </Text>

          {showNotificationTesting ? (
            <>
              <Button
                label={pushTokenMutation.isPending ? "Saving…" : "Enable Test Updates"}
                onPress={handleRegisterPushToken}
                style={styles.inlineAction}
              />
              {statusMessage ? <Text style={styles.statusText}>{statusMessage}</Text> : null}
            </>
          ) : null}
        </Card>
      </ScreenScroll>

      <AccountFloatingHeader title="Alerts" insetTop={insets.top} onBack={goBack} />
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
  heroAction: {
    marginTop: 18,
    alignSelf: "flex-start"
  },
  sectionCard: {
    marginTop: 14
  },
  bodyText: {
    marginTop: 14,
    fontSize: 14,
    lineHeight: 22,
    color: uiPalette.textSecondary
  },
  inlineAction: {
    marginTop: 16,
    alignSelf: "flex-start"
  },
  statusText: {
    marginTop: 12,
    fontSize: 13,
    lineHeight: 19,
    color: uiPalette.text
  }
});
