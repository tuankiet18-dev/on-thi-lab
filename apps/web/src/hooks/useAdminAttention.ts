import type { AdminAttentionSummary } from "@onthilab/contracts";
import { useCallback, useEffect, useState } from "react";
import { getAdminAttentionSummary } from "../lib/api";

export function useAdminAttentionSummary(
  idToken: string | undefined,
  enabled = true,
) {
  const [summary, setSummary] = useState<AdminAttentionSummary | null>(null);

  const refresh = useCallback(async () => {
    if (!idToken || !enabled) {
      setSummary(null);
      return;
    }

    try {
      const data = await getAdminAttentionSummary(idToken);
      setSummary(data);
    } catch {
      // Navigation remains usable if the summary endpoint is unavailable.
    }
  }, [enabled, idToken]);

  useEffect(() => {
    void refresh();

    if (!idToken || !enabled) {
      return;
    }

    const intervalId = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void refresh();
      }
    }, 60_000);

    const handleFocus = () => void refresh();
    window.addEventListener("focus", handleFocus);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", handleFocus);
    };
  }, [enabled, idToken, refresh]);

  return { summary, refresh };
}
