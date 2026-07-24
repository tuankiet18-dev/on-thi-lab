import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { LocalQuestionImageReader } from "./question-image-reader";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe("LocalQuestionImageReader", () => {
  it("reads image assets but rejects traversal and unsupported files", async () => {
    const root = await mkdtemp(join(tmpdir(), "onthilab-images-"));
    temporaryDirectories.push(root);
    await mkdir(join(root, "drafts"), { recursive: true });
    await writeFile(join(root, "drafts", "Q1.jpg"), new Uint8Array([1, 2, 3]));
    await writeFile(join(root, "drafts", "note.txt"), "not an image");
    const reader = new LocalQuestionImageReader(root);

    await expect(reader.read("drafts/Q1.jpg")).resolves.toMatchObject({
      contentType: "image/jpeg",
    });
    await expect(reader.read("../outside.jpg")).resolves.toBeNull();
    await expect(reader.read("drafts/note.txt")).resolves.toBeNull();
  });
});
