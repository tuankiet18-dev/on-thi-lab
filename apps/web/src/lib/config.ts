import { readPublicWebConfig } from "@onthilab/config";

export const webConfig = readPublicWebConfig(import.meta.env);

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
