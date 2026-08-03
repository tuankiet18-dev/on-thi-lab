export function normalizeQuestionText(rawText: string): {
  stem: string;
  options: string[];
  optionCount: number;
} {
  const lines = rawText
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  // Labels are occasionally emitted by Textract on their own line, or as
  // several labelled options in a single LINE block. Insert a line break at
  // explicit labels so both forms use one strict A→F parser below.
  const normalizedLines = lines.flatMap((line) =>
    line
      .replace(/\s+(?=(?:\(?[A-F]\)?|\[[A-F]\])\s*[.):\-])/gi, "\n")
      .split("\n")
      .map((item) => item.trim())
      .filter(Boolean),
  );
  const optionRegex =
    /^\s*(?:\(?([A-F])\)?|\[([A-F])\])(?:\s*[.):\-]\s*(.*)|\s+(.+)|\s*)$/i;

  const parsedLines = normalizedLines.map((line) => {
    const match = line.match(optionRegex);
    const letter = match?.[1] ?? match?.[2];
    return {
      line,
      letter: letter?.toUpperCase() ?? null,
      optionText: (match?.[3] ?? match?.[4] ?? "").trim(),
    };
  });

  // Do not use the first line beginning with "A" blindly. A normal English
  // question may start with "A project...", which Textract legitimately
  // returns as a line that also matches an A-option. Select the A candidate
  // followed by the longest uninterrupted A -> B -> C sequence instead.
  const candidates = parsedLines
    .map((line, index) => ({ ...line, index }))
    .filter((line) => line.letter === "A")
    .map((candidate) => {
      let count = 1;
      let expectedCode = "B".charCodeAt(0);
      for (
        let index = candidate.index + 1;
        index < parsedLines.length;
        index++
      ) {
        const letter = parsedLines[index]?.letter;
        if (!letter) continue;
        if (letter.charCodeAt(0) !== expectedCode) break;
        count++;
        expectedCode++;
      }
      return { startIndex: candidate.index, count };
    })
    .filter((candidate) => candidate.count >= 2)
    .sort(
      (left, right) =>
        right.count - left.count || right.startIndex - left.startIndex,
    );

  const selected = candidates[0];
  if (!selected) {
    return {
      stem: rawText.trim(),
      options: [],
      optionCount: 0,
    };
  }

  const isStructuralNoise = (line: string) =>
    /^question\s*:?\s*\d+\s*$/i.test(line) ||
    /^\(?\s*choose\s+(?:one|\d+|all|multiple)\s+answers?\s*\)?$/i.test(line);
  const cleanLines = (lines: string[]) =>
    lines.filter((line) => !isStructuralNoise(line.trim()));

  const stemLines = cleanLines(
    parsedLines.slice(0, selected.startIndex).map(({ line }) => line),
  );
  const options: string[] = [];
  let expectingLetterCharCode = "A".charCodeAt(0);

  for (let index = selected.startIndex; index < parsedLines.length; index++) {
    const parsed = parsedLines[index]!;
    if (
      parsed.letter &&
      parsed.letter.charCodeAt(0) === expectingLetterCharCode &&
      options.length < selected.count
    ) {
      options.push(parsed.optionText);
      expectingLetterCharCode++;
      continue;
    }

    if (options.length > 0 && !isStructuralNoise(parsed.line)) {
      options[options.length - 1] = `${options.at(-1)}\n${parsed.line}`.trim();
    }
  }

  if (options.length < 2 || options.some((option) => !option.trim())) {
    return {
      stem: rawText.trim(),
      options: [],
      optionCount: 0,
    };
  }

  return {
    stem: stemLines.join("\n").trim(),
    options: options.map((o) => o.trim()),
    optionCount: options.length,
  };
}
