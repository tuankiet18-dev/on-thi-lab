import { serve } from "@hono/node-server";
import { createRuntimeApp } from "./runtime";

const port = Number(process.env.PORT ?? 8787);
const app = createRuntimeApp();

serve({ fetch: app.fetch, port }, ({ port: runningPort }) => {
  console.log(`OnThiLab API listening at http://localhost:${runningPort}`);
});
