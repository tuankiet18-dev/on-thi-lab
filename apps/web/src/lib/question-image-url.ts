import { webConfig } from "./config";

/** Resolve relative API image paths through the configured API endpoint. */
export function questionImageUrl(imageUrl: string): string {
  if (/^(?:https?:|data:|blob:)/i.test(imageUrl)) return imageUrl;

  return `${webConfig.apiUrl.replace(/\/$/, "")}/${imageUrl.replace(/^\/+/, "")}`;
}
