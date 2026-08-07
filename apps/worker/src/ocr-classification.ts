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

  if (
    /[∑∫√≤≥±×÷∞∂α-ωΑ-Ω]/.test(text) ||
    /(?:\b\w+\s*[\^=]\s*\d|\b(?:sin|cos|tan|log|ln|sqrt)\s*\(|\b\d+\s*\/\s*\d+)/i.test(
      text,
    )
  ) {
    flags.push("has_formula");
  }

  if (context.imageWidth < 700 || context.imageHeight < 180) {
    flags.push("low_resolution");
  }

  if (context.parsedOptionCount < 2 || context.parsedOptionCount > 6) {
    flags.push("missing_option_labels");
  }

  if (text.trim().length < 20) {
    flags.push("too_short");
  }

  return [...new Set(flags)];
}
