import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  appendDeadLetterRecord,
  buildMenuSyncConfig,
  startMenuSyncLoop,
  syncMenuWithRetry,
  type MenuSyncConfig,
  type MenuSyncRuntime
} from "../src/worker.js";

const validMenuPayload = {
  menu: {
    categories: [
      {
        id: "coffee",
        title: "Coffee",
        items: [
          {
            id: "latte",
            name: "Latte",
            description: "Espresso with steamed milk.",
            priceCents: 575,
            badgeCodes: ["popular"],
            visible: true
          }
        ]
      }
    ]
  }
};

const baseConfig: MenuSyncConfig = {
  enabled: true,
  sourceUrl: "https://webapp.gazellecoffee.com/api/content/public",
  catalogBaseUrl: "http://127.0.0.1:3002",
  gatewayApiToken: "test-gateway-token",
  intervalMs: 5_000,
  maxRetries: 2,
  retryDelayMs: 50,
  locationId: "rawaqcoffee01",
  deadLetterPath: "./dead-letter/menu-sync.jsonl"
};

function buildRuntime(overrides: Partial<MenuSyncRuntime> = {}): MenuSyncRuntime {
  return {
    fetchMenu: async () => ({
      ok: true,
      status: 200,
      json: async () => validMenuPayload
    }),
    persistMenu: async () => undefined,
    writeDeadLetter: async () => undefined,
    sleep: async () => undefined,
    now: () => new Date("2026-03-10T00:00:00.000Z"),
    logger: {
      info: () => undefined,
      warn: () => undefined,
      error: () => undefined
    },
    setTimeoutFn: (callback, delayMs) => setTimeout(callback, delayMs),
    clearTimeoutFn: (handle) => clearTimeout(handle),
    ...overrides
  };
}

describe("menu-sync worker", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("disables itself when no source url is configured", () => {
    const config = buildMenuSyncConfig({
      GATEWAY_INTERNAL_API_TOKEN: "test-gateway-token"
    } as NodeJS.ProcessEnv);

    expect(config.enabled).toBe(false);
    expect(config.sourceUrl).toBe("");
    expect(config.catalogBaseUrl).toBe("http://127.0.0.1:3002");
    expect(config.gatewayApiToken).toBe("test-gateway-token");
    expect(config.intervalMs).toBe(300000);
    expect(config.maxRetries).toBe(3);
    expect(config.retryDelayMs).toBe(2000);
    expect(config.locationId).toBe("rawaqcoffee01");
  });

  it("builds enabled config when a source url is provided", () => {
    const config = buildMenuSyncConfig({
      GATEWAY_INTERNAL_API_TOKEN: "test-gateway-token",
      WEBAPP_MENU_SOURCE_URL: "https://webapp.gazellecoffee.com/api/content/public"
    } as NodeJS.ProcessEnv);

    expect(config.enabled).toBe(true);
    expect(config.sourceUrl).toBe("https://webapp.gazellecoffee.com/api/content/public");
    expect(config.catalogBaseUrl).toBe("http://127.0.0.1:3002");
    expect(config.gatewayApiToken).toBe("test-gateway-token");
    expect(config.intervalMs).toBe(300000);
    expect(config.maxRetries).toBe(3);
    expect(config.retryDelayMs).toBe(2000);
    expect(config.locationId).toBe("rawaqcoffee01");
  });

  it("retries failed sync once and then succeeds", async () => {
    const fetchMenu = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
        json: async () => ({})
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => validMenuPayload
      });
    const sleep = vi.fn(async () => undefined);
    const writeDeadLetter = vi.fn(async () => undefined);
    const persistMenu = vi.fn(async () => undefined);

    const result = await syncMenuWithRetry(
      baseConfig,
      buildRuntime({
        fetchMenu,
        sleep,
        writeDeadLetter,
        persistMenu
      })
    );

    expect(result.attempts).toBe(2);
    expect(result.categoryCount).toBe(1);
    expect(result.itemCount).toBe(1);
    expect(sleep).toHaveBeenCalledTimes(1);
    expect(sleep).toHaveBeenCalledWith(50);
    expect(writeDeadLetter).not.toHaveBeenCalled();
    expect(persistMenu).toHaveBeenCalledTimes(1);
  });

  it("writes a dead-letter record after retry exhaustion", async () => {
    const sleep = vi.fn(async () => undefined);
    const writeDeadLetter = vi.fn(async () => undefined);

    await expect(
      syncMenuWithRetry(
        { ...baseConfig, maxRetries: 2, retryDelayMs: 25 },
        buildRuntime({
          fetchMenu: vi.fn(async () => {
            throw new Error("network timeout");
          }),
          sleep,
          writeDeadLetter
        })
      )
    ).rejects.toThrow("network timeout");

    expect(sleep.mock.calls.map(([delay]) => delay)).toEqual([25, 50]);
    expect(writeDeadLetter).toHaveBeenCalledTimes(1);
    expect(writeDeadLetter.mock.calls[0]?.[0]).toMatchObject({
      attempts: 3,
      sourceUrl: baseConfig.sourceUrl,
      locationId: "rawaqcoffee01"
    });
  });

  it("runs loop immediately, reschedules, and stops cleanly", async () => {
    vi.useFakeTimers();
    const runCycle = vi.fn(async () => undefined);
    const handle = startMenuSyncLoop({
      intervalMs: 1000,
      runCycle
    });

    await Promise.resolve();
    expect(runCycle).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1000);
    expect(runCycle).toHaveBeenCalledTimes(2);

    handle.stop();
    await vi.advanceTimersByTimeAsync(5000);
    expect(runCycle).toHaveBeenCalledTimes(2);
  });

  it("appends dead-letter record jsonl entries", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "menu-sync-"));
    const deadLetterPath = join(tempDir, "dead-letter", "menu-sync.jsonl");

    await appendDeadLetterRecord(deadLetterPath, {
      occurredAt: "2026-03-10T00:00:00.000Z",
      sourceUrl: baseConfig.sourceUrl,
      locationId: "rawaqcoffee01",
      attempts: 3,
      error: "network timeout"
    });

    const content = await readFile(deadLetterPath, "utf8");
    const parsed = JSON.parse(content.trim()) as { error: string; attempts: number };

    expect(parsed.error).toBe("network timeout");
    expect(parsed.attempts).toBe(3);
  });
});
