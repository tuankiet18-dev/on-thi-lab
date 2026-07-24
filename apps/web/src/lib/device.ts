const deviceIdStorageKey = "onthilab.device-id";

export function getOrCreateDeviceId(): string {
  const existing = localStorage.getItem(deviceIdStorageKey);
  if (existing) return existing;

  const deviceId =
    typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  localStorage.setItem(deviceIdStorageKey, deviceId);
  return deviceId;
}
