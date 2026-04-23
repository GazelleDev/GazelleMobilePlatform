export function getGoogleCallbackRedirectUri() {
  if (typeof window === "undefined") {
    return "http://127.0.0.1/?google_auth_callback=1";
  }
  const url = new URL(window.location.href);
  url.pathname = "/";
  url.hash = "";
  url.search = "";
  url.searchParams.set("google_auth_callback", "1");
  return url.toString();
}

export function readGoogleCallbackParams() {
  if (typeof window === "undefined") {
    return null;
  }
  const url = new URL(window.location.href);
  if (url.searchParams.get("google_auth_callback") !== "1") {
    return null;
  }
  const code = url.searchParams.get("code");
  const stateValue = url.searchParams.get("state");
  const error = url.searchParams.get("error");
  return {
    redirectUri: getGoogleCallbackRedirectUri(),
    code: code?.trim() || undefined,
    state: stateValue?.trim() || undefined,
    error: error?.trim() || undefined
  };
}

export function clearGoogleCallbackParams() {
  if (typeof window === "undefined") {
    return;
  }
  const url = new URL(window.location.href);
  url.searchParams.delete("google_auth_callback");
  url.searchParams.delete("code");
  url.searchParams.delete("state");
  url.searchParams.delete("scope");
  url.searchParams.delete("authuser");
  url.searchParams.delete("prompt");
  url.searchParams.delete("error");
  url.searchParams.delete("error_subtype");
  const nextPath = `${url.pathname}${url.search}${url.hash}`;
  window.history.replaceState({}, document.title, nextPath);
}
