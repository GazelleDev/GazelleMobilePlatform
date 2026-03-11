import { useEffect, useMemo, useState } from "react";
import { Link, useLocalSearchParams, useRouter } from "expo-router";
import { Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import * as AppleAuthentication from "expo-apple-authentication";
import {
  useAppleExchangeMutation,
  usePasskeyAuthVerifyMutation,
  usePasskeyRegisterVerifyMutation,
  useMagicLinkRequestMutation,
  useMagicLinkVerifyMutation,
  useMeQueryMutation
} from "../src/auth/useAuth";
import { apiClient } from "../src/api/client";
import { useAuthSession } from "../src/auth/session";

type ReturnToPath = "/(tabs)/cart" | "/(tabs)/home" | "/(tabs)/account";

function resolveReturnToPath(input: string | string[] | undefined): ReturnToPath | null {
  if (Array.isArray(input)) {
    return resolveReturnToPath(input[0]);
  }

  if (input === "/(tabs)/cart") {
    return "/(tabs)/cart";
  }
  if (input === "/(tabs)/home") {
    return "/(tabs)/home";
  }
  if (input === "/(tabs)/account") {
    return "/(tabs)/account";
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

const defaultPasskeyUserId = "123e4567-e89b-12d3-a456-426614174000";
const defaultPasskeyRpName = "Gazelle";

type PasskeyRegistrationResult = {
  id: string;
  rawId: string;
  authenticatorAttachment?: "platform" | "cross-platform" | null;
  response: {
    clientDataJSON: string;
    attestationObject: string;
    transports?: string[];
  };
  clientExtensionResults?: Record<string, unknown>;
};

type PasskeyAssertionResult = {
  id: string;
  rawId: string;
  authenticatorAttachment?: "platform" | "cross-platform" | null;
  response: {
    clientDataJSON: string;
    authenticatorData: string;
    signature: string;
    userHandle?: string | null;
  };
  clientExtensionResults?: Record<string, unknown>;
};

type PasskeysModule = {
  isSupported(): boolean;
  create(options: Record<string, unknown>): Promise<PasskeyRegistrationResult | null>;
  get(options: Record<string, unknown>): Promise<PasskeyAssertionResult | null>;
};

function resolvePasskeysModule(): PasskeysModule | null {
  if (Platform.OS !== "ios" && Platform.OS !== "android") {
    return null;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("react-native-passkeys") as PasskeysModule;
  } catch {
    return null;
  }
}

export default function AuthScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ returnTo?: string | string[] }>();
  const { session, isAuthenticated, isHydrating, signOut, refreshSession } = useAuthSession();
  const [nonce, setNonce] = useState(`mobile-auth-${Date.now()}`);
  const [email, setEmail] = useState("owner@gazellecoffee.com");
  const [magicLinkToken, setMagicLinkToken] = useState("demo-magic-token");
  const [sessionActionMessage, setSessionActionMessage] = useState("");
  const [appleAvailable, setAppleAvailable] = useState(false);
  const [appleAvailabilityResolved, setAppleAvailabilityResolved] = useState(false);
  const [appleNativeStatus, setAppleNativeStatus] = useState("");
  const [passkeyAvailable, setPasskeyAvailable] = useState(false);
  const [passkeyAvailabilityResolved, setPasskeyAvailabilityResolved] = useState(false);
  const [passkeyUserId, setPasskeyUserId] = useState(defaultPasskeyUserId);
  const [passkeyActionStatus, setPasskeyActionStatus] = useState("");

  const appleExchange = useAppleExchangeMutation();
  const passkeyRegisterVerify = usePasskeyRegisterVerifyMutation();
  const passkeyAuthVerify = usePasskeyAuthVerifyMutation();
  const magicLinkRequest = useMagicLinkRequestMutation();
  const magicLinkVerify = useMagicLinkVerifyMutation();
  const meQuery = useMeQueryMutation();
  const returnTo = useMemo(() => resolveReturnToPath(params.returnTo), [params.returnTo]);
  const passkeys = useMemo(() => resolvePasskeysModule(), []);

  useEffect(() => {
    if (isAuthenticated && returnTo) {
      router.replace(returnTo);
    }
  }, [isAuthenticated, returnTo, router]);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const available = await AppleAuthentication.isAvailableAsync();
      if (cancelled) {
        return;
      }

      setAppleAvailable(available);
      setAppleAvailabilityResolved(true);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!passkeys) {
      setPasskeyAvailable(false);
      setPasskeyAvailabilityResolved(true);
      return;
    }

    try {
      setPasskeyAvailable(passkeys.isSupported());
    } catch {
      setPasskeyAvailable(false);
    } finally {
      setPasskeyAvailabilityResolved(true);
    }
  }, [passkeys]);

  const requestStatus = magicLinkRequest.isSuccess
    ? "Magic link requested successfully. Enter the token to verify session."
    : magicLinkRequest.error
      ? toErrorMessage(magicLinkRequest.error)
      : "";
  const verifyStatus = magicLinkVerify.isSuccess
    ? `Signed in as ${magicLinkVerify.data.userId}`
    : magicLinkVerify.error
      ? toErrorMessage(magicLinkVerify.error)
      : "";
  const appleStatus = appleExchange.isSuccess
    ? `Apple exchange completed for ${appleExchange.data.userId}`
    : appleExchange.error
      ? toErrorMessage(appleExchange.error)
      : appleNativeStatus;
  const passkeyStatus = passkeyRegisterVerify.isSuccess
    ? `Passkey registered and signed in as ${passkeyRegisterVerify.data.userId}`
    : passkeyRegisterVerify.error
      ? toErrorMessage(passkeyRegisterVerify.error)
      : passkeyAuthVerify.isSuccess
        ? `Passkey sign-in completed for ${passkeyAuthVerify.data.userId}`
        : passkeyAuthVerify.error
          ? toErrorMessage(passkeyAuthVerify.error)
          : passkeyActionStatus;
  const meStatus = meQuery.data
    ? `me: ${meQuery.data.email ?? "No email on file"} (${meQuery.data.methods.join(", ")})`
    : meQuery.error
      ? toErrorMessage(meQuery.error)
      : "";

  if (isHydrating) {
    return (
      <View className="flex-1 bg-background px-6 pt-20">
        <Text className="text-[34px] font-semibold text-foreground">Auth</Text>
        <Text className="mt-2 text-sm text-foreground/70">Restoring secure session...</Text>
      </View>
    );
  }

  async function handleRefreshSession() {
    setSessionActionMessage("Refreshing session...");
    const nextSession = await refreshSession();
    if (nextSession) {
      setSessionActionMessage(`Session refreshed. Expires ${formatExpiresAt(nextSession.expiresAt)}.`);
      return;
    }

    setSessionActionMessage("Session refresh failed. You have been signed out.");
  }

  async function handleSignOut() {
    setSessionActionMessage("Signing out...");
    await signOut();
    setSessionActionMessage("Signed out.");
  }

  async function handleNativeAppleSignIn() {
    if (appleExchange.isPending) {
      return;
    }

    if (!appleAvailabilityResolved) {
      setAppleNativeStatus("Checking Apple Sign-In availability...");
      return;
    }

    if (!appleAvailable) {
      setAppleNativeStatus("Apple Sign-In is unavailable on this device.");
      return;
    }

    const safeNonce = nonce.trim().length > 0 ? nonce.trim() : `mobile-auth-${Date.now()}`;
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
        setAppleNativeStatus("Apple Sign-In succeeded but no identity token or authorization code was returned.");
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

  function toPasskeyErrorMessage(error: unknown) {
    const value = error as { name?: string; code?: string; message?: string } | null;
    if (value?.name === "NotSupportedError") {
      return "Passkeys are not supported on this device.";
    }
    if (value?.name === "AbortError" || value?.name === "NotAllowedError" || value?.code === "ERR_REQUEST_CANCELED") {
      return "Passkey prompt canceled.";
    }

    return toErrorMessage(error);
  }

  async function handlePasskeyRegister() {
    if (passkeyRegisterVerify.isPending || passkeyAuthVerify.isPending) {
      return;
    }

    if (!passkeyAvailabilityResolved) {
      setPasskeyActionStatus("Checking passkey availability...");
      return;
    }

    if (!passkeyAvailable) {
      setPasskeyActionStatus("Passkeys are unavailable on this device/build.");
      return;
    }
    if (!passkeys) {
      setPasskeyActionStatus("Passkeys native module is unavailable in this build.");
      return;
    }

    const userId = passkeyUserId.trim().length > 0 ? passkeyUserId.trim() : defaultPasskeyUserId;
    setPasskeyActionStatus("Requesting passkey registration challenge...");

    try {
      const challenge = await apiClient.passkeyRegisterChallenge({ userId });
      const registration = await passkeys.create({
        challenge: challenge.challenge,
        rp: {
          id: challenge.rpId,
          name: defaultPasskeyRpName
        },
        user: {
          id: challenge.challenge,
          name: `${userId}@gazelle.local`,
          displayName: "Gazelle User"
        },
        pubKeyCredParams: [
          { alg: -7, type: "public-key" },
          { alg: -257, type: "public-key" }
        ],
        timeout: challenge.timeoutMs,
        attestation: "none",
        authenticatorSelection: {
          residentKey: "preferred",
          userVerification: "preferred"
        }
      });

      if (!registration) {
        setPasskeyActionStatus("Passkey registration canceled.");
        return;
      }

      setPasskeyActionStatus("Verifying passkey registration...");
      passkeyRegisterVerify.mutate({
        id: registration.id,
        rawId: registration.rawId,
        type: "public-key",
        authenticatorAttachment: registration.authenticatorAttachment ?? undefined,
        response: {
          clientDataJSON: registration.response.clientDataJSON,
          attestationObject: registration.response.attestationObject,
          transports: registration.response.transports
        },
        clientExtensionResults: registration.clientExtensionResults ?? {}
      });
    } catch (error) {
      setPasskeyActionStatus(toPasskeyErrorMessage(error));
    }
  }

  async function handlePasskeySignIn() {
    if (passkeyRegisterVerify.isPending || passkeyAuthVerify.isPending) {
      return;
    }

    if (!passkeyAvailabilityResolved) {
      setPasskeyActionStatus("Checking passkey availability...");
      return;
    }

    if (!passkeyAvailable) {
      setPasskeyActionStatus("Passkeys are unavailable on this device/build.");
      return;
    }
    if (!passkeys) {
      setPasskeyActionStatus("Passkeys native module is unavailable in this build.");
      return;
    }

    const userId = passkeyUserId.trim().length > 0 ? passkeyUserId.trim() : defaultPasskeyUserId;
    setPasskeyActionStatus("Requesting passkey sign-in challenge...");

    try {
      const challenge = await apiClient.passkeyAuthChallenge({ userId });
      const assertion = await passkeys.get({
        challenge: challenge.challenge,
        rpId: challenge.rpId,
        timeout: challenge.timeoutMs,
        userVerification: "preferred"
      });

      if (!assertion) {
        setPasskeyActionStatus("Passkey sign-in canceled.");
        return;
      }

      setPasskeyActionStatus("Verifying passkey sign-in...");
      passkeyAuthVerify.mutate({
        id: assertion.id,
        rawId: assertion.rawId,
        type: "public-key",
        authenticatorAttachment: assertion.authenticatorAttachment ?? undefined,
        response: {
          clientDataJSON: assertion.response.clientDataJSON,
          authenticatorData: assertion.response.authenticatorData,
          signature: assertion.response.signature,
          userHandle: assertion.response.userHandle ?? null
        },
        clientExtensionResults: assertion.clientExtensionResults ?? {}
      });
    } catch (error) {
      setPasskeyActionStatus(toPasskeyErrorMessage(error));
    }
  }

  return (
    <ScrollView className="flex-1 bg-background" contentContainerClassName="px-6 pb-12 pt-20">
      <Text className="text-[34px] font-semibold text-foreground">Auth</Text>
      <Text className="mt-2 text-sm text-foreground/70">
        Secure session lifecycle with sign-in, recovery, and explicit failure feedback.
      </Text>

      <View className="mt-6 rounded-2xl border border-foreground/15 bg-white px-5 py-4">
        <Text className="text-xs uppercase tracking-[1.5px] text-foreground/60">Session state</Text>
        {isAuthenticated && session ? (
          <>
            <Text className="mt-2 text-sm text-foreground">Signed in as {session.userId}</Text>
            <Text className="mt-1 text-xs text-foreground/70">Expires: {formatExpiresAt(session.expiresAt)}</Text>
          </>
        ) : (
          <Text className="mt-2 text-sm text-foreground/80">Not authenticated.</Text>
        )}
      </View>

      {!isAuthenticated ? (
        <>
          <Text className="mt-8 text-xs uppercase tracking-[1.5px] text-foreground/70">Apple sign-in (native)</Text>
          <TextInput
            value={nonce}
            onChangeText={setNonce}
            autoCapitalize="none"
            className="mt-2 rounded-xl border border-foreground/20 bg-white px-4 py-3 text-foreground"
            placeholder="Nonce (optional)"
          />
          <Text className="mt-2 text-xs text-foreground/70">
            Uses native Apple credential APIs; manual token input has been removed from this screen.
          </Text>

          <View className="mt-4">
            {appleAvailable ? (
              <AppleAuthentication.AppleAuthenticationButton
                buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
                buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
                cornerRadius={999}
                style={{ height: 52, width: "100%", opacity: appleExchange.isPending ? 0.6 : 1 }}
                onPress={() => {
                  void handleNativeAppleSignIn();
                }}
              />
            ) : (
              <Pressable className="rounded-full border border-foreground/30 px-6 py-4" disabled>
                <Text className="text-center text-xs font-semibold uppercase tracking-[2px] text-foreground/60">
                  Apple Sign-In Unavailable
                </Text>
              </Pressable>
            )}
          </View>
          {appleAvailabilityResolved && !appleAvailable ? (
            <Text className="mt-2 text-xs text-foreground/70">Apple Sign-In is available only on supported iOS devices.</Text>
          ) : null}

          {appleStatus ? <Text className="mt-2 text-xs text-foreground/70">{appleStatus}</Text> : null}

          <Text className="mt-8 text-xs uppercase tracking-[1.5px] text-foreground/70">Passkeys (native)</Text>
          <TextInput
            value={passkeyUserId}
            onChangeText={setPasskeyUserId}
            autoCapitalize="none"
            className="mt-2 rounded-xl border border-foreground/20 bg-white px-4 py-3 text-foreground"
            placeholder="User ID (uuid)"
          />
          <Text className="mt-2 text-xs text-foreground/70">
            Requires device support and a custom dev client build (Expo Go does not support passkeys).
          </Text>
          <View className="mt-4 flex-row gap-3">
            <Pressable
              className={`flex-1 rounded-full border px-4 py-4 ${passkeyRegisterVerify.isPending ? "border-foreground/40" : "border-foreground"}`}
              disabled={passkeyRegisterVerify.isPending}
              onPress={() => {
                void handlePasskeyRegister();
              }}
            >
              <Text className="text-center text-[11px] font-semibold uppercase tracking-[1.4px] text-foreground">
                {passkeyRegisterVerify.isPending ? "Registering..." : "Register Passkey"}
              </Text>
            </Pressable>
            <Pressable
              className={`flex-1 rounded-full border px-4 py-4 ${passkeyAuthVerify.isPending ? "border-foreground/40" : "border-foreground"}`}
              disabled={passkeyAuthVerify.isPending}
              onPress={() => {
                void handlePasskeySignIn();
              }}
            >
              <Text className="text-center text-[11px] font-semibold uppercase tracking-[1.4px] text-foreground">
                {passkeyAuthVerify.isPending ? "Signing In..." : "Sign In With Passkey"}
              </Text>
            </Pressable>
          </View>
          {passkeyAvailabilityResolved && !passkeyAvailable ? (
            <Text className="mt-2 text-xs text-foreground/70">
              Passkeys are unavailable here. Use a dev client on a real device with associated domains configured.
            </Text>
          ) : null}
          {passkeyStatus ? <Text className="mt-2 text-xs text-foreground/70">{passkeyStatus}</Text> : null}

          <Text className="mt-8 text-xs uppercase tracking-[1.5px] text-foreground/70">Magic link request</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            className="mt-2 rounded-xl border border-foreground/20 bg-white px-4 py-3 text-foreground"
            placeholder="Email"
          />
          <Pressable
            className={`mt-4 rounded-full border px-6 py-4 ${magicLinkRequest.isPending ? "border-foreground/40" : "border-foreground"}`}
            disabled={magicLinkRequest.isPending}
            onPress={() => {
              setSessionActionMessage("");
              magicLinkRequest.mutate({ email });
            }}
          >
            <Text className="text-center text-xs font-semibold uppercase tracking-[2px] text-foreground">
              {magicLinkRequest.isPending ? "Sending..." : "Send Magic Link"}
            </Text>
          </Pressable>
          {requestStatus ? <Text className="mt-2 text-xs text-foreground/70">{requestStatus}</Text> : null}

          <Text className="mt-8 text-xs uppercase tracking-[1.5px] text-foreground/70">Magic link verify</Text>
          <TextInput
            value={magicLinkToken}
            onChangeText={setMagicLinkToken}
            autoCapitalize="none"
            className="mt-2 rounded-xl border border-foreground/20 bg-white px-4 py-3 text-foreground"
            placeholder="Magic link token"
          />
          <Pressable
            className={`mt-4 rounded-full border px-6 py-4 ${magicLinkVerify.isPending ? "border-foreground/40" : "border-foreground"}`}
            disabled={magicLinkVerify.isPending}
            onPress={() => {
              setSessionActionMessage("");
              magicLinkVerify.mutate({ token: magicLinkToken });
            }}
          >
            <Text className="text-center text-xs font-semibold uppercase tracking-[2px] text-foreground">
              {magicLinkVerify.isPending ? "Verifying..." : "Verify Magic Link"}
            </Text>
          </Pressable>
          {verifyStatus ? <Text className="mt-2 text-xs text-foreground/70">{verifyStatus}</Text> : null}
        </>
      ) : null}

      <Text className="mt-8 text-xs uppercase tracking-[1.5px] text-foreground/70">Recovery and profile</Text>
      <Pressable
        className={`mt-2 rounded-full border px-6 py-4 ${!isAuthenticated ? "border-foreground/30" : "border-foreground"}`}
        disabled={!isAuthenticated}
        onPress={() => {
          void handleRefreshSession();
        }}
      >
        <Text className="text-center text-xs font-semibold uppercase tracking-[2px] text-foreground">Refresh Session</Text>
      </Pressable>

      <Pressable
        className={`mt-3 rounded-full border px-6 py-4 ${!isAuthenticated ? "border-foreground/30" : "border-foreground"}`}
        disabled={!isAuthenticated}
        onPress={() => {
          meQuery.mutate();
        }}
      >
        <Text className="text-center text-xs font-semibold uppercase tracking-[2px] text-foreground">Fetch /auth/me</Text>
      </Pressable>

      <Pressable
        className={`mt-3 rounded-full border px-6 py-4 ${!isAuthenticated ? "border-foreground/30" : "border-foreground"}`}
        disabled={!isAuthenticated}
        onPress={() => {
          void handleSignOut();
        }}
      >
        <Text className="text-center text-xs font-semibold uppercase tracking-[2px] text-foreground">Sign Out</Text>
      </Pressable>

      {sessionActionMessage ? <Text className="mt-2 text-xs text-foreground/70">{sessionActionMessage}</Text> : null}
      {meStatus ? <Text className="mt-2 text-xs text-foreground/70">{meStatus}</Text> : null}

      <Link href="/(tabs)/home" asChild>
        <Pressable className="mt-10 self-start">
          <Text className="text-sm text-foreground underline">Back to home</Text>
        </Pressable>
      </Link>
    </ScrollView>
  );
}
