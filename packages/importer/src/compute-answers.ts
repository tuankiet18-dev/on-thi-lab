export type AnswerLetter = "a" | "b" | "c" | "d" | "e" | "f";

export type VoteBreakdown = Record<string, number>;

export interface AnswerResult {
  questionNumber: number;
  answers: AnswerLetter[];
  proposedType: "single" | "multiple";
  optionCount: number;
  optionCountConfidence?: number;
  optionCountSource?: string;
  confidence: number;
  totalComments: number;
  validVotes: number;
  voteBreakdown: VoteBreakdown;
  disputed: boolean;
  disputeReason?: string;
}

export interface RawVote {
  /** Used only while aggregating one import. It is never persisted. */
  author?: string;
  content: string;
  optionCount?: number;
  optionCountConfidence?: number;
  optionCountSource?: string;
  optionCountNeedsReview?: boolean;
}

const answerLetters: readonly AnswerLetter[] = ["a", "b", "c", "d", "e", "f"];
const minConfidence = 0.75;
const minOptionCountConfidence = 0.82;

interface OptionCountEvidence {
  count: number;
  confidence: number;
  source: string;
  needsReview: boolean;
}

function optionCountEvidence(
  votes: readonly RawVote[],
): OptionCountEvidence | undefined {
  return votes
    .flatMap((vote) => {
      if (
        !Number.isInteger(vote.optionCount) ||
        vote.optionCount! < 2 ||
        vote.optionCount! > 6 ||
        typeof vote.optionCountConfidence !== "number" ||
        vote.optionCountConfidence < 0 ||
        vote.optionCountConfidence > 1
      ) {
        return [];
      }
      return [
        {
          count: vote.optionCount!,
          confidence: vote.optionCountConfidence,
          source: vote.optionCountSource?.slice(0, 50) || "crawler",
          needsReview:
            vote.optionCountNeedsReview === true ||
            vote.optionCountConfidence < minOptionCountConfidence,
        },
      ];
    })
    .sort((left, right) => right.confidence - left.confidence)[0];
}

function canonicalAnswer(letters: readonly AnswerLetter[]): string {
  return [...letters]
    .sort((left, right) => letterToIndex(left) - letterToIndex(right))
    .join("");
}

function asAnswerSet(value: string): AnswerLetter[] | null {
  const compact = value.replace(/[\s,;/&+]+/g, "").toLowerCase();
  if (!/^[a-f]{1,6}$/.test(compact)) return null;

  const letters = [...new Set(compact)] as AnswerLetter[];
  return canonicalAnswer(letters).split("") as AnswerLetter[];
}

/**
 * Reads only an explicit answer from the first non-empty line. This intentionally
 * avoids treating explanations such as "A\nD là ..." as a multi-answer vote.
 */
export function parseCommunityAnswer(content: string): AnswerLetter[] | null {
  const firstLine = content
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .find(Boolean);
  if (!firstLine) return null;

  const direct = firstLine.match(
    /^\(?\s*([A-F](?:[\s,;/&+]*[A-F]){0,5})\s*\)?[.):-]?\s*$/iu,
  );
  if (direct?.[1]) return asAnswerSet(direct[1]);

  const explicit = firstLine.match(
    /đáp\s*án(?:\s*đúng)?\s*(?:là|:|-)?\s*\(?\s*([A-F](?:[\s,;/&+]*[A-F]){0,5})\s*\)?(?=$|[\s.):,-])/iu,
  );
  return explicit?.[1] ? asAnswerSet(explicit[1]) : null;
}

