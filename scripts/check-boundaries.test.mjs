import assert from "node:assert/strict";
import { test } from "node:test";
import { findViolations } from "./check-boundaries.mjs";

const run = (path, source) => findViolations([{ path, source }]);

test("allows declared dependencies", () => {
  assert.deepEqual(
    run("apps/api/src/app.ts", 'import { x } from "@onthilab/database";'),
    [],
  );
});

test("web may not import database", () => {
  assert.equal(
    run("apps/web/src/a.ts", 'import { x } from "@onthilab/database";').length,
    1,
  );
});

test("contracts may not import any workspace package", () => {
  assert.equal(
    run("packages/contracts/src/a.ts", 'import { x } from "@onthilab/config";')
      .length,
    1,
  );
});

test("worker may use importer only in validate-zip", () => {
  const src = 'import { x } from "@onthilab/importer";';
  assert.deepEqual(run("apps/worker/src/validate-zip.ts", src), []);
  assert.equal(run("apps/worker/src/lambda.ts", src).length, 1);
});

test("api modules may not import sibling modules", () => {
  const src = 'import { x } from "../attempts/routes";';
  assert.equal(run("apps/api/src/modules/bookmarks/routes.ts", src).length, 1);
  assert.deepEqual(
    run(
      "apps/api/src/modules/bookmarks/routes.ts",
      'import { x } from "../../app-context";',
    ),
    [],
  );
});

test("rejects importing another package by relative path", () => {
  assert.equal(
    run(
      "apps/api/src/a.ts",
      'import { x } from "../../../packages/database/src/a";',
    ).length,
    1,
  );
});
