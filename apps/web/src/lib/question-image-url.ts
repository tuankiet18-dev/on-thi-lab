import { hasConfiguredApiUrl, webConfig } from "./config";

/** Resolve relative API image paths through the configured API endpoint. */
export function questionImageUrl(imageUrl: string): string {
  if (/^(?:https?:|data:|blob:)/i.test(imageUrl)) return imageUrl;
  // Demo mode deliberately has no API. Its sample images are served by Vite
  // from the SPA origin, so keep their relative paths unchanged.
  if (!hasConfiguredApiUrl) return imageUrl;

  return `${webConfig.apiUrl.replace(/\/$/, "")}/${imageUrl.replace(/^\/+/, "")}`;
}
