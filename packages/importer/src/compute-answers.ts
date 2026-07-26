export type AnswerLetter = "a" | "b" | "c" | "d" | "e" | "f";

export type VoteBreakdown = Record<string, number>;

export interface AnswerResult {
  questionNumber: number;
  answers: AnswerLetter[];
  proposedType: "single" | "multiple";
  optionCount: number;
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
}

const answerLetters: readonly AnswerLetter[] = ["a", "b", "c", "d", "e", "f"];
const minConfidence = 0.75;

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
  if (validVotes === 0) {
    return {
      questionNumber,
      answers: [],
      proposedType: "single",
      optionCount: 4,
      confidence: 0,
      totalComments: votes.length,
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
  const disputed = tied || confidence < minConfidence;

  return {
    questionNumber,
    answers,
    proposedType: answers.length > 1 ? "multiple" : "single",
    optionCount: Math.max(
      4,
      ...answers.map((answer) => letterToIndex(answer) + 1),
    ),
    confidence,
    totalComments: votes.length,
    validVotes,
    voteBreakdown: breakdown,
    disputed,
    ...(disputed
      ? {
          disputeReason: tied
            ? "Các tổ hợp đáp án có số phiếu ngang nhau."
            : `Đồng thuận ${Math.round(confidence * 100)}% thấp hơn ${minConfidence * 100}%.`,
        }
      : {}),
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

export function letterToIndex(letter: AnswerLetter): number {
  return answerLetters.indexOf(letter);
}
