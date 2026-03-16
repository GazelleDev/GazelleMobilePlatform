import * as AppleAuthentication from "expo-apple-authentication";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  useAppleExchangeMutation,
  useMagicLinkRequestMutation,
  useMagicLinkVerifyMutation,
  useMeQueryMutation
} from "../src/auth/useAuth";
import { useAuthSession } from "../src/auth/session";
import { Button, Card, GlassCard, SectionLabel, uiPalette, uiTypography } from "../src/ui/system";

type ReturnToPath = "cart" | "/(tabs)/home" | "/(tabs)/orders" | "/(tabs)/account";

function resolveReturnToPath(input: string | string[] | undefined): ReturnToPath | null {
  if (Array.isArray(input)) return resolveReturnToPath(input[0]);
  if (input === "cart" || input === "/(tabs)/home" || input === "/(tabs)/orders" || input === "/(tabs)/account") {
    return input;
  }
  return null;
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}

function formatExpiresAt(expiresAt: string): string {
  const date = new Date(expiresAt);
  return Number.isNaN(date.getTime()) ? expiresAt : date.toLocaleString();
}

function generateNonce(): string {
  return `mobile-auth-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function voidHandler(fn: () => Promise<void>): () => void {
  return () => {
    void fn();
  };
}

export default function AuthScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ returnTo?: string | string[] }>();
  const { session, isAuthenticated, isHydrating, signOut, refreshSession } = useAuthSession();

  const [email, setEmail] = useState(__DEV__ ? "owner@gazellecoffee.com" : "");
  const [magicLinkToken, setMagicLinkToken] = useState(__DEV__ ? "demo-magic-token" : "");
  const [sessionMessage, setSessionMessage] = useState("");
  const [appleAvailable, setAppleAvailable] = useState(false);
  const [appleAvailabilityResolved, setAppleAvailabilityResolved] = useState(false);
  const [appleNativeStatus, setAppleNativeStatus] = useState("");
  const [magicLinkRequested, setMagicLinkRequested] = useState(false);

  const appleExchange = useAppleExchangeMutation();
  const magicLinkRequest = useMagicLinkRequestMutation();
  const magicLinkVerify = useMagicLinkVerifyMutation();
  const meQuery = useMeQueryMutation();
  const returnTo = useMemo(() => resolveReturnToPath(params.returnTo), [params.returnTo]);
  const showInternalActions = __DEV__;

  useEffect(() => {
    if (magicLinkRequest.isSuccess) setMagicLinkRequested(true);
  }, [magicLinkRequest.isSuccess]);

  useEffect(() => {
    if (!isAuthenticated || !returnTo) return;

    if (returnTo === "cart") {
      if (router.canGoBack()) {
        router.back();
        return;
      }
      router.replace("/cart");
      return;
    }

    router.replace(returnTo);
  }, [isAuthenticated, returnTo, router]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const available = await AppleAuthentication.isAvailableAsync();
      if (cancelled) return;
      setAppleAvailable(available);
      setAppleAvailabilityResolved(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const requestStatus = magicLinkRequest.isSuccess
    ? "Check your email for a secure sign-in link."
    : magicLinkRequest.error
      ? toErrorMessage(magicLinkRequest.error)
      : "";
  const verifyStatus = magicLinkVerify.isSuccess
    ? "Email sign-in complete."
    : magicLinkVerify.error
      ? toErrorMessage(magicLinkVerify.error)
      : "";
  const appleStatus = appleExchange.isSuccess
    ? "Apple sign-in complete."
    : appleExchange.error
      ? toErrorMessage(appleExchange.error)
      : appleNativeStatus;
  const meStatus = meQuery.data
    ? `Session verified for ${meQuery.data.email ?? "this account"}.`
    : meQuery.error
      ? toErrorMessage(meQuery.error)
      : "";

  async function handleRefreshSession() {
    if (!isAuthenticated) return;

    setSessionMessage("Refreshing session…");
    const nextSession = await refreshSession();

    if (nextSession) {
      setSessionMessage(`Session refreshed. Expires ${formatExpiresAt(nextSession.expiresAt)}.`);
      return;
    }

    setSessionMessage("Session refresh failed. You are now signed out.");
  }

  async function handleSignOut() {
    setSessionMessage("Signing out…");
    await signOut();
    setSessionMessage("Signed out.");
  }

  async function handleNativeAppleSignIn() {
    if (appleExchange.isPending) return;

    if (!appleAvailabilityResolved) {
      setAppleNativeStatus("Checking Apple Sign-In availability…");
      return;
    }

    if (!appleAvailable) {
      setAppleNativeStatus("Apple Sign-In is unavailable on this device.");
      return;
    }

    const safeNonce = generateNonce();
    setAppleNativeStatus("Requesting Apple credential…");

    try {
      const credential = await AppleAuthentication.signInAsync({
        nonce: safeNonce,
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL
        ]
      });

      if (!credential.identityToken || !credential.authorizationCode) {
        setAppleNativeStatus("Apple Sign-In returned no identity token or authorization code.");
        return;
      }

      appleExchange.mutate({
        identityToken: credential.identityToken,
        authorizationCode: credential.authorizationCode,
        nonce: safeNonce
      });
    } catch (error) {
      const errorCode = (error as { code?: string } | null)?.code;
      if (errorCode === "ERR_REQUEST_CANCELED") {
        setAppleNativeStatus("Apple Sign-In canceled.");
        return;
      }
      setAppleNativeStatus(toErrorMessage(error));
    }
  }

  if (isHydrating) {
    return (
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.handleWrap}>
            <View style={styles.handle} />
          </View>
          <View style={styles.content}>
            <GlassCard>
              <SectionLabel label="Session" />
              <Text style={styles.heroTitle}>Restoring your session…</Text>
              <View style={styles.loadingRow}>
                <ActivityIndicator color={uiPalette.primary} />
                <Text style={styles.bodyText}>Hydrating local credentials</Text>
              </View>
            </GlassCard>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.backdrop}>
      <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) + 16 }]}>
        <View style={styles.handleWrap}>
          <View style={styles.handle} />
        </View>

        <ScrollView
          bounces
          showsVerticalScrollIndicator={false}
          contentInsetAdjustmentBehavior="never"
          contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom, 16) + 20 }]}
        >
          <GlassCard>
            <SectionLabel label="Account access" />
            <Text style={styles.heroTitle}>Sign in without leaving the flow.</Text>
            <Text style={styles.heroBody}>
              Apple Sign-In is the fastest route back in. Email stays available when you need it.
            </Text>
          </GlassCard>

          <Card style={{ marginTop: 14 }}>
            <SectionLabel label="Session" />
            {isAuthenticated && session ? (
              <>
                <Text style={styles.sectionTitle}>You are signed in.</Text>
                <Text style={styles.bodyText}>Session active until {formatExpiresAt(session.expiresAt)}.</Text>
                <Button label="Sign Out" variant="ghost" onPress={voidHandler(handleSignOut)} style={{ marginTop: 16, alignSelf: "flex-start" }} />
              </>
            ) : (
              <>
                <Text style={styles.sectionTitle}>Choose a sign-in method.</Text>
                <Text style={styles.bodyText}>The app should return you to ordering as quickly as possible.</Text>
              </>
            )}
          </Card>

          {!isAuthenticated ? (
            <>
              <Card style={{ marginTop: 14 }}>
                <SectionLabel label="Apple Sign-In" />
                <Text style={styles.sectionTitle}>Preferred on iPhone</Text>
                <Text style={styles.bodyText}>Apple Sign-In is the most direct native path back to your saved account.</Text>
                <View style={{ marginTop: 16 }}>
                  {appleAvailable ? (
                    <AppleAuthentication.AppleAuthenticationButton
                      buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
                      buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
                      cornerRadius={18}
                      style={{ width: "100%", height: 52, opacity: appleExchange.isPending ? 0.65 : 1 }}
                      onPress={voidHandler(handleNativeAppleSignIn)}
                    />
                  ) : (
                    <Button label="Apple Sign-In Unavailable" variant="secondary" disabled />
                  )}
                </View>
                {appleAvailabilityResolved && !appleAvailable ? <Text style={styles.statusText}>Apple Sign-In is only available on supported iOS devices.</Text> : null}
                {appleStatus ? <Text style={styles.statusText}>{appleStatus}</Text> : null}
              </Card>

              <Card style={{ marginTop: 14 }}>
                <SectionLabel label="Email sign-in" />
                <Text style={styles.sectionTitle}>Use a secure link</Text>
                <Text style={styles.bodyText}>Enter your email and we will send a secure sign-in link.</Text>
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  autoCorrect={false}
                  placeholder="Email"
                  placeholderTextColor={uiPalette.textMuted}
                  keyboardType="email-address"
                  style={styles.input}
                />
                <Button
                  label={magicLinkRequest.isPending ? "Sending…" : "Send Sign-In Link"}
                  onPress={() => magicLinkRequest.mutate({ email: email.trim() })}
                  disabled={magicLinkRequest.isPending}
                  style={{ marginTop: 16 }}
                />
                {requestStatus ? <Text style={styles.statusText}>{requestStatus}</Text> : null}
              </Card>

              {magicLinkRequested ? (
                <Card style={{ marginTop: 14 }}>
                  <SectionLabel label="Complete sign-in" />
                  <Text style={styles.sectionTitle}>Paste your code</Text>
                  <TextInput
                    value={magicLinkToken}
                    onChangeText={setMagicLinkToken}
                    autoCapitalize="none"
                    autoCorrect={false}
                    placeholder="Verification code"
                    placeholderTextColor={uiPalette.textMuted}
                    style={styles.input}
                  />
                  <Button
                    label={magicLinkVerify.isPending ? "Verifying…" : "Complete Sign-In"}
                    onPress={() => magicLinkVerify.mutate({ token: magicLinkToken.trim() })}
                    disabled={magicLinkVerify.isPending}
                    style={{ marginTop: 16 }}
                  />
                  {verifyStatus ? <Text style={styles.statusText}>{verifyStatus}</Text> : null}
                </Card>
              ) : null}
            </>
          ) : (
            <Card style={{ marginTop: 14 }}>
              <SectionLabel label="Continue" />
              <Text style={styles.sectionTitle}>Return to the app</Text>
              <Button
                label={returnTo === "cart" ? "Return to Checkout" : "Continue"}
                onPress={() => {
                  if (returnTo === "cart") {
                    if (router.canGoBack()) {
                      router.back();
                      return;
                    }
                    router.replace("/cart");
                    return;
                  }
                  router.replace(returnTo ?? "/(tabs)/menu");
                }}
                style={{ marginTop: 16 }}
                left={<Ionicons name="arrow-forward" size={16} color={uiPalette.primaryText} />}
              />
            </Card>
          )}

          {showInternalActions ? (
            <Card style={{ marginTop: 14 }}>
              <SectionLabel label="Developer tools" />
              <Button
                label="Refresh Session"
                variant="secondary"
                onPress={voidHandler(handleRefreshSession)}
                disabled={!isAuthenticated}
                style={{ marginTop: 14 }}
              />
              <Button
                label={meQuery.isPending ? "Checking…" : "Fetch /auth/me"}
                variant="ghost"
                onPress={() => {
                  meQuery.mutate();
                }}
                disabled={!isAuthenticated || meQuery.isPending}
                style={{ marginTop: 10 }}
              />
              {meStatus ? <Text style={styles.statusText}>{meStatus}</Text> : null}
            </Card>
          ) : null}

          {sessionMessage ? <Text style={styles.footerMessage}>{sessionMessage}</Text> : null}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "transparent"
  },
  sheet: {
    flex: 1,
    backgroundColor: "rgba(246, 247, 244, 0.98)",
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    borderWidth: 1,
    borderColor: uiPalette.border
  },
  handleWrap: {
    position: "absolute",
    top: 14,
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 10
  },
  handle: {
    width: 38,
    height: 5,
    borderRadius: 999,
    backgroundColor: "rgba(151, 160, 154, 0.52)"
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 24
  },
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
  sectionTitle: {
    marginTop: 10,
    fontSize: 20,
    lineHeight: 24,
    fontWeight: "600",
    color: uiPalette.text
  },
  bodyText: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 22,
    color: uiPalette.textSecondary
  },
  input: {
    marginTop: 16,
    minHeight: 52,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: uiPalette.border,
    backgroundColor: uiPalette.surfaceStrong,
    paddingHorizontal: 14,
    color: uiPalette.text
  },
  statusText: {
    marginTop: 12,
    fontSize: 13,
    lineHeight: 19,
    color: uiPalette.text
  },
  loadingRow: {
    marginTop: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  footerMessage: {
    marginTop: 16,
    fontSize: 13,
    lineHeight: 19,
    color: uiPalette.textSecondary
  }
});
