import { describe, expect, it } from "vitest";
import {
  createMenuImageUploadService,
  MenuImageUploadUnavailableError,
  MenuImageUploadValidationError
} from "../src/media-storage.js";

const configuredEnv: NodeJS.ProcessEnv = {
  CATALOG_MEDIA_R2_ACCOUNT_ID: "test-account",
  CATALOG_MEDIA_R2_ACCESS_KEY_ID: "test-access-key",
  CATALOG_MEDIA_R2_SECRET_ACCESS_KEY: "test-secret-key",
  CATALOG_MEDIA_R2_BUCKET: "menu-media",
  CATALOG_MEDIA_PUBLIC_BASE_URL: "https://media.example.test",
  CATALOG_MEDIA_UPLOAD_MAX_BYTES: "1024",
  CATALOG_MEDIA_UPLOAD_EXPIRY_SECONDS: "120"
};

describe("menu image upload service", () => {
  it("is disabled when R2 configuration is incomplete", async () => {
    const service = createMenuImageUploadService({});

    expect(service.enabled).toBe(false);
    await expect(
      service.createUpload({
        brandId: "rawaqcoffee",
        locationId: "rawaqcoffee01",
        itemId: "latte",
        fileName: "latte.jpg",
        contentType: "image/jpeg",
        sizeBytes: 512
      })
    ).rejects.toBeInstanceOf(MenuImageUploadUnavailableError);
  });

  it("rejects unsupported image content types", async () => {
    const service = createMenuImageUploadService(configuredEnv);

    await expect(
      service.createUpload({
        brandId: "rawaqcoffee",
        locationId: "rawaqcoffee01",
        itemId: "latte",
        fileName: "latte.svg",
        contentType: "image/svg+xml",
        sizeBytes: 512
      })
    ).rejects.toMatchObject({
      name: "MenuImageUploadValidationError",
      statusCode: 400
    } satisfies Partial<MenuImageUploadValidationError>);
  });

  it("rejects uploads larger than the configured limit", async () => {
    const service = createMenuImageUploadService(configuredEnv);

    await expect(
      service.createUpload({
        brandId: "rawaqcoffee",
        locationId: "rawaqcoffee01",
        itemId: "latte",
        fileName: "latte.jpg",
        contentType: "image/jpeg",
        sizeBytes: 2048
      })
    ).rejects.toMatchObject({
      name: "MenuImageUploadValidationError",
      statusCode: 413
    } satisfies Partial<MenuImageUploadValidationError>);
  });

  it("creates original and mobile variant upload URLs with safe public asset URLs", async () => {
    const service = createMenuImageUploadService(configuredEnv);
    const upload = await service.createUpload({
      brandId: "Rawaq Coffee",
      locationId: "Rawaq Coffee 01",
      itemId: "Latte!",
      fileName: "latte.php",
      contentType: "image/jpeg",
      sizeBytes: 512
    });

    expect(service.enabled).toBe(true);
    expect(upload.uploadMethod).toBe("PUT");
    expect(upload.uploadHeaders).toEqual({ "content-type": "image/jpeg" });
    expect(upload.uploadUrl).toContain("https://test-account.r2.cloudflarestorage.com/menu-media/");
    expect(upload.assetUrl).toMatch(
      /^https:\/\/media\.example\.test\/brands\/rawaq-coffee\/locations\/rawaq-coffee-01\/menu-items\/latte\/original\/.*-latte\.jpg$/
    );
    expect(upload.assetUrl).not.toContain(".php");
    expect(upload.variantUploads).toHaveLength(2);
    expect(upload.variantUploads.map((variant) => variant.variant)).toEqual(["mobile-list", "mobile-hero"]);
    expect(upload.variantUploads.every((variant) => variant.assetUrl.endsWith(".jpg"))).toBe(true);
  });
});
