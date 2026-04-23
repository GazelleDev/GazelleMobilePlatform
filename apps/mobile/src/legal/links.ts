import Constants from "expo-constants";

const DEFAULT_PRIVACY_POLICY_URL = "https://nomly.us/privacy-policy";

function readExpoExtraValue(key: "privacyPolicyUrl") {
  const extra = Constants.expoConfig?.extra as Record<string, unknown> | undefined;
  const value = extra?.[key];
  return typeof value === "string" ? value.trim() : "";
}

export function resolvePrivacyPolicyUrl() {
  const value =
    process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL?.trim() ??
    readExpoExtraValue("privacyPolicyUrl") ??
    DEFAULT_PRIVACY_POLICY_URL;
  return value && value.length > 0 ? value : undefined;
}
