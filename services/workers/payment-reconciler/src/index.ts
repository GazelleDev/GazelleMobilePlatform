import {
  captureOperationalError,
  initializeSentry
} from "@lattelink/observability";
import {
  buildPaymentReconcilerConfig,
  createPaymentReconcilerRuntime,
  startPaymentReconcilerWorker,
  type PaymentReconcilerRuntime
} from "./worker.js";

let runtime: PaymentReconcilerRuntime | undefined;
let workerHandle: { stop: () => void } | undefined;

initializeSentry({ service: "payment-reconciler" });

async function shutdown(signal: NodeJS.Signals) {
  console.info(`[payment-reconciler] received ${signal}; stopping worker loop`);
  workerHandle?.stop();
  await runtime?.close?.();
}

try {
  const config = buildPaymentReconcilerConfig();
  if (!config.enabled) {
    console.info("[payment-reconciler] disabled by PAYMENT_RECONCILER_ENABLED=false");
  } else {
    runtime = await createPaymentReconcilerRuntime(config);
    workerHandle = startPaymentReconcilerWorker(config, runtime);
  }

  process.once("SIGINT", () => {
    void shutdown("SIGINT");
  });
  process.once("SIGTERM", () => {
    void shutdown("SIGTERM");
  });
} catch (error) {
  captureOperationalError({
    service: "payment-reconciler",
    event: "worker.fatal",
    error,
    fingerprint: ["payment-reconciler", "fatal"]
  });
  console.error("[payment-reconciler] fatal", error);
  process.exit(1);
}
