export function normalizeQuestionText(rawText: string): {
  stem: string;
  options: string[];
  optionCount: number;
} {
  const lines = rawText
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const options: string[] = [];
  const stemLines: string[] = [];

  // A simple regex to detect options like "A.", "B)", "C.", "D)"
  const optionRegex = /^([A-F])[.)]\s*(.*)$/;
  let currentOptionLetter = "";

  let expectingLetterCharCode = 65; // 'A'

  for (const line of lines) {
    const match = line.match(optionRegex);
    if (match && match[1] && match[2] !== undefined) {
      const letter = match[1];
      if (letter.charCodeAt(0) === expectingLetterCharCode) {
        options.push(match[2]);
        expectingLetterCharCode++;
        currentOptionLetter = letter;
      } else {
        if (options.length > 0) {
          options[options.length - 1] += "\n" + line;
        } else {
          stemLines.push(line);
        }
      }
    } else {
      if (options.length > 0) {
        options[options.length - 1] += "\n" + line;
      } else {
        stemLines.push(line);
      }
    }
  }

  if (options.length === 0) {
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
