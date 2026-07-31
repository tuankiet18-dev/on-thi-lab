export interface OcrClassificationContext {
  rawText: string;
  confidence: number;
  imageWidth: number;
  imageHeight: number;
  parsedOptionCount: number;
}

export function classifyQuestion(context: OcrClassificationContext): string[] {
  const flags: string[] = [];
  const text = context.rawText;

  if (context.confidence < 0.7) {
    flags.push("low_confidence");
  }

  if (/[∑∫√≤≥±×÷∞∂]/.test(text)) {
    flags.push("has_formula");
  }

  const tableRows = text.split("\n").filter((l) => l.includes("|")).length;
  if (tableRows > 2) {
    flags.push("has_table");
  }

  if (/^\s{4,}|\t/m.test(text) || text.includes("```")) {
    flags.push("has_code_block");
  }

  if (context.imageWidth < 400 || context.imageHeight < 100) {
    flags.push("image_blurry");
  }

  if (context.parsedOptionCount === 0) {
    flags.push("missing_option_labels");
  }

  if (text.trim().length < 20) {
    flags.push("too_short");
  }

  return flags;
}
