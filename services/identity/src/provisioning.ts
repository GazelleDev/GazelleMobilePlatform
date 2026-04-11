import { randomBytes } from "node:crypto";
import { z } from "zod";
import type { IdentityRepository, OperatorUserRecord } from "./repository.js";

const ownerProvisioningArgsSchema = z.object({
  displayName: z.string().trim().min(1),
  email: z.string().trim().email(),
  locationId: z.string().trim().min(1),
  password: z.string().min(8).optional(),
  dashboardUrl: z.string().trim().url().optional(),
  allowInMemory: z.boolean().default(false)
});

export type OwnerProvisioningArgs = z.output<typeof ownerProvisioningArgsSchema>;

export type OwnerProvisioningResult = {
  operator: OperatorUserRecord;
  temporaryPassword: string;
  action: "created" | "updated";
};

function readOptionValue(args: readonly string[], index: number, flag: string) {
  const current = args[index];
  const equalsIndex = current.indexOf("=");
  if (equalsIndex >= 0) {
    return {
      value: current.slice(equalsIndex + 1),
      nextIndex: index
    };
  }

  const nextValue = args[index + 1];
  if (!nextValue || nextValue.startsWith("--")) {
    throw new Error(`Missing value for ${flag}`);
  }

  return {
    value: nextValue,
    nextIndex: index + 1
  };
}

export function parseOwnerProvisioningArgs(args: readonly string[]) {
  const collected: Record<string, unknown> = {};

  for (let index = 0; index < args.length; index += 1) {
    const token = args[index];
    if (token === "--") {
      continue;
    }

    if (!token.startsWith("--")) {
      throw new Error(`Unexpected argument: ${token}`);
    }

    const [flag] = token.split("=", 1);
    if (flag === "--allow-in-memory") {
      collected.allowInMemory = true;
      continue;
    }

    const { value, nextIndex } = readOptionValue(args, index, flag);
    index = nextIndex;

    switch (flag) {
      case "--display-name":
        collected.displayName = value;
        break;
      case "--email":
        collected.email = value;
        break;
      case "--location-id":
        collected.locationId = value;
        break;
      case "--password":
        collected.password = value;
        break;
      case "--dashboard-url":
        collected.dashboardUrl = value;
        break;
      default:
        throw new Error(`Unknown flag: ${flag}`);
    }
  }

  return ownerProvisioningArgsSchema.parse(collected);
}

export function generateTemporaryOwnerPassword() {
  return randomBytes(18).toString("base64url");
}

export async function provisionOwnerAccess(
  repository: IdentityRepository,
  input: OwnerProvisioningArgs
): Promise<OwnerProvisioningResult> {
  const displayName = input.displayName.trim();
  const email = input.email.trim();
  const locationId = input.locationId.trim();
  const temporaryPassword = input.password?.trim() || generateTemporaryOwnerPassword();
  const existingOwner = (await repository.listOperatorUsers(locationId)).find((operator) => operator.role === "owner");

  if (existingOwner && existingOwner.email !== email) {
    const updatedOwner =
      (await repository.updateOperatorUser(existingOwner.operatorUserId, {
        displayName,
        email,
        role: "owner",
        active: true,
        password: temporaryPassword
      })) ??
      (await repository.createOperatorUser({
        displayName,
        email,
        role: "owner",
        locationId,
        password: temporaryPassword
      }));

    return {
      operator: updatedOwner,
      temporaryPassword,
      action: "updated"
    };
  }

  const existing = await repository.getOperatorUserByEmail(email);
  const provisioned = await repository.createOperatorUser({
    displayName,
    email,
    role: "owner",
    locationId,
    password: temporaryPassword
  });
  const operator =
    existing === undefined
      ? provisioned
      : ((await repository.updateOperatorUser(existing.operatorUserId, {
          displayName,
          role: "owner",
          active: true,
          password: temporaryPassword
        })) ??
          provisioned);

  return {
    operator,
    temporaryPassword,
    action: existing ? "updated" : "created"
  };
}
