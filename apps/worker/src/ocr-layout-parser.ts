export interface OcrBoundingBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface OcrLayoutLine {
  text: string;
  confidence: number;
  box: OcrBoundingBox;
}

export interface OcrLayoutResult {
  rawText: string;
  stem: string;
  options: string[];
  optionCount: number;
  /** A normalized crop suggestion used only in memory for a retry. */
  crop: OcrBoundingBox | null;
  sourceLineCount: number;
  selectedLineCount: number;
}

type ParsedOptionLine = OcrLayoutLine & {
  optionLetter: string | null;
  optionText: string;
};

const optionPattern =
  /^\s*(?:\(?([A-F])\)?|\[([A-F])\])(?:\s*[.):\-]\s*|\s+)(.+)$/i;

function isStructuralNoise(text: string): boolean {
  return (
    /^(?:question\s*:?\s*\d+|answer|back|next|finish(?:\s+the)?\s+exam)$/i.test(
      text,
    ) ||
    /^(?:there (?:are|is) \d+ questions?|your progress|progress of answering)/i.test(
      text,
    ) ||
    /^\(?\s*choose\s+(?:one|\d+|all|multiple)\s+answers?\s*\)?$/i.test(text)
  );
}

function isStandaloneOptionLabel(text: string): boolean {
  return /^\s*(?:\(?[A-F]\)?|\[[A-F]\])\s*$/i.test(text);
}

function parseOptionLine(line: OcrLayoutLine): ParsedOptionLine {
  const match = line.text.match(optionPattern);
  return {
    ...line,
    optionLetter: (match?.[1] ?? match?.[2] ?? "").toUpperCase() || null,
    optionText: (match?.[3] ?? "").trim(),
  };
}

function unionBounds(lines: OcrLayoutLine[]): OcrBoundingBox | null {
  if (lines.length === 0) return null;
  const left = Math.min(...lines.map((line) => line.box.left));
  const top = Math.min(...lines.map((line) => line.box.top));
  const right = Math.max(
    ...lines.map((line) => line.box.left + line.box.width),
  );
  const bottom = Math.max(
    ...lines.map((line) => line.box.top + line.box.height),
  );
  const padding = 0.025;
  const paddedLeft = Math.max(0, left - padding);
  const paddedTop = Math.max(0, top - padding);
  const paddedRight = Math.min(1, right + padding);
  const paddedBottom = Math.min(1, bottom + padding);
  return {
    left: paddedLeft,
    top: paddedTop,
    width: paddedRight - paddedLeft,
    height: paddedBottom - paddedTop,
  };
}

function isValidChain(
  previous: ParsedOptionLine,
  current: ParsedOptionLine,
): boolean {
  const sameColumn = Math.abs(previous.box.left - current.box.left) <= 0.16;
  const verticalGap = current.box.top - previous.box.top;
  return sameColumn && verticalGap >= -0.01 && verticalGap <= 0.2;
}

/**
 * Picks the longest A→F option sequence from Textract line geometry. This
 * deliberately ignores sidebar labels such as bare “A”, “B”, “C”, “D”.
 */
function findOptionChain(lines: ParsedOptionLine[]): ParsedOptionLine[] {
  const candidates = lines.filter(
    (line) => line.optionLetter === "A" && Boolean(line.optionText),
  );
  const chains = candidates.map((start) => {
    const chain = [start];
    let expected = "B";
    let cursor = lines.indexOf(start) + 1;

    while (expected <= "F" && cursor < lines.length) {
      const next = lines[cursor++];
      if (!next) continue;
      if (next.optionLetter !== expected || !next.optionText) continue;
      if (!isValidChain(chain.at(-1)!, next)) continue;
      chain.push(next);
      expected = String.fromCharCode(expected.charCodeAt(0) + 1);
    }
    return chain;
  });

  return (
    chains
      .filter((chain) => chain.length >= 2)
      .sort(
        (left, right) =>
          right.length - left.length ||
          right.reduce((total, line) => total + line.optionText.length, 0) -
            left.reduce((total, line) => total + line.optionText.length, 0),
      )[0] ?? []
  );
}

function textLinesForStem(
  lines: OcrLayoutLine[],
  firstOption: ParsedOptionLine,
): OcrLayoutLine[] {
  const minLeft = Math.max(0, firstOption.box.left - 0.14);
  const minTop = Math.max(0, firstOption.box.top - 0.5);
  return lines.filter(
    (line) =>
      line.box.top >= minTop &&
      // Leave the first actual option out of the stem. We do not filter all
      // `A.` lines because a legitimate question can begin with “A project…”.
      line.box.top < firstOption.box.top - 0.003 &&
      line.box.left + line.box.width >= minLeft &&
      !isStructuralNoise(line.text) &&
      !isStandaloneOptionLabel(line.text),
  );
}

function retryCropFromLines(lines: OcrLayoutLine[]): OcrBoundingBox | null {
  const useful = lines.filter(
    (line) =>
      line.text.length >= 4 &&
      !isStructuralNoise(line.text) &&
      !isStandaloneOptionLabel(line.text),
  );
  if (useful.length === 0) return null;

  // A full-screen capture commonly has a sidebar at the far left. Prefer the
  // densest text column, which is normally the question panel.
  const groups = useful.map((anchor) =>
    useful.filter((line) => Math.abs(line.box.left - anchor.box.left) <= 0.2),
  );
  const selected = groups.sort(
    (left, right) =>
      right.reduce((total, line) => total + line.text.length, 0) -
      left.reduce((total, line) => total + line.text.length, 0),
  )[0];
  const crop = selected ? unionBounds(selected) : null;
  if (!crop || (crop.width > 0.92 && crop.height > 0.92)) return null;
  return crop;
}

export function parseQuestionLayout(
  linesInput: OcrLayoutLine[],
): OcrLayoutResult {
  const lines = linesInput
    .filter(
      (line) =>
        line.text.trim().length > 0 &&
        Number.isFinite(line.box.left) &&
        Number.isFinite(line.box.top),
    )
    .map((line) => ({ ...line, text: line.text.trim() }))
    .sort(
      (left, right) =>
        left.box.top - right.box.top || left.box.left - right.box.left,
    );
  const parsed = lines.map(parseOptionLine);
  const optionChain = findOptionChain(parsed);

  if (optionChain.length >= 2) {
    const stemLines = textLinesForStem(lines, optionChain[0]!);
    const selectedLines = [...stemLines, ...optionChain];
    return {
      rawText: selectedLines.map((line) => line.text).join("\n"),
      stem: stemLines
        .map((line) => line.text)
        .join("\n")
        .trim(),
      options: optionChain.map((line) => line.optionText),
      optionCount: optionChain.length,
      crop: unionBounds(selectedLines),
      sourceLineCount: lines.length,
      selectedLineCount: selectedLines.length,
    };
  }

  const useful = lines.filter(
    (line) =>
      !isStructuralNoise(line.text) && !isStandaloneOptionLabel(line.text),
  );
  return {
    rawText: useful.map((line) => line.text).join("\n"),
    stem: useful
      .map((line) => line.text)
      .join("\n")
      .trim(),
    options: [],
    optionCount: 0,
    crop: retryCropFromLines(lines),
    sourceLineCount: lines.length,
    selectedLineCount: useful.length,
  };
}
