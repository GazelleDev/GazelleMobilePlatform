import "./styles.css";
import "./sentry.js";
import { state } from "./state.js";
import { render } from "./render.js";
import { registerEvents } from "./events.js";
import { handleGoogleCallback, loadAuthProviders } from "./controllers/auth.js";
import { loadDashboard } from "./lifecycle.js";

async function bootstrap() {
  registerEvents();
  render();

  state.initializing = false;
  void loadAuthProviders();

  const handledGoogleCallback = await handleGoogleCallback();
  if (handledGoogleCallback) {
    return;
  }

  if (state.session) {
    await loadDashboard();
    return;
  }

  render();
}

void bootstrap();
