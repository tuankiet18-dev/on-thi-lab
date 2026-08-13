import type { UploadedArchive } from "../import-service";

function encodeImageKey(imageKey: string): string {
  return imageKey
    .replace(/^\/+/, "")
    .split("/")
    .map(encodeURIComponent)
    .join("/");
}

export function publicQuestionImageUrl(
  imageKey: string,
  configuredBaseUrl?: string,
): string {
  if (/^(?:https?:|data:|blob:)/i.test(imageKey)) return imageKey;
  const baseUrl = configuredBaseUrl ?? "/question-images";
  return `${baseUrl.replace(/\/$/, "")}/${encodeImageKey(imageKey)}`;
}

export function studentQuestionImageUrl(imageUrl: string): string {
  if (/^(?:https?:|data:|blob:)/i.test(imageUrl)) return imageUrl;
  if (imageUrl.startsWith("/")) return imageUrl;
  return `/question-images/${encodeImageKey(imageUrl)}`;
}

export function isUploadedArchive(value: unknown): value is UploadedArchive {
  return (
    typeof value === "object" &&
    value !== null &&
    "name" in value &&
    typeof value.name === "string" &&
    "size" in value &&
    typeof value.size === "number" &&
    "arrayBuffer" in value &&
    typeof value.arrayBuffer === "function"
  );
}
