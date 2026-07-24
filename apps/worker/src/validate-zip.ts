import { resolve } from "node:path";
import { validateZipArchive, ZipValidationError } from "./zip-validator.js";

const archiveArgument = process.argv[2];
if (!archiveArgument) {
  console.error("Cách dùng: pnpm validate:zip <đường-dẫn-file.zip>");
  process.exitCode = 2;
} else {
  try {
    const result = await validateZipArchive(resolve(archiveArgument));
    console.log(
      JSON.stringify(
        {
          valid: true,
          questionCount: result.images.length,
          firstQuestion: result.images[0]?.fileName,
          lastQuestion: result.images.at(-1)?.fileName,
          archiveBytes: result.archiveBytes,
          totalUncompressedBytes: result.totalUncompressedBytes,
        },
        null,
        2,
      ),
    );
  } catch (error) {
    const code =
      error instanceof ZipValidationError ? error.code : "VALIDATION_FAILED";
    const message =
      error instanceof Error ? error.message : "ZIP không hợp lệ.";
    console.error(JSON.stringify({ valid: false, code, message }, null, 2));
    process.exitCode = 1;
  }
}
