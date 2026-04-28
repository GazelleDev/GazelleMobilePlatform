import {
  buildPaymentReconcilerConfig,
  createPaymentReconcilerRuntime,
  startPaymentReconcilerWorker,
  type PaymentReconcilerRuntime
} from "./worker.js";

let runtime: PaymentReconcilerRuntime | undefined;
let workerHandle: { stop: () => void } | undefined;

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
  console.error("[payment-reconciler] fatal", error);
  process.exit(1);
}
