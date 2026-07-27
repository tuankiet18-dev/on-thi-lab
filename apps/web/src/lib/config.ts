import { readPublicWebConfig } from "@onthilab/config";

export const webConfig = readPublicWebConfig(import.meta.env);

/** Whether the build received an explicit API endpoint instead of its dev fallback. */
export const hasConfiguredApiUrl = Boolean(import.meta.env.VITE_API_URL);

export const cognitoConfig =
  webConfig.cognitoDomain &&
  webConfig.cognitoClientId &&
  webConfig.cognitoRedirectUri &&
  webConfig.cognitoLogoutUri
    ? {
        domain: webConfig.cognitoDomain.replace(/\/$/, ""),
        clientId: webConfig.cognitoClientId,
        redirectUri: webConfig.cognitoRedirectUri,
        logoutUri: webConfig.cognitoLogoutUri,
      }
    : undefined;
