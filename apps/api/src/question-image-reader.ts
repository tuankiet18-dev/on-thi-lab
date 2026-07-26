import { readFile } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import { GetObjectCommand, type S3Client } from "@aws-sdk/client-s3";
import { Readable } from "node:stream";

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

function contentTypeFor(imageKey: string): string | null {
  return contentTypes[extname(imageKey).toLowerCase()] ?? null;
}

function hasSafeImageKey(imageKey: string): boolean {
  return Boolean(
    imageKey &&
    !imageKey.includes("\0") &&
    !imageKey.includes("\\") &&
    !imageKey.startsWith("/") &&
    !imageKey.split("/").includes(".."),
  );
}

export class LocalQuestionImageReader implements QuestionImageReader {
  private readonly root: string;

  constructor(storageRoot: string) {
    this.root = resolve(storageRoot);
  }

  async read(imageKey: string): Promise<QuestionImageAsset | null> {
    if (!hasSafeImageKey(imageKey)) return null;

    const filePath = resolve(this.root, imageKey);
    if (!filePath.startsWith(`${this.root}${sep}`)) return null;
    const contentType = contentTypeFor(filePath);
    if (!contentType) return null;

    try {
      return { bytes: await readFile(filePath), contentType };
    } catch {
      return null;
    }
  }
}

export class S3QuestionImageReader implements QuestionImageReader {
  constructor(
    private readonly client: Pick<S3Client, "send">,
    private readonly bucket: string,
  ) {}

  async read(imageKey: string): Promise<QuestionImageAsset | null> {
    if (!hasSafeImageKey(imageKey)) return null;
    const contentType = contentTypeFor(imageKey);
    if (!contentType) return null;

    try {
      const result = await this.client.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: imageKey }),
      );
      const body = result.Body;
      if (!body) return null;
      if (
        typeof (body as { transformToByteArray?: unknown })
          .transformToByteArray === "function"
      ) {
        return {
          bytes: await (
            body as { transformToByteArray(): Promise<Uint8Array> }
          ).transformToByteArray(),
          contentType,
        };
      }
      if (!(body instanceof Readable)) return null;
      const chunks: Buffer[] = [];
      for await (const chunk of body) chunks.push(Buffer.from(chunk));
      return { bytes: Buffer.concat(chunks), contentType };
    } catch {
      return null;
    }
  }
}
