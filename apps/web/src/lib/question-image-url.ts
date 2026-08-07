import { hasConfiguredApiUrl, webConfig } from "./config";

/** Resolve relative API image paths through the configured API endpoint. */
export function questionImageUrl(imageUrl: string): string {
  if (/^(?:https?:|data:|blob:)/i.test(imageUrl)) return imageUrl;
  // Demo mode deliberately has no API. Its sample images are served by Vite
  // from the SPA origin, so keep their relative paths unchanged.
  if (!hasConfiguredApiUrl) return imageUrl;

  const relativePath = imageUrl.replace(/^\/+/, "");
  // Older OCR API responses exposed the S3 key directly. Keep the client
  // defensive while the corrected API response propagates through staging.
  const apiPath = relativePath.startsWith("drafts/")
    ? `question-images/${relativePath}`
    : relativePath;
  return `${webConfig.apiUrl.replace(/\/$/, "")}/${apiPath}`;
}
