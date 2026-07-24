import { readFile } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";

export interface QuestionImageAsset {
  bytes: Uint8Array;
  contentType: string;
}

export interface QuestionImageReader {
  read(imageKey: string): Promise<QuestionImageAsset | null>;
}

export class UnconfiguredQuestionImageReader implements QuestionImageReader {
  async read(): Promise<null> {
    return null;
  }
}

const contentTypes: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

export class LocalQuestionImageReader implements QuestionImageReader {
  private readonly root: string;

  constructor(storageRoot: string) {
    this.root = resolve(storageRoot);
  }

  async read(imageKey: string): Promise<QuestionImageAsset | null> {
    if (
      !imageKey ||
      imageKey.includes("\0") ||
      imageKey.includes("\\") ||
      imageKey.startsWith("/")
    ) {
      return null;
    }

    const filePath = resolve(this.root, imageKey);
    if (!filePath.startsWith(`${this.root}${sep}`)) return null;
    const contentType = contentTypes[extname(filePath).toLowerCase()];
    if (!contentType) return null;

    try {
      return { bytes: await readFile(filePath), contentType };
    } catch {
      return null;
    }
  }
}
