export interface OcrClassificationContext {
  rawText: string;
  confidence: number;
  imageWidth: number;
  imageHeight: number;
  parsedOptionCount: number;
  textCoverage?: number;
  lineCount?: number;
  hasComplexLayout?: boolean;
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

  const tableRows = text
    .split("\n")
    .filter((line) => line.includes("|") || /\S\s{3,}\S/.test(line)).length;
  if (tableRows > 2 || context.hasComplexLayout) {
    flags.push("has_table");
  }

  if (/^\s{4,}|\t/m.test(text) || text.includes("```")) {
    flags.push("has_code_block");
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

  // Very little detected text is commonly a graph, formula, diagram, or an
  // OCR failure. Keep it for a human instead of publishing a misleading text
  // rendition.
  if (
    context.textCoverage !== undefined &&
    context.textCoverage < 0.012 &&
    (context.lineCount ?? 0) < 8
  ) {
    flags.push("possible_graph_or_diagram");
  }

  return [...new Set(flags)];
}
