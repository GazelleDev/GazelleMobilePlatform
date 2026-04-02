import { describe, expect, it } from "vitest";
import { createInMemoryIdentityRepository } from "../src/repository.js";
import {
  parseOwnerProvisioningArgs,
  provisionOwnerAccess
} from "../src/provisioning.js";

describe("owner provisioning", () => {
  it("parses provisioning CLI arguments", () => {
    expect(
      parseOwnerProvisioningArgs([
        "--",
        "--display-name",
        "Avery Quinn",
        "--email",
        "avery@store.com",
        "--location-id",
        "flagship-01",
        "--dashboard-url=https://client.example.com"
      ])
    ).toEqual({
      allowInMemory: false,
      dashboardUrl: "https://client.example.com",
      displayName: "Avery Quinn",
      email: "avery@store.com",
      locationId: "flagship-01"
    });
  });

  it("creates a new owner with a generated temporary password", async () => {
    const repository = createInMemoryIdentityRepository();

    const result = await provisionOwnerAccess(repository, {
      allowInMemory: true,
      displayName: "Avery Quinn",
      email: "avery@store.com",
      locationId: "flagship-01"
    });

    expect(result.action).toBe("created");
    expect(result.operator.role).toBe("owner");
    expect(result.operator.locationId).toBe("flagship-01");
    expect(result.temporaryPassword.length).toBeGreaterThanOrEqual(8);
    await expect(repository.verifyOperatorPassword("avery@store.com", result.temporaryPassword)).resolves.toMatchObject({
      email: "avery@store.com",
      role: "owner"
    });

    await repository.close();
  });

  it("updates an existing user into owner access and rotates the password", async () => {
    const repository = createInMemoryIdentityRepository();

    const initial = await provisionOwnerAccess(repository, {
      allowInMemory: true,
      displayName: "Jordan Staff",
      email: "jordan@store.com",
      locationId: "old-location",
      password: "InitialPassword123!"
    });

    const reprovisioned = await provisionOwnerAccess(repository, {
      allowInMemory: true,
      displayName: "Jordan Owner",
      email: "jordan@store.com",
      locationId: "flagship-01",
      password: "ResetPassword456!"
    });

    expect(initial.action).toBe("created");
    expect(reprovisioned.action).toBe("updated");
    expect(reprovisioned.operator.displayName).toBe("Jordan Owner");
    expect(reprovisioned.operator.locationId).toBe("flagship-01");
    expect(reprovisioned.operator.role).toBe("owner");
    await expect(repository.verifyOperatorPassword("jordan@store.com", "InitialPassword123!")).resolves.toBeUndefined();
    await expect(repository.verifyOperatorPassword("jordan@store.com", "ResetPassword456!")).resolves.toMatchObject({
      email: "jordan@store.com",
      role: "owner"
    });

    await repository.close();
  });
});
