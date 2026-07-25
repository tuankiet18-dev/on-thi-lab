/**
 * pack-zip.ts
 *
 * Đóng gói thư mục ảnh câu hỏi thành một file ZIP.
 * Sử dụng yazl (đã có trong devDependencies của @onthilab/importer).
 */

import { createWriteStream } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import { join, extname, basename } from "node:path";
import { pipeline } from "node:stream/promises";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { createReadStream } from "node:fs";

const require = createRequire(import.meta.url);
// yazl is a CommonJS module
const yazl = require("yazl") as typeof import("yazl");

const ALLOWED_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp"]);
const QUESTION_NAME_REGEX = /^Q(\d+)\.(jpg|jpeg|png|webp)$/i;

export interface PackZipOptions {
  imageDir: string;
  outputPath: string;
  expectedCount?: number;
}

export interface PackZipResult {
  outputPath: string;
  fileCount: number;
  totalBytes: number;
}

/**
 * Scan thư mục ảnh và trả về danh sách file hợp lệ, sort theo số thứ tự câu.
 */
async function scanImageFiles(
  imageDir: string,
): Promise<{ name: string; path: string; order: number }[]> {
  const entries = await readdir(imageDir);
  const imageFiles: { name: string; path: string; order: number }[] = [];

  for (const name of entries) {
    const ext = extname(name).toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(ext)) continue;

    const match = name.match(QUESTION_NAME_REGEX);
    if (!match?.[1]) {
      console.warn(`  Bỏ qua file không đúng định dạng: ${name}`);
      continue;
    }

    const order = parseInt(match[1], 10);
    imageFiles.push({ name, path: join(imageDir, name), order });
  }

  return imageFiles.sort((a, b) => a.order - b.order);
}

/**
 * Đóng gói ảnh thành ZIP.
 */
export async function packZip(options: PackZipOptions): Promise<PackZipResult> {
  const { imageDir, outputPath, expectedCount = 60 } = options;

  console.log(`\n📦 Scanning ảnh từ: ${imageDir}`);
  const files = await scanImageFiles(imageDir);

  if (files.length !== expectedCount) {
    throw new Error(
      `Cần đúng ${expectedCount} ảnh, tìm thấy ${files.length} file hợp lệ trong ${imageDir}`,
    );
  }

  // Kiểm tra không thiếu câu nào
  for (let i = 1; i <= expectedCount; i++) {
    if (!files.find((f) => f.order === i)) {
      throw new Error(`Thiếu ảnh câu Q${i}`);
    }
  }

  console.log(`✅ Tìm thấy đủ ${files.length} ảnh (Q1 → Q${expectedCount})`);
  console.log(`📦 Đang tạo ZIP: ${outputPath}`);

  let totalBytes = 0;

  await new Promise<void>((resolve, reject) => {
    const zipFile = new yazl.ZipFile();

    for (const file of files) {
      const entryName = file.name; // giữ nguyên tên Q1.jpg, Q2.jpg, ...
      zipFile.addFile(file.path, entryName, {
        compress: false, // ảnh JPEG đã nén, không cần compress thêm
      });
    }

    zipFile.end(undefined, (finalSize) => {
      totalBytes = finalSize ?? 0;
    });

    const out = createWriteStream(outputPath);
    zipFile.outputStream.pipe(out);

    out.on("close", resolve);
    out.on("error", reject);
    zipFile.outputStream.on("error", reject);
  });

  // Lấy kích thước thực của file ZIP
  const zipStat = await stat(outputPath);
  totalBytes = zipStat.size;

  console.log(
    `✅ ZIP tạo thành công: ${outputPath} (${(totalBytes / 1024 / 1024).toFixed(2)} MB)`,
  );

  return {
    outputPath,
    fileCount: files.length,
    totalBytes,
  };
}
