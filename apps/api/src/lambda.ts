import { defaultIsContentTypeBinary, handle } from "hono/aws-lambda";
import { GetParameterCommand, SSMClient } from "@aws-sdk/client-ssm";
import { createRuntimeApp } from "./runtime";

/**
 * Production Lambda entrypoint. Runtime configuration is validated once during
 * cold start, before Hono accepts any request.
 */
const ssmClient = new SSMClient({});
type LambdaHandler = ReturnType<typeof handle>;

/**
 * API Gateway must receive binary image bodies as base64 with
 * `isBase64Encoded: true`. Hono's default covers most image MIME types, but
 * keeping the explicit image check makes this contract stable when the
 * adapter's MIME allow-list changes (WebP is used by imported question data).
 */
export function isBinaryResponseContentType(contentType: string): boolean {
  return (
    contentType.toLowerCase().startsWith("image/") ||
    defaultIsContentTypeBinary(contentType)
  );
}

let handlerPromise: Promise<LambdaHandler> | undefined;

async function getHandler(): Promise<LambdaHandler> {
  if (!handlerPromise) {
    handlerPromise = (async () => {
      const environment = { ...process.env };
      const parameterName = environment.DATABASE_PARAMETER_NAME;
      const aiApiKeyParameterName = environment.AI_API_KEY_PARAMETER_NAME;

      if (parameterName) {
        const response = await ssmClient.send(
          new GetParameterCommand({
            Name: parameterName,
            WithDecryption: true,
          }),
        );
        const databaseUrl = response.Parameter?.Value;
        if (!databaseUrl) {
          throw new Error("DATABASE_PARAMETER_NAME did not resolve to a value");
        }
        environment.DATABASE_URL = databaseUrl;
      }

      if (aiApiKeyParameterName) {
        const response = await ssmClient.send(
          new GetParameterCommand({
            Name: aiApiKeyParameterName,
            WithDecryption: true,
          }),
        );
        const aiApiKey = response.Parameter?.Value;
        if (!aiApiKey) {
          throw new Error(
            "AI_API_KEY_PARAMETER_NAME did not resolve to a value",
          );
        }
        environment.AI_API_KEY = aiApiKey;
      }

      return handle(createRuntimeApp(environment), {
        isContentTypeBinary: isBinaryResponseContentType,
      });
    })();
  }

  return handlerPromise;
}

export const handler = async (...args: Parameters<LambdaHandler>) =>
  (await getHandler())(...args);
