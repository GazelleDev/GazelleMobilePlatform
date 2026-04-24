import { randomUUID } from "node:crypto";
import { extname } from "node:path";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { AdminMenuItemImageUploadResponse } from "@lattelink/contracts-catalog";

const defaultUploadExpirySeconds = 300;
const defaultUploadMaxBytes = 10 * 1024 * 1024;
const allowedImageContentTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif"
]);

function trimToUndefined(value: string | undefined) {
  const next = value?.trim();
  return next && next.length > 0 ? next : undefined;
}

function ensureTrailingSlash(value: string) {
  return value.endsWith("/") ? value : `${value}/`;
}

function toPositiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function sanitizeFileStem(fileName: string) {
  const baseName = fileName.split(/[\\/]/).pop() ?? "upload";
  const stem = baseName.replace(/\.[^.]+$/, "");
  const normalized = stem
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized.length > 0 ? normalized : "menu-image";
}

function sanitizePathSegment(value: string, fallback: string) {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized.length > 0 ? normalized : fallback;
}

function normalizeExtension(fileName: string, contentType: string) {
  const fromName = extname(fileName).replace(/^\./, "").trim().toLowerCase();
  if (fromName) {
    return fromName;
  }

  switch (contentType) {
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "image/heic":
      return "heic";
    case "image/heif":
      return "heif";
    default:
      return "bin";
  }
}

function buildObjectKey(params: {
  brandId: string;
  locationId: string;
  itemId: string;
  fileName: string;
  contentType: string;
}) {
  const stem = sanitizeFileStem(params.fileName);
  const extension = normalizeExtension(params.fileName, params.contentType);
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const brandId = sanitizePathSegment(params.brandId, "brand");
  const locationId = sanitizePathSegment(params.locationId, "location");
  const itemId = sanitizePathSegment(params.itemId, "item");

  return `brands/${brandId}/locations/${locationId}/menu-items/${itemId}/original/${timestamp}-${randomUUID().slice(0, 8)}-${stem}.${extension}`;
}

export class MenuImageUploadUnavailableError extends Error {
  constructor(message = "Menu image uploads are not configured.") {
    super(message);
    this.name = "MenuImageUploadUnavailableError";
  }
}

export class MenuImageUploadValidationError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = "MenuImageUploadValidationError";
    this.statusCode = statusCode;
  }
}

export type MenuImageUploadService = {
  enabled: boolean;
  createUpload(input: {
    brandId: string;
    locationId: string;
    itemId: string;
    fileName: string;
    contentType: string;
    sizeBytes: number;
  }): Promise<AdminMenuItemImageUploadResponse>;
};

export function createMenuImageUploadService(env: NodeJS.ProcessEnv = process.env): MenuImageUploadService {
  const accountId = trimToUndefined(env.CATALOG_MEDIA_R2_ACCOUNT_ID);
  const accessKeyId = trimToUndefined(env.CATALOG_MEDIA_R2_ACCESS_KEY_ID);
  const secretAccessKey = trimToUndefined(env.CATALOG_MEDIA_R2_SECRET_ACCESS_KEY);
  const bucket = trimToUndefined(env.CATALOG_MEDIA_R2_BUCKET);
  const publicBaseUrl = trimToUndefined(env.CATALOG_MEDIA_PUBLIC_BASE_URL);
  const maxUploadBytes = toPositiveInteger(env.CATALOG_MEDIA_UPLOAD_MAX_BYTES, defaultUploadMaxBytes);
  const uploadExpirySeconds = toPositiveInteger(env.CATALOG_MEDIA_UPLOAD_EXPIRY_SECONDS, defaultUploadExpirySeconds);

  if (!accountId || !accessKeyId || !secretAccessKey || !bucket || !publicBaseUrl) {
    return {
      enabled: false,
      async createUpload() {
        throw new MenuImageUploadUnavailableError();
      }
    };
  }

  const client = new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId,
      secretAccessKey
    },
    forcePathStyle: true
  });

  return {
    enabled: true,
    async createUpload(input) {
      if (!allowedImageContentTypes.has(input.contentType)) {
        throw new MenuImageUploadValidationError("Only JPEG, PNG, WebP, HEIC, and HEIF images are supported.");
      }

      if (input.sizeBytes > maxUploadBytes) {
        throw new MenuImageUploadValidationError(
          `Menu images must be ${Math.floor(maxUploadBytes / (1024 * 1024))} MB or smaller.`,
          413
        );
      }

      const objectKey = buildObjectKey(input);
      const uploadUrl = await getSignedUrl(
        client,
        new PutObjectCommand({
          Bucket: bucket,
          Key: objectKey,
          ContentType: input.contentType
        }),
        {
          expiresIn: uploadExpirySeconds
        }
      );

      return {
        uploadMethod: "PUT",
        uploadUrl,
        uploadHeaders: {
          "content-type": input.contentType
        },
        assetUrl: new URL(objectKey, ensureTrailingSlash(publicBaseUrl)).toString(),
        expiresAt: new Date(Date.now() + uploadExpirySeconds * 1000).toISOString()
      };
    }
  };
}
