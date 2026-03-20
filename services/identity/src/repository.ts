import { randomUUID } from "node:crypto";
import type { FastifyBaseLogger } from "fastify";
import { authSessionSchema } from "@gazelle/contracts-core";
import { createPostgresDb, ensurePersistenceTables, getDatabaseUrl } from "@gazelle/persistence";
import { z } from "zod";

type AuthSession = z.output<typeof authSessionSchema>;

type PersistedSessionRow = {
  access_token: string;
  refresh_token: string;
  user_id: string;
  access_expires_at: string | Date | null;
  expires_at: string | Date;
  revoked_at: string | Date | null;
};

type StoredSession = AuthSession & {
  refreshExpiresAt: string;
};

type PersistedPasskeyChallengeRow = {
  challenge: string;
  flow: "register" | "auth";
  user_id: string | null;
  rp_id: string;
  timeout_ms: number;
  expires_at: string | Date;
  consumed_at: string | Date | null;
};

type PersistedPasskeyCredentialRow = {
  credential_id: string;
  user_id: string;
  webauthn_user_id: string;
  public_key: string;
  counter: number;
  transports_json: unknown;
  device_type: "singleDevice" | "multiDevice";
  backed_up: boolean;
};

type PersistedMagicLinkRow = {
  token: string;
  email: string;
  user_id: string | null;
  expires_at: string | Date;
  consumed_at: string | Date | null;
};

export type PasskeyChallengeRecord = {
  challenge: string;
  flow: "register" | "auth";
  userId?: string;
  rpId: string;
  timeoutMs: number;
  expiresAt: string;
  consumedAt?: string;
};

export type PasskeyCredentialRecord = {
  credentialId: string;
  userId: string;
  webauthnUserId: string;
  publicKey: string;
  counter: number;
  transports: string[];
  deviceType: "singleDevice" | "multiDevice";
  backedUp: boolean;
};

export type IdentityUserRecord = {
  userId: string;
  appleSub?: string;
  email?: string;
};

export type MagicLinkRecord = {
  token: string;
  email: string;
  userId: string | null;
  expiresAt: string;
  consumedAt: string | null;
};

export type IdentityRepository = {
  backend: "memory" | "postgres";
  saveSession(
    session: StoredSession,
    authMethod: "apple" | "passkey-register" | "passkey-auth" | "magic-link" | "refresh"
  ): Promise<void>;
  findOrCreateUserByAppleSub(appleSub: string, email?: string): Promise<string>;
  findOrCreateUserByEmail(email: string): Promise<string>;
  rotateRefreshSession(
    refreshToken: string,
    createNextSession: (userId: string) => StoredSession,
    authMethod: "refresh"
  ): Promise<AuthSession | undefined>;
  getSessionByAccessToken(accessToken: string): Promise<AuthSession | undefined>;
  getSessionByRefreshToken(refreshToken: string): Promise<AuthSession | undefined>;
  revokeByRefreshToken(refreshToken: string): Promise<void>;
  savePasskeyChallenge(input: PasskeyChallengeRecord): Promise<void>;
  getPasskeyChallenge(flow: "register" | "auth", challenge: string): Promise<PasskeyChallengeRecord | undefined>;
  markPasskeyChallengeConsumed(challenge: string): Promise<void>;
  listPasskeyCredentialsForUser(userId: string): Promise<PasskeyCredentialRecord[]>;
  getPasskeyCredential(credentialId: string): Promise<PasskeyCredentialRecord | undefined>;
  savePasskeyCredential(input: PasskeyCredentialRecord): Promise<void>;
  updatePasskeyCredentialCounter(credentialId: string, counter: number): Promise<void>;
  saveMagicLink(input: { token: string; email: string; expiresAt: string }): Promise<void>;
  getMagicLink(token: string): Promise<MagicLinkRecord | undefined>;
  consumeMagicLink(token: string, userId: string): Promise<void>;
  close(): Promise<void>;
};

function parseIsoDate(value: unknown) {
  if (value instanceof Date) {
    return value.toISOString();
  }

  return new Date(String(value)).toISOString();
}

