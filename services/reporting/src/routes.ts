import { timingSafeEqual } from "node:crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { apiErrorSchema } from "@lattelink/contracts-core";
import { reportingResponseSchema } from "@lattelink/contracts-reporting";
import { createReportingRepository, type ReportingRepository } from "./repository.js";
import { queryReporting, ReportingInputError } from "./service.js";

function tokenMatches(expected: string, provided: string | undefined) {
  if (!provided) return false;
  const left = Buffer.from(expected, "utf8");
  const right = Buffer.from(provided, "utf8");
  return left.length === right.length && timingSafeEqual(left, right);
}

function sendError(reply: FastifyReply, statusCode: number, code: string, message: string, requestId: string) {
  return reply.status(statusCode).send(apiErrorSchema.parse({ code, message, requestId }));
}

export async function registerRoutes(app: FastifyInstance, repository?: ReportingRepository) {
  const reportingRepository = repository ?? await createReportingRepository();
  const gatewayToken = process.env.GATEWAY_INTERNAL_API_TOKEN?.trim();
  app.addHook("onClose", async () => { if (!repository) await reportingRepository.close(); });

  app.post("/v1/reporting/query", async (request: FastifyRequest, reply) => {
    if (!gatewayToken) return sendError(reply, 503, "GATEWAY_ACCESS_NOT_CONFIGURED", "GATEWAY_INTERNAL_API_TOKEN must be configured before reporting is available.", request.id);
    const supplied = typeof request.headers["x-gateway-token"] === "string" ? request.headers["x-gateway-token"] : undefined;
    if (!tokenMatches(gatewayToken, supplied)) return sendError(reply, 401, "UNAUTHORIZED_GATEWAY_REQUEST", "Gateway token is invalid", request.id);
    try {
      return reportingResponseSchema.parse(await queryReporting(request.body, reportingRepository));
    } catch (error) {
      if (error instanceof ReportingInputError) return sendError(reply, 400, error.code, error.message, request.id);
      throw error;
    }
  });
}
