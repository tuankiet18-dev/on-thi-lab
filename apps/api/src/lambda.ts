import { handle } from "hono/aws-lambda";
import { createRuntimeApp } from "./runtime";

/**
 * Production Lambda entrypoint. Runtime configuration is validated once during
 * cold start, before Hono accepts any request.
 */
export const handler = handle(createRuntimeApp());
