import { createWriteStream } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { finished } from "node:stream/promises";
import { afterEach, describe, expect, it } from "vitest";
import yazl from "yazl";
import { extractValidatedQuestionImages } from "./extract-images";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe("extractValidatedQuestionImages", () => {
  it("extracts validated images using normalized question names", async () => {
    const root = await mkdtemp(join(tmpdir(), "onthilab-importer-test-"));
    temporaryDirectories.push(root);
    const output = join(root, "output");
    const archive = join(root, "questions.zip");
    const zipFile = new yazl.ZipFile();
    zipFile.addBuffer(Buffer.from("one"), "Q1.jpg");
    zipFile.addBuffer(Buffer.from("two"), "Q2.jpg");
    zipFile.end();
    zipFile.outputStream.pipe(createWriteStream(archive));
    await finished(zipFile.outputStream);

    const result = await extractValidatedQuestionImages(archive, output, {
      expectedQuestionCount: 2,
    });

    expect(result.map(({ fileName }) => fileName)).toEqual([
      "Q1.jpg",
      "Q2.jpg",
    ]);
    await expect(readFile(join(output, "Q2.jpg"), "utf8")).resolves.toBe("two");
    expect(result[0]?.sha256).toMatch(/^[a-f0-9]{64}$/);
  });
});