function isAccessSessionActive(session: AuthSession, revokedAt: string | undefined) {
  if (revokedAt) {
    return false;
  }

  return Date.parse(session.expiresAt) > Date.now();
}

function isRefreshSessionActive(refreshExpiresAt: string, revokedAt: string | undefined) {
  if (revokedAt) {
    return false;
  }

  return Date.parse(refreshExpiresAt) > Date.now();
}

function toPublicSession(session: StoredSession): AuthSession {
  return authSessionSchema.parse(session);
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function toPasskeyChallengeRecord(row: PersistedPasskeyChallengeRow): PasskeyChallengeRecord {
  return {
    challenge: row.challenge,
    flow: row.flow,
    userId: row.user_id ?? undefined,
    rpId: row.rp_id,
    timeoutMs: row.timeout_ms,
    expiresAt: parseIsoDate(row.expires_at),
    consumedAt: row.consumed_at ? parseIsoDate(row.consumed_at) : undefined
  };
}

function toPasskeyCredentialRecord(row: PersistedPasskeyCredentialRow): PasskeyCredentialRecord {
  const transportsValue =
    typeof row.transports_json === "string" ? JSON.parse(row.transports_json) : row.transports_json;

  return {
    credentialId: row.credential_id,
    userId: row.user_id,
    webauthnUserId: row.webauthn_user_id,
    publicKey: row.public_key,
    counter: row.counter,
    transports: z.array(z.string()).parse(transportsValue),
    deviceType: row.device_type,
    backedUp: row.backed_up
  };
}

function toMagicLinkRecord(row: PersistedMagicLinkRow): MagicLinkRecord {
  return {
    token: row.token,
    email: row.email,
    userId: row.user_id ?? null,
    expiresAt: parseIsoDate(row.expires_at),
    consumedAt: row.consumed_at ? parseIsoDate(row.consumed_at) : null
  };
}

export function createInMemoryIdentityRepository(): IdentityRepository {
  const sessionsByAccessToken = new Map<string, { session: StoredSession; revokedAt?: string }>();
  const accessTokenByRefreshToken = new Map<string, string>();
  const passkeyChallengesByFlow = new Map<"register" | "auth", PasskeyChallengeRecord[]>();
  const passkeyCredentialsById = new Map<string, PasskeyCredentialRecord>();
  const usersById = new Map<string, IdentityUserRecord>();
  const userIdByAppleSub = new Map<string, string>();
  const userIdByEmail = new Map<string, string>();
  const magicLinksByToken = new Map<string, MagicLinkRecord>();

  return {
    backend: "memory",
    async saveSession(session) {
      sessionsByAccessToken.set(session.accessToken, { session });
      accessTokenByRefreshToken.set(session.refreshToken, session.accessToken);
    },
    async findOrCreateUserByAppleSub(appleSub, email) {
      const normalizedEmail = email ? normalizeEmail(email) : undefined;
      const existingUserId =
        userIdByAppleSub.get(appleSub) ?? (normalizedEmail ? userIdByEmail.get(normalizedEmail) : undefined);
      const userId = existingUserId ?? randomUUID();
      const existingUser = usersById.get(userId);

      usersById.set(userId, {
        userId,
        appleSub,
        email: normalizedEmail ?? existingUser?.email
      });
      userIdByAppleSub.set(appleSub, userId);
      if (normalizedEmail) {
        userIdByEmail.set(normalizedEmail, userId);
      }

      return userId;
    },
    async findOrCreateUserByEmail(email) {
      const normalizedEmail = normalizeEmail(email);
      const existingUserId = userIdByEmail.get(normalizedEmail);
      if (existingUserId) {
        const existingUser = usersById.get(existingUserId);
        usersById.set(existingUserId, {
          userId: existingUserId,
          appleSub: existingUser?.appleSub,
          email: normalizedEmail
        });
        return existingUserId;
      }

      const userId = randomUUID();
      usersById.set(userId, {
        userId,
        email: normalizedEmail
      });
      userIdByEmail.set(normalizedEmail, userId);
      return userId;
    },
    async rotateRefreshSession(refreshToken, createNextSession) {
      const accessToken = accessTokenByRefreshToken.get(refreshToken);
      if (!accessToken) {
        return undefined;
      }

      const entry = sessionsByAccessToken.get(accessToken);
      if (!entry || !isRefreshSessionActive(entry.session.refreshExpiresAt, entry.revokedAt)) {
        return undefined;
      }

      sessionsByAccessToken.set(accessToken, {
        ...entry,
        revokedAt: new Date().toISOString()
      });
      accessTokenByRefreshToken.delete(refreshToken);

      const nextSession = createNextSession(entry.session.userId);
      sessionsByAccessToken.set(nextSession.accessToken, { session: nextSession });
      accessTokenByRefreshToken.set(nextSession.refreshToken, nextSession.accessToken);
      return toPublicSession(nextSession);
    },
    async getSessionByAccessToken(accessToken) {
      const entry = sessionsByAccessToken.get(accessToken);
      if (!entry || !isAccessSessionActive(entry.session, entry.revokedAt)) {
        return undefined;
      }
      return entry.session;
    },
    async getSessionByRefreshToken(refreshToken) {
      const accessToken = accessTokenByRefreshToken.get(refreshToken);
      if (!accessToken) {
        return undefined;
      }

      const entry = sessionsByAccessToken.get(accessToken);
      if (!entry || !isRefreshSessionActive(entry.session.refreshExpiresAt, entry.revokedAt)) {
        return undefined;
      }
      return entry.session;
    },
    async revokeByRefreshToken(refreshToken) {
      const accessToken = accessTokenByRefreshToken.get(refreshToken);
      if (!accessToken) {
        return;
      }

      const entry = sessionsByAccessToken.get(accessToken);
      if (!entry) {
        return;
      }

      sessionsByAccessToken.set(accessToken, {
        ...entry,
        revokedAt: new Date().toISOString()
      });
      accessTokenByRefreshToken.delete(refreshToken);
    },
    async savePasskeyChallenge(input) {
      const existing = passkeyChallengesByFlow.get(input.flow) ?? [];
      existing.push(input);
      passkeyChallengesByFlow.set(input.flow, existing);
    },
    async getPasskeyChallenge(flow, challenge) {
      const entries = passkeyChallengesByFlow.get(flow) ?? [];
      const activeMatch = entries.find(
        (entry) =>
          entry.challenge === challenge && Date.parse(entry.expiresAt) > Date.now() && entry.consumedAt === undefined
      );
      return activeMatch;
    },
    async markPasskeyChallengeConsumed(challenge) {
      for (const [flow, entries] of passkeyChallengesByFlow.entries()) {
        const updated = entries.map((entry) =>
          entry.challenge === challenge
            ? {
                ...entry,
                consumedAt: new Date().toISOString()
              }
            : entry
        );
        passkeyChallengesByFlow.set(flow, updated);
      }
    },
    async listPasskeyCredentialsForUser(userId) {
      return Array.from(passkeyCredentialsById.values()).filter((credential) => credential.userId === userId);
    },
    async getPasskeyCredential(credentialId) {
      return passkeyCredentialsById.get(credentialId);
    },
    async savePasskeyCredential(input) {
      passkeyCredentialsById.set(input.credentialId, input);
    },
    async updatePasskeyCredentialCounter(credentialId, counter) {
      const existing = passkeyCredentialsById.get(credentialId);
      if (!existing) {
        return;
      }

      passkeyCredentialsById.set(credentialId, {
        ...existing,
        counter
      });
    },
    async saveMagicLink(input) {
      magicLinksByToken.set(input.token, {
        token: input.token,
        email: normalizeEmail(input.email),
        userId: null,
        expiresAt: input.expiresAt,
        consumedAt: null
      });
    },
    async getMagicLink(token) {
      const record = magicLinksByToken.get(token);
      return record ? { ...record } : undefined;
    },
    async consumeMagicLink(token, userId) {
      const record = magicLinksByToken.get(token);
      if (!record) {
        return;
      }

      magicLinksByToken.set(token, {
        ...record,
        userId,
        consumedAt: new Date().toISOString()
      });
    },
    async close() {
      // no-op
    }
  };
}

async function createPostgresRepository(connectionString: string): Promise<IdentityRepository> {
  const db = createPostgresDb(connectionString);
  await ensurePersistenceTables(db);

  return {
    backend: "postgres",
    async saveSession(session, authMethod) {
      try {
        await db
          .insertInto("identity_sessions")
          .values({
            access_token: session.accessToken,
            refresh_token: session.refreshToken,
            user_id: session.userId,
            access_expires_at: session.expiresAt,
            expires_at: session.refreshExpiresAt,
            revoked_at: null,
            auth_method: authMethod
          } as never)
          .execute();
        return;
      } catch {
        await db
          .updateTable("identity_sessions")
          .set({
            refresh_token: session.refreshToken,
            user_id: session.userId,
            access_expires_at: session.expiresAt,
            expires_at: session.refreshExpiresAt,
            revoked_at: null,
            auth_method: authMethod,
            updated_at: new Date().toISOString()
          } as never)
          .where("access_token", "=", session.accessToken)
          .execute();
      }
    },
    async findOrCreateUserByAppleSub(appleSub, email) {
      const normalizedEmail = email ? normalizeEmail(email) : undefined;
      const now = new Date().toISOString();

      return db.transaction().execute(async (trx) => {
        const existingAppleRow = await trx
          .selectFrom("identity_users")
          .select(["user_id", "email"])
          .where("apple_sub", "=", appleSub)
          .executeTakeFirst();

        if (existingAppleRow) {
          if (normalizedEmail) {
            const existingEmailRow = await trx
              .selectFrom("identity_users")
              .select(["user_id"])
              .where("email", "=", normalizedEmail)
              .executeTakeFirst();

            if (!existingEmailRow || existingEmailRow.user_id === existingAppleRow.user_id) {
              await trx
                .updateTable("identity_users")
                .set({
                  email: normalizedEmail,
                  updated_at: now
                })
                .where("user_id", "=", existingAppleRow.user_id)
                .execute();
            }
          } else {
            await trx
              .updateTable("identity_users")
              .set({
                updated_at: now
              })
              .where("user_id", "=", existingAppleRow.user_id)
              .execute();
          }

          return existingAppleRow.user_id;
        }

        if (normalizedEmail) {
          const existingEmailRow = await trx
            .selectFrom("identity_users")
            .select(["user_id"])
            .where("email", "=", normalizedEmail)
            .executeTakeFirst();

          if (existingEmailRow) {
            await trx
              .updateTable("identity_users")
              .set({
                apple_sub: appleSub,
                updated_at: now
              })
              .where("user_id", "=", existingEmailRow.user_id)
              .execute();

            return existingEmailRow.user_id;
          }
        }

        const userId = randomUUID();

        try {
          await trx
            .insertInto("identity_users")
            .values({
              user_id: userId,
              apple_sub: appleSub,
              email: normalizedEmail ?? null
            })
            .execute();
          return userId;
        } catch {
          const concurrentAppleRow = await trx
            .selectFrom("identity_users")
            .select(["user_id"])
            .where("apple_sub", "=", appleSub)
            .executeTakeFirst();

          if (concurrentAppleRow) {
            return concurrentAppleRow.user_id;
          }

          if (normalizedEmail) {
            const concurrentEmailRow = await trx
              .selectFrom("identity_users")
              .select(["user_id"])
              .where("email", "=", normalizedEmail)
              .executeTakeFirst();

            if (concurrentEmailRow) {
              await trx
                .updateTable("identity_users")
                .set({
                  apple_sub: appleSub,
                  updated_at: now
                })
                .where("user_id", "=", concurrentEmailRow.user_id)
                .execute();

              return concurrentEmailRow.user_id;
            }
          }

          throw new Error("Failed to resolve identity user for Apple Sign-In");
        }
      });
    },
    async findOrCreateUserByEmail(email) {
      const normalizedEmail = normalizeEmail(email);
      const now = new Date().toISOString();

      return db.transaction().execute(async (trx) => {
        const existingRow = await trx
          .selectFrom("identity_users")
          .select(["user_id"])
          .where("email", "=", normalizedEmail)
          .executeTakeFirst();

        if (existingRow) {
          await trx
            .updateTable("identity_users")
            .set({
              updated_at: now
            })
            .where("user_id", "=", existingRow.user_id)
            .execute();

          return existingRow.user_id;
        }

        const userId = randomUUID();

        try {
          await trx
            .insertInto("identity_users")
            .values({
              user_id: userId,
              apple_sub: null,
              email: normalizedEmail
            })
            .execute();
          return userId;
        } catch {
          const concurrentRow = await trx
            .selectFrom("identity_users")
            .select(["user_id"])
            .where("email", "=", normalizedEmail)
            .executeTakeFirst();

          if (!concurrentRow) {
            throw new Error("Failed to resolve identity user for email");
          }

          await trx
            .updateTable("identity_users")
            .set({
              updated_at: now
            })
            .where("user_id", "=", concurrentRow.user_id)
            .execute();

          return concurrentRow.user_id;
        }
      });
    },
    async rotateRefreshSession(refreshToken, createNextSession, authMethod) {
      return db.transaction().execute(async (trx) => {
        const row = await trx
          .selectFrom("identity_sessions")
          .selectAll()
          .where("refresh_token", "=", refreshToken)
          .forUpdate()
          .executeTakeFirst();

        if (!row) {
          return undefined;
        }

        const persisted = row as unknown as PersistedSessionRow;
        const revokedAt = persisted.revoked_at ? parseIsoDate(persisted.revoked_at) : undefined;
        if (!isRefreshSessionActive(parseIsoDate(persisted.expires_at), revokedAt)) {
          return undefined;
        }

        await trx
          .updateTable("identity_sessions")
          .set({
            revoked_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .where("access_token", "=", persisted.access_token)
          .execute();

        const nextSession = createNextSession(persisted.user_id);
        await trx
          .insertInto("identity_sessions")
          .values({
            access_token: nextSession.accessToken,
            refresh_token: nextSession.refreshToken,
            user_id: nextSession.userId,
            access_expires_at: nextSession.expiresAt,
            expires_at: nextSession.refreshExpiresAt,
            revoked_at: null,
            auth_method: authMethod
          } as never)
          .execute();

        return toPublicSession(nextSession);
      });
    },
    async getSessionByAccessToken(accessToken) {
      const row = await db
        .selectFrom("identity_sessions")
        .selectAll()
        .where("access_token", "=", accessToken)
        .executeTakeFirst();

      if (!row) {
        return undefined;
      }

      const persisted = row as unknown as PersistedSessionRow;
      const session = authSessionSchema.parse({
        accessToken: persisted.access_token,
        refreshToken: persisted.refresh_token,
        userId: persisted.user_id,
        expiresAt: parseIsoDate(persisted.access_expires_at ?? persisted.expires_at)
      });

      if (!isAccessSessionActive(session, persisted.revoked_at ? parseIsoDate(persisted.revoked_at) : undefined)) {
        return undefined;
      }

      return session;
    },
    async getSessionByRefreshToken(refreshToken) {
      const row = await db
        .selectFrom("identity_sessions")
        .selectAll()
        .where("refresh_token", "=", refreshToken)
        .executeTakeFirst();

      if (!row) {
        return undefined;
      }

      const persisted = row as unknown as PersistedSessionRow;
      const session = authSessionSchema.parse({
        accessToken: persisted.access_token,
        refreshToken: persisted.refresh_token,
        userId: persisted.user_id,
        expiresAt: parseIsoDate(persisted.access_expires_at ?? persisted.expires_at)
      });

      if (!isRefreshSessionActive(parseIsoDate(persisted.expires_at), persisted.revoked_at ? parseIsoDate(persisted.revoked_at) : undefined)) {
        return undefined;
      }

      return session;
    },
    async revokeByRefreshToken(refreshToken) {
      await db
        .updateTable("identity_sessions")
        .set({
          revoked_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .where("refresh_token", "=", refreshToken)
        .execute();
    },
    async savePasskeyChallenge(input) {
      try {
        await db
          .insertInto("identity_passkey_challenges")
          .values({
            challenge: input.challenge,
            flow: input.flow,
            user_id: input.userId ?? null,
            rp_id: input.rpId,
            timeout_ms: input.timeoutMs,
            expires_at: input.expiresAt,
            consumed_at: input.consumedAt ?? null
          })
          .execute();
      } catch {
        // ignore duplicate key races
      }
    },
    async getPasskeyChallenge(flow, challenge) {
      const row = await db
        .selectFrom("identity_passkey_challenges")
        .selectAll()
        .where("flow", "=", flow)
        .where("challenge", "=", challenge)
        .where("expires_at", ">", new Date().toISOString())
        .where("consumed_at", "is", null)
        .executeTakeFirst();

      if (!row) {
        return undefined;
      }

      return toPasskeyChallengeRecord(row as PersistedPasskeyChallengeRow);
    },
    async markPasskeyChallengeConsumed(challenge) {
      await db
        .updateTable("identity_passkey_challenges")
        .set({
          consumed_at: new Date().toISOString()
        })
        .where("challenge", "=", challenge)
        .execute();
    },
    async listPasskeyCredentialsForUser(userId) {
      const rows = await db
        .selectFrom("identity_passkey_credentials")
        .selectAll()
        .where("user_id", "=", userId)
        .orderBy("created_at", "desc")
        .execute();

      return rows.map((row) => toPasskeyCredentialRecord(row as PersistedPasskeyCredentialRow));
    },
    async getPasskeyCredential(credentialId) {
      const row = await db
        .selectFrom("identity_passkey_credentials")
        .selectAll()
        .where("credential_id", "=", credentialId)
        .executeTakeFirst();

      if (!row) {
        return undefined;
      }

      return toPasskeyCredentialRecord(row as PersistedPasskeyCredentialRow);
    },
    async savePasskeyCredential(input) {
      try {
        await db
          .insertInto("identity_passkey_credentials")
          .values({
            credential_id: input.credentialId,
            user_id: input.userId,
            webauthn_user_id: input.webauthnUserId,
            public_key: input.publicKey,
            counter: input.counter,
            transports_json: input.transports,
            device_type: input.deviceType,
            backed_up: input.backedUp
          })
          .execute();
      } catch {
        await db
          .updateTable("identity_passkey_credentials")
          .set({
            user_id: input.userId,
            webauthn_user_id: input.webauthnUserId,
            public_key: input.publicKey,
            counter: input.counter,
            transports_json: input.transports,
            device_type: input.deviceType,
            backed_up: input.backedUp,
            updated_at: new Date().toISOString()
          })
          .where("credential_id", "=", input.credentialId)
          .execute();
      }
    },
    async updatePasskeyCredentialCounter(credentialId, counter) {
      await db
        .updateTable("identity_passkey_credentials")
        .set({
          counter,
          updated_at: new Date().toISOString()
        })
        .where("credential_id", "=", credentialId)
        .execute();
    },
    async saveMagicLink(input) {
      await db
        .insertInto("identity_magic_links")
        .values({
          token: input.token,
          email: normalizeEmail(input.email),
          user_id: null,
          expires_at: input.expiresAt,
          consumed_at: null
        })
        .execute();
    },
    async getMagicLink(token) {
      const row = await db
        .selectFrom("identity_magic_links")
        .selectAll()
        .where("token", "=", token)
        .executeTakeFirst();

      if (!row) {
        return undefined;
      }

      return toMagicLinkRecord(row as PersistedMagicLinkRow);
    },
    async consumeMagicLink(token, userId) {
      await db
        .updateTable("identity_magic_links")
        .set({
          user_id: userId,
          consumed_at: new Date().toISOString()
        })
        .where("token", "=", token)
        .execute();
    },
    async close() {
      await db.destroy();
    }
  };
}

export async function createIdentityRepository(logger: FastifyBaseLogger): Promise<IdentityRepository> {
  const databaseUrl = getDatabaseUrl();
  if (!databaseUrl) {
    logger.info({ backend: "memory" }, "identity persistence backend selected");
    return createInMemoryIdentityRepository();
  }

  try {
    const repository = await createPostgresRepository(databaseUrl);
    logger.info({ backend: "postgres" }, "identity persistence backend selected");
    return repository;
  } catch (error) {
    logger.error({ error }, "failed to initialize postgres persistence; falling back to in-memory");
    return createInMemoryIdentityRepository();
  }
}