export function computeAnswer(
  questionNumber: number,
  votes: readonly RawVote[],
): AnswerResult {
  const breakdown: VoteBreakdown = {};
  const detectedOptions = optionCountEvidence(votes);
  const seenAuthors = new Map<string, AnswerLetter[]>();
  const anonymousVotes: AnswerLetter[][] = [];

  for (const vote of votes) {
    const answer = parseCommunityAnswer(vote.content);
    if (!answer) continue;
    const author = vote.author?.trim().toLowerCase();
    if (author) {
      // Keep the latest parseable answer from a commenter, without retaining ID.
      seenAuthors.set(author, answer);
    } else {
      anonymousVotes.push(answer);
    }
  }

  const parsedVotes = [...seenAuthors.values(), ...anonymousVotes];
  for (const answer of parsedVotes) {
    const key = canonicalAnswer(answer);
    breakdown[key] = (breakdown[key] ?? 0) + 1;
  }

  const validVotes = parsedVotes.length;
  const totalComments = votes.filter((vote) => vote.content.trim()).length;
  if (validVotes === 0) {
    return {
      questionNumber,
      answers: [],
      proposedType: "single",
      optionCount: detectedOptions?.count ?? 4,
      ...(detectedOptions
        ? {
            optionCountConfidence: detectedOptions.confidence,
            optionCountSource: detectedOptions.source,
          }
        : {}),
      confidence: 0,
      totalComments,
      validVotes,
      voteBreakdown: breakdown,
      disputed: true,
      disputeReason: "Không có comment nào chứa đáp án rõ ràng.",
    };
  }

  const ordered = Object.entries(breakdown).sort(
    ([leftAnswer, leftVotes], [rightAnswer, rightVotes]) =>
      rightVotes - leftVotes || leftAnswer.localeCompare(rightAnswer),
  );
  const [topAnswer, topVotes] = ordered[0]!;
  const secondVotes = ordered[1]?.[1] ?? 0;
  const answers = topAnswer.split("") as AnswerLetter[];
  const confidence = topVotes / validVotes;
  const tied = topVotes === secondVotes;
  const answerLowerBound = Math.max(
    ...answers.map((answer) => letterToIndex(answer) + 1),
  );
  const optionCount = detectedOptions
    ? Math.max(detectedOptions.count, answerLowerBound)
    : Math.max(4, answerLowerBound);
  const optionCountConflict =
    Boolean(detectedOptions) && answerLowerBound > detectedOptions!.count;
  const optionCountDisputed =
    detectedOptions?.needsReview === true || optionCountConflict;
  const disputed = tied || confidence < minConfidence || optionCountDisputed;
  const reasons = [
    tied
      ? "Các tổ hợp đáp án có số phiếu ngang nhau."
      : confidence < minConfidence
        ? `Đồng thuận ${Math.round(confidence * 100)}% thấp hơn ${minConfidence * 100}%.`
        : undefined,
    optionCountConflict
      ? "Đáp án cộng đồng vượt quá số lựa chọn OCR nhận diện."
      : detectedOptions?.needsReview
        ? "Số lựa chọn chưa được nhận diện đủ tin cậy."
        : undefined,
  ].filter((reason): reason is string => Boolean(reason));

  return {
    questionNumber,
    answers,
    proposedType: answers.length > 1 ? "multiple" : "single",
    optionCount,
    ...(detectedOptions
      ? {
          optionCountConfidence: detectedOptions.confidence,
          optionCountSource: detectedOptions.source,
        }
      : {}),
    confidence,
    totalComments,
    validVotes,
    voteBreakdown: breakdown,
    disputed,
    ...(disputed ? { disputeReason: reasons.join(" ") } : {}),
  };
}

export function computeAllAnswers(
  answersJson: Record<string, readonly RawVote[]>,
): AnswerResult[] {
  const results: AnswerResult[] = [];

  for (const [filename, votes] of Object.entries(answersJson)) {
    const match = filename.match(/^Q(\d+)\./i) || filename.match(/^(\d+)\./i);
    if (!match?.[1] || !Array.isArray(votes)) continue;
    results.push(computeAnswer(Number.parseInt(match[1], 10), votes));
  }

  return results.sort(
    (left, right) => left.questionNumber - right.questionNumber,
  );
}

function answerLookupKeys(fileName: string): string[] {
  const normalized = fileName.replaceAll("\\", "/").replace(/^\.\//, "");
  const baseName = normalized.split("/").at(-1) ?? normalized;
  return [...new Set([normalized.toLowerCase(), baseName.toLowerCase()])];
}

/**
 * Associates crawled comments with the image that produced them, without
 * imposing a Q1/Q2 filename convention. Exact paths are preferred; the base
 * filename is accepted for ZIPs that add a parent directory around images.
 */
export function computeAnswersForImages(
  answersJson: Record<string, readonly RawVote[]>,
  images: readonly { order: number; originalFileName: string }[],
): Map<number, AnswerResult> {
  const votesByFileName = new Map<string, readonly RawVote[]>();
  for (const [fileName, votes] of Object.entries(answersJson)) {
    if (!Array.isArray(votes)) continue;
    for (const key of answerLookupKeys(fileName)) {
      if (!votesByFileName.has(key)) votesByFileName.set(key, votes);
    }
  }

  const results = new Map<number, AnswerResult>();
  for (const image of images) {
    const votes = answerLookupKeys(image.originalFileName)
      .map((key) => votesByFileName.get(key))
      .find((candidate) => candidate !== undefined);
    if (votes) results.set(image.order, computeAnswer(image.order, votes));
  }
  return results;
}

export function letterToIndex(letter: AnswerLetter): number {
  return answerLetters.indexOf(letter);
}
