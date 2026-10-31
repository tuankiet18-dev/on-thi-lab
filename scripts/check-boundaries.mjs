// Enforces the dependency direction in AGENTS.md. Run: pnpm check:boundaries
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

// Which @onthilab/* packages each area may import.
export const allowedPackages = {
  "apps/web": ["contracts", "config"],
  "apps/api": ["contracts", "database", "importer"],
  "apps/worker": ["contracts", "database"],
  "packages/contracts": [],
  "packages/database": ["contracts"],
  // importer only uses database types (AI suggestion repository).
  "packages/importer": ["database"],
  "packages/config": [],
  infra: [],
  e2e: [],
};

// File-level exceptions: the validate:zip CLI lives in the worker package.
export const fileExceptions = {
  "apps/worker/src/validate-zip.ts": ["importer"],
};

const importPattern = /(?:from|import)\s*\(?\s*["']([^"']+)["']/g;

export function findViolations(files) {
  const violations = [];
  for (const { path, source } of files) {
    const area = Object.keys(allowedPackages).find((a) =>
      path.startsWith(`${a}/`),
    );
    if (!area) continue;
    const allowed = [...allowedPackages[area], ...(fileExceptions[path] ?? [])];
    for (const [, specifier] of source.matchAll(importPattern)) {
      const pkg = specifier.match(/^@onthilab\/([a-z-]+)/)?.[1];
      if (pkg && !allowed.includes(pkg)) {
        violations.push(`${path}: ${area} must not import @onthilab/${pkg}`);
      }
      if (/^(\.\.\/)+(apps|packages|infra)\//.test(specifier)) {
        violations.push(
          `${path}: import another package by name, not by path (${specifier})`,
        );
      }
      // Domain modules/features stay independent of each other.
      const own = path.match(
        /^apps\/(?:api\/src\/modules|web\/src\/features)\/([^/]+)\//,
      )?.[1];
      const sibling = specifier.match(/^\.\.\/([^./][^/]*)\//)?.[1];
      if (own && sibling && sibling !== own) {
        violations.push(
          `${path}: module "${own}" imports sibling module "${sibling}"`,
        );
      }
    }
  }
  return violations;
}

function listSources(root, dir) {
  const out = [];
  for (const name of readdirSync(join(root, dir))) {
    if (
      ["node_modules", "dist", "cdk.out", "drizzle", "coverage"].includes(name)
    )
      continue;
    const path = join(dir, name);
    if (statSync(join(root, path)).isDirectory())
      out.push(...listSources(root, path));
    else if (/\.(ts|tsx|mjs)$/.test(name)) out.push(path);
  }
  return out;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = join(fileURLToPath(import.meta.url), "..", "..");
  const files = ["apps", "packages", "infra", "e2e"]
    .flatMap((d) => listSources(root, d))
    .map((p) => ({
      path: p.split(sep).join("/"),
      source: readFileSync(join(root, p), "utf8"),
    }));
  const violations = findViolations(files);
  if (violations.length) {
    console.error(
      `Architecture boundary violations:\n${violations.map((v) => `  - ${v}`).join("\n")}`,
    );
    process.exit(1);
  }
  console.log(`Architecture boundaries OK (${files.length} files checked)`);
}
