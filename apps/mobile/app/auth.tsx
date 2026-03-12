import * as AppleAuthentication from "expo-apple-authentication";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
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

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ReturnToPath = "/(tabs)/cart" | "/(tabs)/home" | "/(tabs)/account";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resolveReturnToPath(input: string | string[] | undefined): ReturnToPath | null {
  if (Array.isArray(input)) return resolveReturnToPath(input[0]);
  if (
    input === "/(tabs)/cart" ||
    input === "/(tabs)/home" ||
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

/** Generate a cryptographically suitable nonce string. */
function generateNonce(): string {
  return `mobile-auth-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Fire-and-forget wrapper — keeps JSX onPress handlers clean. */
function voidHandler(fn: () => Promise<void>): () => void {
  return () => { void fn(); };
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function Section({
  label,
  children,
  style
}: {
  label: string;
  children: React.ReactNode;
  style?: object;
}) {
  return (
    <View style={[styles.sectionCard, style]}>
      <Text style={styles.sectionLabel}>{label}</Text>
      {children}
    </View>
  );
}

function ActionTile({
  label,
  onPress,
  disabled = false,
  tone = "default",
  loading = false,
  centered = false,
  showChevron = true,
  style
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  tone?: "default" | "danger";
  loading?: boolean;
  centered?: boolean;
  showChevron?: boolean;
  style?: object;
}) {
  const danger = tone === "danger";
  const chevronColor = danger ? "rgba(180, 35, 24, 0.55)" : "rgba(99, 115, 141, 0.52)";

  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionTile,
        danger ? styles.actionTileDanger : null,
        disabled ? styles.actionTileDisabled : null,
        pressed && !disabled ? styles.actionTilePressed : null,
        style
      ]}
    >
      <View style={[styles.actionTileLeft, centered ? styles.actionTileLeftCentered : null]}>
        <Text style={[styles.actionTileLabel, danger ? styles.actionTileLabelDanger : null, centered ? styles.actionTileLabelCentered : null]}>
          {label}
        </Text>
      </View>
      {loading ? (
        <ActivityIndicator size="small" color={danger ? "#B42318" : "rgba(99, 115, 141, 0.75)"} />
      ) : showChevron ? (
        <Ionicons
          name="chevron-forward"
          size={16}
          color={chevronColor}
        />
      ) : (
        <View style={styles.actionTileChevronSpacer} />
      )}
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function AuthScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ returnTo?: string | string[] }>();
  const { session, isAuthenticated, isHydrating, signOut, refreshSession } = useAuthSession();

  // Pre-fill email/token only in development builds.
  const [email, setEmail] = useState(__DEV__ ? "owner@gazellecoffee.com" : "");
  const [magicLinkToken, setMagicLinkToken] = useState(__DEV__ ? "demo-magic-token" : "");
  const [sessionActionMessage, setSessionActionMessage] = useState("");
  const [appleAvailable, setAppleAvailable] = useState(false);
  const [appleAvailabilityResolved, setAppleAvailabilityResolved] = useState(false);
  const [appleNativeStatus, setAppleNativeStatus] = useState("");

  // Track whether a magic link was successfully requested so we can
  // reveal the "Verify Link" section only when relevant.
  const [magicLinkRequested, setMagicLinkRequested] = useState(false);

  const appleExchange = useAppleExchangeMutation();
  const magicLinkRequest = useMagicLinkRequestMutation();
  const magicLinkVerify = useMagicLinkVerifyMutation();
  const meQuery = useMeQueryMutation();
  const returnTo = useMemo(() => resolveReturnToPath(params.returnTo), [params.returnTo]);

  // Show verify section once a request succeeds.
  useEffect(() => {
    if (magicLinkRequest.isSuccess) setMagicLinkRequested(true);
  }, [magicLinkRequest.isSuccess]);

  // Redirect once authenticated.
  useEffect(() => {
    if (isAuthenticated && returnTo) router.replace(returnTo);
  }, [isAuthenticated, returnTo, router]);

  // Check Apple availability once on mount.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const available = await AppleAuthentication.isAvailableAsync();
      if (cancelled) return;
      setAppleAvailable(available);
      setAppleAvailabilityResolved(true);
    })();
    return () => { cancelled = true; };
  }, []);

  // ---------------------------------------------------------------------------
  // Derived status strings
  // ---------------------------------------------------------------------------

  const requestStatus = magicLinkRequest.isSuccess
    ? "Magic link sent — check your email."
    : magicLinkRequest.error
      ? toErrorMessage(magicLinkRequest.error)
      : "";

  const verifyStatus = magicLinkVerify.isSuccess
    ? `Signed in as ${magicLinkVerify.data.userId}`
    : magicLinkVerify.error
      ? toErrorMessage(magicLinkVerify.error)
      : "";

  const appleStatus = appleExchange.isSuccess
    ? `Apple sign-in complete for ${appleExchange.data.userId}`
    : appleExchange.error
      ? toErrorMessage(appleExchange.error)
      : appleNativeStatus;

  const meStatus = meQuery.data
    ? `me: ${meQuery.data.email ?? "No email"} (${meQuery.data.methods.join(", ")})`
    : meQuery.error
      ? toErrorMessage(meQuery.error)
      : "";

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  async function handleRefreshSession() {
    // Guard: session must exist even though the button is disabled when not
    // authenticated — defensive for programmatic callers.
    if (!isAuthenticated) return;

    setSessionActionMessage("Refreshing session…");
    const nextSession = await refreshSession();

    if (nextSession) {
      setSessionActionMessage(
        `Session refreshed. Expires ${formatExpiresAt(nextSession.expiresAt)}.`
      );
      return;
    }

    setSessionActionMessage("Session refresh failed. You are now signed out.");
  }

  async function handleSignOut() {
    setSessionActionMessage("Signing out…");
    await signOut();
    setSessionActionMessage("Signed out.");
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

    // Always generate a fresh nonce per attempt — single-use and unpredictable.
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

      setAppleNativeStatus("Apple credential received. Exchanging session…");
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

  // ---------------------------------------------------------------------------
  // Render: hydrating
  // ---------------------------------------------------------------------------

  if (isHydrating) {
    return (
      <View style={styles.backdrop}>
        <View style={[styles.sheet, { paddingTop: 6 }]}>
          <View style={styles.handleWrap}>
            <View style={styles.modalHandle} />
          </View>
          <View style={styles.sheetInner}>
            <Text style={styles.heroTitle}>Sign in</Text>
            <Text style={styles.heroSubtitle}>Restoring your secure session…</Text>
            <Section label="Session">
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

  // ---------------------------------------------------------------------------
  // Render: main
  // ---------------------------------------------------------------------------

  return (
    <View style={styles.backdrop}>
      <View style={[styles.sheet, { paddingTop: 6 }]}>
        <View style={styles.handleWrap}>
          <View style={styles.modalHandle} />
        </View>

        <View style={styles.heroHeader}>
          <Text style={styles.heroTitle}>Sign in</Text>
          <Text style={styles.heroSubtitle}>
            Use your Apple account for the fastest sign-in, or request a secure magic link.
          </Text>
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
          {/* ── Session status ── */}
          <Section label="Session" style={{ marginTop: 18 }}>
            {isAuthenticated && session ? (
              <>
                <Text style={styles.sessionUser}>Signed in as {session.userId}</Text>
                <Text style={styles.sessionMeta}>
                  Expires {formatExpiresAt(session.expiresAt)}
                </Text>
              </>
            ) : (
              <Text style={styles.infoText}>Not authenticated.</Text>
            )}
          </Section>

          {/* ── Auth sections (hidden once signed in) ── */}
          {!isAuthenticated && (
            <>
              {/* Apple Sign-In */}
              <Section label="Apple Sign-In">
                <Text style={styles.helperText}>
                  Apple native sign-in is the primary path on supported iPhone devices.
                </Text>

                <View style={{ marginTop: 14 }}>
                  {appleAvailable ? (
                    <AppleAuthentication.AppleAuthenticationButton
                      buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
                      buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
                      cornerRadius={16}
                      style={{
                        width: "100%",
                        height: 50,
                        opacity: appleExchange.isPending ? 0.65 : 1
                      }}
                      onPress={voidHandler(handleNativeAppleSignIn)}
                    />
                  ) : (
                    <Button
                      label="Apple Sign-In Unavailable"
                      variant="secondary"
                      disabled
                    />
                  )}
                </View>

                {appleAvailabilityResolved && !appleAvailable && (
                  <Text style={styles.helperText}>
                    Apple Sign-In is only available on supported iOS devices.
                  </Text>
                )}

                {appleStatus ? (
                  <Text style={styles.statusText}>{appleStatus}</Text>
                ) : null}
              </Section>

              {/* Email magic link request */}
              <Section label="Email Fallback">
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  autoCorrect={false}
                  placeholder="Email"
                  placeholderTextColor="rgba(60,60,67,0.38)"
                  keyboardType="email-address"
                  style={styles.input}
                />

                <Button
                  label={magicLinkRequest.isPending ? "Sending…" : "Send Magic Link"}
                  onPress={() => {
                    setSessionActionMessage("");
                    magicLinkRequest.mutate({ email: email.trim() });
                  }}
                  disabled={magicLinkRequest.isPending}
                  style={{ marginTop: 14 }}
                />

                {requestStatus ? (
                  <Text style={styles.statusText}>{requestStatus}</Text>
                ) : null}
              </Section>

              {/* Verify section: only shown after a successful request */}
              {magicLinkRequested && (
                <Section label="Verify Link">
                  <TextInput
                    value={magicLinkToken}
                    onChangeText={setMagicLinkToken}
                    autoCapitalize="none"
                    autoCorrect={false}
                    placeholder="Magic link token"
                    placeholderTextColor="rgba(60,60,67,0.38)"
                    style={styles.input}
                  />

                  <Button
                    label={magicLinkVerify.isPending ? "Verifying…" : "Verify Magic Link"}
                    onPress={() => {
                      setSessionActionMessage("");
                      magicLinkVerify.mutate({ token: magicLinkToken.trim() });
                    }}
                    disabled={magicLinkVerify.isPending}
                    style={{ marginTop: 14 }}
                  />

                  {verifyStatus ? (
                    <Text style={styles.statusText}>{verifyStatus}</Text>
                  ) : null}
                </Section>
              )}
            </>
          )}

          {/* ── Account actions ── */}
          <Section label="Account">
            <View style={styles.actionsList}>
              <ActionTile
                label="Refresh Session"
                onPress={voidHandler(handleRefreshSession)}
                disabled={!isAuthenticated}
                style={styles.actionListRow}
              />

              <View style={styles.actionSeparator} />

              <ActionTile
                label="Fetch /auth/me"
                onPress={() => { meQuery.mutate(); }}
                disabled={!isAuthenticated || meQuery.isPending}
                loading={meQuery.isPending}
                style={styles.actionListRow}
              />
            </View>

            <View style={styles.signOutList}>
              <ActionTile
                label="Sign Out"
                tone="danger"
                onPress={voidHandler(handleSignOut)}
                disabled={!isAuthenticated}
                style={styles.actionListRow}
                centered
                showChevron={false}
              />
            </View>

            {sessionActionMessage ? (
              <Text style={styles.statusText}>{sessionActionMessage}</Text>
            ) : null}
            {meStatus ? (
              <Text style={styles.statusText}>{meStatus}</Text>
            ) : null}
          </Section>

          <Button
            label="Back to Home"
            variant="ghost"
            onPress={() => router.replace("/(tabs)/home")}
            style={{ marginTop: 14 }}
          />
        </ScrollView>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    // Transparent so the navigator's underlying screen shows through —
    // this is what gives a real iOS modal its depth. The sheet itself
    // provides the surface.
    backgroundColor: "transparent"
  },

  sheet: {
    flex: 1,
    marginTop: 8,
    backgroundColor: "rgba(242, 242, 247, 0.96)",
    borderTopLeftRadius: 34,
    borderTopRightRadius: 34,
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
    backgroundColor: "rgba(60, 60, 67, 0.22)"
  },

  heroHeader: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 6
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
    color: "#0F172A"
  },

  heroSubtitle: {
    marginTop: 10,
    fontSize: 15,
    lineHeight: 22,
    color: "rgba(60, 60, 67, 0.82)"
  },

  sectionCard: {
    marginTop: 14,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.62)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(60,60,67,0.10)",
    paddingHorizontal: 16,
    paddingVertical: 16
  },

  sectionLabel: {
    fontSize: 12,
    lineHeight: 14,
    fontWeight: "700",
    letterSpacing: 2.1,
    textTransform: "uppercase",
    color: "rgba(99, 115, 141, 0.92)"
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
    fontWeight: "600",
    color: "#111827"
  },

  sessionMeta: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 18,
    color: "rgba(60, 60, 67, 0.72)"
  },

  infoText: {
    marginTop: 10,
    fontSize: 15,
    lineHeight: 21,
    color: "rgba(60, 60, 67, 0.86)"
  },

  helperText: {
    marginTop: 10,
    fontSize: 13,
    lineHeight: 18,
    color: "rgba(60, 60, 67, 0.68)"
  },

  statusText: {
    marginTop: 10,
    fontSize: 13,
    lineHeight: 18,
    color: "rgba(60, 60, 67, 0.82)"
  },

  input: {
    marginTop: 12,
    minHeight: 52,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(60,60,67,0.12)",
    backgroundColor: "rgba(255,255,255,0.78)",
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === "ios" ? 14 : 12,
    fontSize: 17,
    fontWeight: "500",
    color: "#0F172A"
  },

  actionsList: {
    marginTop: 12,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(60,60,67,0.12)",
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.9)"
  },

  signOutList: {
    marginTop: 10,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(180, 35, 24, 0.16)",
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.9)"
  },

  actionSeparator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(60,60,67,0.1)",
    marginLeft: 16
  },

  actionTile: {
    minHeight: 50,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },

  actionListRow: {
    borderRadius: 0
  },

  actionTileDanger: {
    backgroundColor: "transparent"
  },

  actionTileDisabled: {
    opacity: 0.46
  },

  actionTilePressed: {
    backgroundColor: "rgba(15, 23, 42, 0.03)"
  },

  actionTileLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1
  },

  actionTileLeftCentered: {
    justifyContent: "center"
  },

  actionTileLabel: {
    fontSize: 17,
    fontWeight: "400",
    color: "rgba(17, 24, 39, 0.92)"
  },

  actionTileLabelDanger: {
    color: "#B42318"
  },

  actionTileLabelCentered: {
    textAlign: "center"
  },

  actionTileChevronSpacer: {
    width: 16
  }
});
