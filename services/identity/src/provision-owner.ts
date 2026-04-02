import type { FastifyBaseLogger } from "fastify";
import { createIdentityRepository } from "./repository.js";
import { parseOwnerProvisioningArgs, provisionOwnerAccess } from "./provisioning.js";

const logger = {
  info() {},
  warn() {},
  error() {}
} as unknown as FastifyBaseLogger;

async function main() {
  const parsed = parseOwnerProvisioningArgs(process.argv.slice(2));

  if (parsed.allowInMemory) {
    process.env.ALLOW_IN_MEMORY_PERSISTENCE = "1";
  }

  const repository = await createIdentityRepository(logger);

  try {
    if (repository.backend !== "postgres" && !parsed.allowInMemory) {
      throw new Error("Owner provisioning requires a real DATABASE_URL. Pass --allow-in-memory only for local testing.");
    }

    const result = await provisionOwnerAccess(repository, parsed);

    const lines = [
      "Client dashboard owner access provisioned.",
      `Action: ${result.action}`,
      `Store location ID: ${result.operator.locationId}`,
      `Owner name: ${result.operator.displayName}`,
      `Owner email: ${result.operator.email}`,
      `Role: ${result.operator.role}`,
      `Temporary password: ${result.temporaryPassword}`
    ];

    if (parsed.dashboardUrl) {
      lines.push(`Dashboard URL: ${parsed.dashboardUrl}`);
    }

    lines.push(
      "",
      "Next steps:",
      "1. Send the dashboard URL, email, and temporary password to the store owner via a secure channel.",
      "2. Ask the owner to sign in and rotate their own password from the Team tab after first access.",
      "3. If Google SSO is enabled later, the same provisioned email can be linked on first sign-in."
    );

    console.log(lines.join("\n"));
  } finally {
    await repository.close();
  }
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Owner provisioning failed.");
  process.exitCode = 1;
});
