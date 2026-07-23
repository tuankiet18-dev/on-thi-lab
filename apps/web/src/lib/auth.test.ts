import { describe, expect, it, vi } from "vitest";
import {
  buildAuthorizationUrl,
  buildLogoutUrl,
  decodeIdToken,
  exchangeAuthorizationCode,
  type CognitoBrowserConfig,
} from "./auth";

const config: CognitoBrowserConfig = {
  domain: "https://auth.example.com",
  clientId: "public-client",
  redirectUri: "http://localhost:5173/auth/callback",
  logoutUri: "http://localhost:5173/",
};

function encodePayload(payload: unknown): string {
  return btoa(JSON.stringify(payload))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

describe("Cognito browser authentication", () => {
  it("builds a Google authorization-code PKCE URL", () => {
    const url = new URL(
      buildAuthorizationUrl(config, {
        state: "state-value",
        codeChallenge: "challenge-value",
        provider: "Google",
      }),
    );

    expect(url.origin).toBe("https://auth.example.com");
    expect(url.pathname).toBe("/oauth2/authorize");
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("identity_provider")).toBe("Google");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("client_secret")).toBeNull();
  });

  it("builds a Cognito logout URL", () => {
    const url = new URL(buildLogoutUrl(config));

    expect(url.pathname).toBe("/logout");
    expect(url.searchParams.get("client_id")).toBe("public-client");
    expect(url.searchParams.get("logout_uri")).toBe(config.logoutUri);
  });

  it("maps ID-token claims without trusting browser profile input", () => {
    const token = `header.${encodePayload({
      sub: "subject-1",
      email: "student@example.com",
      name: "Student Name",
      "cognito:groups": ["user", "contributor"],
    })}.signature`;

    expect(decodeIdToken(token)).toEqual({
      subject: "subject-1",
      email: "student@example.com",
      name: "Student Name",
      groups: ["user", "contributor"],
    });
  });

  it("exchanges the code without sending a client secret", async () => {
    const idToken = `header.${encodePayload({
      sub: "subject-1",
      email: "student@example.com",
    })}.signature`;
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          access_token: "access",
          expires_in: 3600,
          id_token: idToken,
          refresh_token: "refresh",
          token_type: "Bearer",
        }),
        { status: 200 },
      ),
    );

    await exchangeAuthorizationCode(
      config,
      { code: "code", verifier: "verifier" },
      fetcher,
    );

    const request = fetcher.mock.calls[0];
    const body = request?.[1]?.body?.toString() ?? "";
    expect(body).toContain("code_verifier=verifier");
    expect(body).not.toContain("client_secret");
  });
});
