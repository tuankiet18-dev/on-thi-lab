export interface CognitoBrowserConfig {
  domain: string;
  clientId: string;
  redirectUri: string;
  logoutUri: string;
}

export interface AuthUser {
  subject: string;
  email: string;
  name: string;
  groups: string[];
}

export interface AuthSession {
  accessToken: string;
  idToken: string;
  refreshToken?: string;
  expiresAt: number;
  user: AuthUser;
}

interface TokenResponse {
  access_token: string;
  expires_in: number;
  id_token: string;
  refresh_token?: string;
  token_type: string;
}

interface IdTokenClaims {
  sub?: string;
  email?: string;
  name?: string;
  "cognito:groups"?: unknown;
}

function encodeBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);

  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function decodeBase64Url(value: string): string {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(base64 + padding);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export function createRandomBase64Url(byteLength = 32): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return encodeBase64Url(bytes);
}

export async function createCodeChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(verifier),
  );
  return encodeBase64Url(new Uint8Array(digest));
}

export function buildAuthorizationUrl(
  config: CognitoBrowserConfig,
  input: {
    state: string;
    codeChallenge: string;
    provider?: "Google";
  },
): string {
  const url = new URL("/oauth2/authorize", config.domain);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("state", input.state);
  url.searchParams.set("code_challenge", input.codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  if (input.provider) {
    url.searchParams.set("identity_provider", input.provider);
  }
  return url.toString();
}

export function buildLogoutUrl(config: CognitoBrowserConfig): string {
  const url = new URL("/logout", config.domain);
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("logout_uri", config.logoutUri);
  return url.toString();
}

export function decodeIdToken(idToken: string): AuthUser {
  const [, payload] = idToken.split(".");
  if (!payload) throw new Error("ID token không hợp lệ.");

  const claims = JSON.parse(decodeBase64Url(payload)) as IdTokenClaims;
  if (!claims.sub || !claims.email) {
    throw new Error("ID token thiếu thông tin người dùng bắt buộc.");
  }

  return {
    subject: claims.sub,
    email: claims.email,
    name: claims.name?.trim() || claims.email.split("@")[0] || "Sinh viên",
    groups: Array.isArray(claims["cognito:groups"])
      ? claims["cognito:groups"].filter(
          (group): group is string => typeof group === "string",
        )
      : [],
  };
}

export async function exchangeAuthorizationCode(
  config: CognitoBrowserConfig,
  input: { code: string; verifier: string },
  fetcher: typeof fetch = fetch,
): Promise<AuthSession> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: config.clientId,
    code: input.code,
    code_verifier: input.verifier,
    redirect_uri: config.redirectUri,
  });
  const response = await fetcher(`${config.domain}/oauth2/token`, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
    },
    body,
  });

  if (!response.ok) {
    throw new Error("Không thể hoàn tất đăng nhập. Vui lòng thử lại.");
  }

  const tokens = (await response.json()) as TokenResponse;
  return {
    accessToken: tokens.access_token,
    idToken: tokens.id_token,
    refreshToken: tokens.refresh_token,
    expiresAt: Date.now() + tokens.expires_in * 1000,
    user: decodeIdToken(tokens.id_token),
  };
}

export async function refreshAuthSession(
  config: CognitoBrowserConfig,
  currentSession: AuthSession,
  fetcher: typeof fetch = fetch,
): Promise<AuthSession> {
  if (!currentSession.refreshToken) {
    throw new Error("Phiên đăng nhập đã hết hạn.");
  }

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: config.clientId,
    refresh_token: currentSession.refreshToken,
  });
  const response = await fetcher(`${config.domain}/oauth2/token`, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
    },
    body,
  });

  if (!response.ok) {
    throw new Error("Không thể làm mới phiên đăng nhập.");
  }

  const tokens = (await response.json()) as TokenResponse;
  const idToken = tokens.id_token || currentSession.idToken;
  return {
    accessToken: tokens.access_token,
    idToken,
    refreshToken: currentSession.refreshToken,
    expiresAt: Date.now() + tokens.expires_in * 1000,
    user: decodeIdToken(idToken),
  };
}
