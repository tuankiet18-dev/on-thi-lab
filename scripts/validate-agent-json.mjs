#!/usr/bin/env node

import fs from "node:fs";
import process from "node:process";
import Ajv2020 from "ajv/dist/2020.js";

const [schemaPath, dataPath] = process.argv.slice(2);
if (!schemaPath || !dataPath) {
  console.error("usage: validate-agent-json.mjs SCHEMA_FILE DATA_FILE");
  process.exit(2);
}

try {
  const schema = JSON.parse(fs.readFileSync(schemaPath, "utf8"));
  const data = JSON.parse(fs.readFileSync(dataPath, "utf8"));
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  const validate = ajv.compile(schema);
  if (!validate(data)) {
    console.error(`JSON schema validation failed for ${dataPath}`);
    for (const error of validate.errors ?? []) {
      console.error(`${error.instancePath || "/"}: ${error.message}`);
    }
    process.exit(1);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
