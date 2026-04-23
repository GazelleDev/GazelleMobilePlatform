import {
  exchangeOperatorGoogleCode,
  fetchOperatorAuthProviders,
  resolveDefaultApiBaseUrl,
  signInOperatorWithPassword,
  startOperatorGoogleSignIn
} from "../api.js";
import { setError, state } from "../state.js";
import { persistApiBaseUrl } from "../storage.js";
import { applyVerifiedSession } from "../lifecycle.js";
import { render } from "../render.js";
import {
  clearGoogleCallbackParams,
  getGoogleCallbackRedirectUri,
  readGoogleCallbackParams
} from "../google-callback.js";

function isGoogleSignInConfigured() {
  return state.authProviders?.google.configured === true;
}

export async function loadAuthProviders() {
  const apiBaseUrl = state.authApiBaseUrl || resolveDefaultApiBaseUrl();
  try {
    state.authProviders = await fetchOperatorAuthProviders({ apiBaseUrl });
  } catch {
    state.authProviders = { google: { configured: false } };
  } finally {
    if (!state.session) {
      render();
    }
  }
}

export async function handlePasswordSignIn(form: HTMLFormElement) {
  const formData = new FormData(form);
  const apiBaseUrl = String(formData.get("apiBaseUrl") ?? resolveDefaultApiBaseUrl());
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email) {
    setError("A work email is required.");
    render();
    return;
  }
  if (!password) {
    setError("A password is required.");
    render();
    return;
  }

  try {
    state.signingIn = true;
    state.authApiBaseUrl = apiBaseUrl;
    state.authEmail = email;
    state.authPassword = password;
    persistApiBaseUrl(apiBaseUrl);
    setError(null);
    render();
    const session = await signInOperatorWithPassword({ apiBaseUrl, email, password });
    await applyVerifiedSession(session, `Signed in as ${session.operator.displayName}.`);
  } catch (error) {
    setError(error instanceof Error ? error.message : "Unable to sign in.");
  } finally {
    state.signingIn = false;
    render();
  }
}

export async function handleGoogleSignInStart() {
  if (!isGoogleSignInConfigured()) {
    setError("Google Sign-In is not configured for this environment.");
    render();
    return;
  }

  const apiBaseUrl = state.authApiBaseUrl || resolveDefaultApiBaseUrl();

  try {
    state.signingIn = true;
    state.authApiBaseUrl = apiBaseUrl;
    persistApiBaseUrl(apiBaseUrl);
    setError(null);
    render();

    const start = await startOperatorGoogleSignIn({
      apiBaseUrl,
      redirectUri: getGoogleCallbackRedirectUri()
    });

    if (typeof window !== "undefined") {
      window.location.assign(start.authorizeUrl);
      return;
    }
  } catch (error) {
    state.signingIn = false;
    setError(error instanceof Error ? error.message : "Unable to start Google sign-in.");
    render();
  }
}

export async function handleGoogleCallback() {
  const callback = readGoogleCallbackParams();
  if (!callback) {
    return false;
  }

  state.signingIn = true;
  setError(null);
  render();

  if (callback.error) {
    clearGoogleCallbackParams();
    state.signingIn = false;
    setError("Google sign-in was canceled or could not be completed.");
    render();
    return true;
  }

  if (!callback.code || !callback.state) {
    clearGoogleCallbackParams();
    state.signingIn = false;
    setError("Google sign-in returned incomplete callback data.");
    render();
    return true;
  }

  try {
    const session = await exchangeOperatorGoogleCode({
      apiBaseUrl: state.authApiBaseUrl || resolveDefaultApiBaseUrl(),
      code: callback.code,
      state: callback.state,
      redirectUri: callback.redirectUri
    });
    clearGoogleCallbackParams();
    state.signingIn = false;
    await applyVerifiedSession(session, `Signed in with Google as ${session.operator.displayName}.`);
  } catch (error) {
    clearGoogleCallbackParams();
    state.signingIn = false;
    setError(error instanceof Error ? error.message : "Unable to complete Google sign-in.");
    render();
  }

  return true;
}
