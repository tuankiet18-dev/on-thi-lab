#!/usr/bin/env node

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repository = path.resolve(scriptDirectory, "..");
const policyPath = path.join(
  repository,
  ".agent/policies/antigravity-settings.example.json",
);
const settingsPath =
  process.env.AGY_SETTINGS_PATH ??
  path.join(os.homedir(), ".gemini/antigravity-cli/settings.json");

const policy = JSON.parse(fs.readFileSync(policyPath, "utf8"));
const settings = fs.existsSync(settingsPath)
  ? JSON.parse(fs.readFileSync(settingsPath, "utf8"))
  : {};
const unique = (values) => [...new Set(values)];
const workspaceAllow = [
  `read_file(${repository})`,
  `write_file(${repository})`,
];
const workspaceDeny = [
  `write_file(${path.join(repository, ".git")})`,
  `write_file(${path.join(repository, ".agent")})`,
  `write_file(${path.join(repository, "package.json")})`,
  `write_file(${path.join(repository, "pnpm-lock.yaml")})`,
  `read_file(${path.join(repository, ".env")})`,
  `read_file(${path.join(repository, ".env.local")})`,
];

settings.trustedWorkspaces = unique([
  ...(settings.trustedWorkspaces ?? []),
  repository,
]);
settings.permissions = {
  ...(settings.permissions ?? {}),
  allow: unique([
    ...(settings.permissions?.allow ?? []),
    ...(policy.permissions.allow ?? []),
    ...workspaceAllow,
  ]),
  deny: unique([
    ...(settings.permissions?.deny ?? []),
    ...(policy.permissions.deny ?? []),
    ...workspaceDeny,
  ]),
  ask: unique(settings.permissions?.ask ?? []),
};

fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
if (
  fs.existsSync(settingsPath) &&
  process.env.AGY_SETTINGS_SKIP_BACKUP !== "1"
) {
  const timestamp = new Date().toISOString().replaceAll(":", "-");
  fs.copyFileSync(settingsPath, `${settingsPath}.backup-${timestamp}`);
}
const temporary = `${settingsPath}.tmp-${process.pid}`;
fs.writeFileSync(temporary, `${JSON.stringify(settings, null, 2)}\n`, {
  mode: 0o600,
});
fs.renameSync(temporary, settingsPath);
console.log(`Configured scoped Antigravity permissions for ${repository}`);
