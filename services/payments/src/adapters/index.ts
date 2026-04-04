import type { FastifyBaseLogger } from "fastify";
import {
  resolveRuntimeCloverCredentials,
  type CloverOAuthConfig,
  type CloverProviderConfig,
  type PaymentsRepository
} from "../routes.js";
import { CloverAdapter } from "./clover.js";

export async function getAdapter(params: {
  logger: FastifyBaseLogger;
  repository: PaymentsRepository;
  providerConfig: CloverProviderConfig;
  oauthConfig: CloverOAuthConfig;
  requestId: string;
}) {
  const runtimeCredentials = await resolveRuntimeCloverCredentials({
    logger: params.logger,
    repository: params.repository,
    providerConfig: params.providerConfig,
    oauthConfig: params.oauthConfig
  });
  if (!runtimeCredentials) {
    throw new Error(
      params.oauthConfig.misconfigurationReason ??
        params.providerConfig.misconfigurationReason ??
        "Clover provider is misconfigured"
    );
  }

  return new CloverAdapter({
    config: params.providerConfig,
    credentials: runtimeCredentials,
    requestId: params.requestId,
    logger: params.logger,
    repository: params.repository,
    oauthConfig: params.oauthConfig
  });
}
