import * as AppleAuthentication from "expo-apple-authentication";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type ViewStyle
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  useAppleExchangeMutation,
  useMagicLinkRequestMutation,
  useMagicLinkVerifyMutation,
  useMeQueryMutation
} from "../src/auth/useAuth";
import { useAuthSession } from "../src/auth/session";
import { Button, uiPalette } from "../src/ui/system";

type ReturnToPath = "cart" | "/(tabs)/home" | "/(tabs)/orders" | "/(tabs)/account";

function resolveReturnToPath(input: string | string[] | undefined): ReturnToPath | null {
  if (Array.isArray(input)) return resolveReturnToPath(input[0]);
  if (
    input === "cart" ||
    input === "/(tabs)/home" ||
    input === "/(tabs)/orders" ||
    input === "/(tabs)/account"
  ) {
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

function Section({
  label,
  children,
  style
}: {
  label: string;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.sectionCard, style]}>
      <Text style={styles.sectionLabel}>{label}</Text>
      {children}
    </View>
  );
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

export default function AuthScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ returnTo?: string | string[] }>();
  const { session, isAuthenticated, isHydrating, signOut, refreshSession } = useAuthSession();

  const [email, setEmail] = useState(__DEV__ ? "owner@gazellecoffee.com" : "");
  const [magicLinkToken, setMagicLinkToken] = useState(__DEV__ ? "demo-magic-token" : "");
  const [sessionActionMessage, setSessionActionMessage] = useState("");
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
    if (!isAuthenticated || !returnTo) {
      return;
    }

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

  const continueLabel =
    returnTo === "cart"
      ? "Return to Checkout"
      : returnTo === "/(tabs)/orders"
        ? "Go to Orders"
      : returnTo === "/(tabs)/account"
        ? "Go to Account"
        : "Continue to Menu";

  async function handleRefreshSession() {
    if (!isAuthenticated) return;

    setSessionActionMessage("Refreshing session...");
    const nextSession = await refreshSession();

    if (nextSession) {
      setSessionActionMessage(`Session refreshed. Expires ${formatExpiresAt(nextSession.expiresAt)}.`);
      return;
    }

    setSessionActionMessage("Session refresh failed. You are now signed out.");
  }

  async function handleSignOut() {
    setSessionActionMessage("Signing out...");
    await signOut();
    setSessionActionMessage("Signed out.");
  }

  async function handleNativeAppleSignIn() {
    if (appleExchange.isPending) return;

    if (!appleAvailabilityResolved) {
      setAppleNativeStatus("Checking Apple Sign-In availability...");
      return;
    }

    if (!appleAvailable) {
      setAppleNativeStatus("Apple Sign-In is unavailable on this device.");
      return;
    }

    const safeNonce = generateNonce();
    setAppleNativeStatus("Requesting Apple credential...");

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

      setAppleNativeStatus("Apple credential received. Exchanging session...");
      setSessionActionMessage("");
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
        <View style={[styles.sheet, { paddingTop: 6 }]}>
          <View style={styles.handleWrap}>
            <View style={styles.modalHandle} />
          </View>
          <View style={styles.sheetInner}>
            <View style={styles.heroHeader}>
              <View style={styles.heroMark}>
                <Ionicons name="shield-checkmark-outline" size={22} color={uiPalette.walnut} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.heroTitle}>Sign in</Text>
                <Text style={styles.heroSubtitle}>Restoring your secure session...</Text>
              </View>
            </View>
            <Section label="Session" style={{ marginTop: 18 }}>
              <View style={styles.loadingRow}>
                <ActivityIndicator color={uiPalette.primary} />
                <Text style={styles.infoText}>Hydrating local credentials</Text>
              </View>
            </Section>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.backdrop}>
      <View style={[styles.sheet, { paddingTop: 6 }]}>
        <View style={styles.handleWrap}>
          <View style={styles.modalHandle} />
        </View>

        <View style={styles.heroHeader}>
          <View style={styles.heroMark}>
            <Ionicons name="key-outline" size={22} color={uiPalette.walnut} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroTitle}>Sign in</Text>
            <Text style={styles.heroSubtitle}>
              Secure, quick, and native. Use Apple for the fastest path back in, or request a magic link by email.
            </Text>
          </View>
        </View>

        <ScrollView
          bounces
          showsVerticalScrollIndicator={false}
          contentInsetAdjustmentBehavior="never"
          contentContainerStyle={[
            styles.sheetInner,
            { paddingBottom: Math.max(insets.bottom, 20) + 24 }
          ]}
        >
          {!isAuthenticated ? (
            <View style={styles.detailRow}>
              <DetailPill icon="logo-apple" label="Apple Sign-In" />
              <DetailPill icon="mail-outline" label="Magic link email" />
              <DetailPill icon="shield-checkmark-outline" label="Secure session" />
            </View>
          ) : null}

          <Section label="Session" style={{ marginTop: 18 }}>
            {isAuthenticated && session ? (
              <>
                <Text style={styles.sessionUser}>You are signed in.</Text>
                <Text style={styles.sessionMeta}>
                  Your session is active until {formatExpiresAt(session.expiresAt)}.
                </Text>
              </>
            ) : (
              <Text style={styles.infoText}>Choose your preferred sign-in method below.</Text>
            )}
          </Section>

          {!isAuthenticated ? (
            <>
              <Section label="Continue with Apple">
                <Text style={styles.helperText}>
                  Apple is the fastest way to get back to your saved account on a supported iPhone.
                </Text>

                <View style={{ marginTop: 14 }}>
                  {appleAvailable ? (
                    <AppleAuthentication.AppleAuthenticationButton
                      buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
                      buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
                      cornerRadius={18}
                      style={{
                        width: "100%",
                        height: 52,
                        opacity: appleExchange.isPending ? 0.65 : 1
                      }}
                      onPress={voidHandler(handleNativeAppleSignIn)}
                    />
                  ) : (
                    <Button label="Apple Sign-In Unavailable" variant="secondary" disabled />
                  )}
                </View>

                {appleAvailabilityResolved && !appleAvailable ? (
                  <Text style={styles.helperText}>
                    Apple Sign-In is only available on supported iOS devices.
                  </Text>
                ) : null}

                {appleStatus ? <Text style={styles.statusText}>{appleStatus}</Text> : null}
              </Section>

              <Section label="Continue with Email">
                <Text style={styles.helperText}>
                  Enter your email and we will send a secure link to complete sign-in.
                </Text>
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
                  label={magicLinkRequest.isPending ? "Sending..." : "Email Me a Sign-In Link"}
                  onPress={() => {
                    setSessionActionMessage("");
                    magicLinkRequest.mutate({ email: email.trim() });
                  }}
                  disabled={magicLinkRequest.isPending}
                  style={{ marginTop: 14 }}
                />

                {requestStatus ? <Text style={styles.statusText}>{requestStatus}</Text> : null}
              </Section>

              {magicLinkRequested ? (
                <Section label="Complete Email Sign-In">
                  <Text style={styles.helperText}>
                    Paste the verification code or token from your email to finish the session.
                  </Text>
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
                    label={magicLinkVerify.isPending ? "Verifying..." : "Complete Sign-In"}
                    onPress={() => {
                      setSessionActionMessage("");
                      magicLinkVerify.mutate({ token: magicLinkToken.trim() });
                    }}
                    disabled={magicLinkVerify.isPending}
                    style={{ marginTop: 14 }}
                  />

                  {verifyStatus ? <Text style={styles.statusText}>{verifyStatus}</Text> : null}
                </Section>
              ) : null}
            </>
          ) : (
            <Section label="You Are Ready to Order">
              <Text style={styles.helperText}>
                Head back to the menu or return directly to the flow that brought you here.
              </Text>
              <View style={styles.buttonStack}>
                <Button
                  label={continueLabel}
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
                  left={<Ionicons name="arrow-forward-outline" size={16} color={uiPalette.primaryText} />}
                />
                <Button
                  label="Sign Out"
                  variant="ghost"
                  onPress={voidHandler(handleSignOut)}
                  style={{ marginTop: 10 }}
                />
              </View>

              {sessionActionMessage ? <Text style={styles.statusText}>{sessionActionMessage}</Text> : null}
            </Section>
          )}

          {showInternalActions ? (
            <Section label="Developer Session Tools">
              <Text style={styles.helperText}>
                Internal utilities stay available in development while the public auth flow remains clean.
              </Text>
              <View style={styles.buttonStack}>
                <Button
                  label="Refresh Session"
                  variant="secondary"
                  onPress={voidHandler(handleRefreshSession)}
                  disabled={!isAuthenticated}
                  style={{ marginTop: 14 }}
                />
                <Button
                  label={meQuery.isPending ? "Checking..." : "Fetch /auth/me"}
                  variant="ghost"
                  onPress={() => {
                    meQuery.mutate();
                  }}
                  disabled={!isAuthenticated || meQuery.isPending}
                  style={{ marginTop: 10 }}
                />
              </View>
              {meStatus ? <Text style={styles.statusText}>{meStatus}</Text> : null}
            </Section>
          ) : null}

          <Button
            label={isAuthenticated ? "Back to Home" : "Not Now"}
            variant={isAuthenticated ? "ghost" : "secondary"}
            onPress={() => router.replace("/(tabs)/home")}
            style={{ marginTop: 14 }}
          />
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
    backgroundColor: "rgba(246, 239, 230, 0.98)",
    borderTopLeftRadius: 34,
    borderTopRightRadius: 34,
    borderWidth: 1,
    borderColor: "rgba(198, 156, 109, 0.16)",
    overflow: "hidden"
  },
  handleWrap: {
    position: "absolute",
    top: 14,
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 10
  },
  modalHandle: {
    width: 36,
    height: 5,
    borderRadius: 999,
    backgroundColor: "rgba(153, 134, 117, 0.42)"
  },
  heroHeader: {
    flexDirection: "row",
    gap: 16,
    alignItems: "flex-start",
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 6
  },
  heroMark: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(198, 156, 109, 0.18)",
    borderWidth: 1,
    borderColor: "rgba(198, 156, 109, 0.24)"
  },
  sheetInner: {
    paddingHorizontal: 20,
    paddingTop: 8
  },
  heroTitle: {
    fontSize: 32,
    lineHeight: 36,
    fontWeight: "700",
    letterSpacing: -1.1,
    color: uiPalette.text
  },
  heroSubtitle: {
    marginTop: 10,
    fontSize: 15,
    lineHeight: 22,
    color: uiPalette.textSecondary
  },
  detailRow: {
    marginTop: 18,
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
    backgroundColor: "rgba(255, 248, 240, 0.8)",
    borderWidth: 1,
    borderColor: "rgba(198, 156, 109, 0.18)"
  },
  detailPillText: {
    fontSize: 12,
    fontWeight: "600",
    color: uiPalette.text
  },
  sectionCard: {
    marginTop: 14,
    borderRadius: 24,
    backgroundColor: "rgba(255, 248, 240, 0.74)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(115, 99, 87, 0.14)",
    paddingHorizontal: 16,
    paddingVertical: 16
  },
  sectionLabel: {
    fontSize: 12,
    lineHeight: 14,
    fontWeight: "700",
    letterSpacing: 1.6,
    textTransform: "uppercase",
    color: uiPalette.accent
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 10
  },
  sessionUser: {
    marginTop: 10,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "700",
    color: uiPalette.text
  },
  sessionMeta: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 19,
    color: uiPalette.textSecondary
  },
  infoText: {
    marginTop: 10,
    fontSize: 15,
    lineHeight: 21,
    color: uiPalette.textSecondary
  },
  helperText: {
    marginTop: 10,
    fontSize: 13,
    lineHeight: 19,
    color: uiPalette.textSecondary
  },
  statusText: {
    marginTop: 10,
    fontSize: 13,
    lineHeight: 19,
    color: uiPalette.textSecondary
  },
  input: {
    marginTop: 12,
    minHeight: 54,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(115, 99, 87, 0.16)",
    backgroundColor: "rgba(255, 248, 240, 0.86)",
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === "ios" ? 14 : 12,
    fontSize: 17,
    fontWeight: "500",
    color: uiPalette.text
  },
  buttonStack: {
    marginTop: 4
  }
});
