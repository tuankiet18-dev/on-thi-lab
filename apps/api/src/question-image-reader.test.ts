import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  LocalQuestionImageReader,
  S3QuestionImageReader,
} from "./question-image-reader";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe("S3QuestionImageReader", () => {
  it("reads private S3 objects only for safe image keys", async () => {
    const reader = new S3QuestionImageReader(
      {
        send: async () => ({
          Body: { transformToByteArray: async () => new Uint8Array([1, 2, 3]) },
        }),
      } as any,
      "private-images",
    );

    await expect(reader.read("drafts/exam/Q1.webp")).resolves.toMatchObject({
      contentType: "image/webp",
      bytes: new Uint8Array([1, 2, 3]),
    });
    await expect(reader.read("uploads/../archive.jpg")).resolves.toBeNull();
  });
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
