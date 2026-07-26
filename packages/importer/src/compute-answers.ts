export type AnswerLetter = "a" | "b" | "c" | "d" | "e" | "f";

export type VoteBreakdown = Record<AnswerLetter, number>;

export interface AnswerResult {
  questionNumber: number;
  answer: AnswerLetter;
  confidence: number;
  totalVotes: number;
  voteBreakdown: VoteBreakdown;
  disputed: boolean;
  disputeReason?: string;
}

export interface RawVote {
  author: string;
  content: string;
}

/**
 * Parse ký tự đáp án từ một comment.
 */
function parseAnswerLetter(content: string): AnswerLetter | null {
  const trimmed = content.trim();
  if (!trimmed) return null;

  const firstChar = trimmed[0]?.toLowerCase();
  if (["a", "b", "c", "d", "e", "f"].includes(firstChar!)) {
    const nextChar = trimmed[1];
    if (
      nextChar === undefined ||
      nextChar === " " ||
      nextChar === "\n" ||
      nextChar === "\r" ||
      nextChar === "." ||
      nextChar === "," ||
      nextChar === ")" ||
      nextChar === ":" ||
      nextChar === "-"
    ) {
      return firstChar as AnswerLetter;
    }
  }

  return null;
}

export function computeAnswer(
  questionNumber: number,
  votes: RawVote[],
): AnswerResult {
  const breakdown: VoteBreakdown = { a: 0, b: 0, c: 0, d: 0, e: 0, f: 0 };

  for (const vote of votes) {
    const letter = parseAnswerLetter(vote.content);
    if (letter) {
      breakdown[letter]++;
    }
  }

  const totalVotes = Object.values(breakdown).reduce((sum, v) => sum + v, 0);

  if (totalVotes === 0) {
    return {
      questionNumber,
      answer: "a", // fallback
      confidence: 0,
      totalVotes: 0,
      voteBreakdown: breakdown,
      disputed: true,
      disputeReason: "Không có vote hợp lệ nào",
    };
  }

  const sorted = (["a", "b", "c", "d", "e", "f"] as AnswerLetter[]).sort(
    (x, y) => breakdown[y]! - breakdown[x]!,
  );

  const topAnswer = sorted[0]!;
  const secondAnswer = sorted[1]!;

  const maxVotes = breakdown[topAnswer]!;
  const secondVotes = breakdown[secondAnswer]!;
  const confidence = maxVotes / totalVotes;

  let disputed = false;
  let disputeReason: string | undefined;

  if (confidence < 0.75) {
    disputed = true;
    disputeReason = `Confidence ${(confidence * 100).toFixed(1)}% < 75% (${maxVotes}/${totalVotes} votes)`;
  } else if (totalVotes >= 3 && secondVotes >= 1) {
    disputed = true;
    disputeReason = `Có ${secondVotes} vote khác: ${topAnswer.toUpperCase()}(${maxVotes}) vs ${secondAnswer.toUpperCase()}(${secondVotes})`;
  }

  return {
    questionNumber,
    answer: topAnswer,
    confidence,
    totalVotes,
    voteBreakdown: breakdown,
    disputed,
    disputeReason,
  };
}

export function computeAllAnswers(
  answersJson: Record<string, RawVote[]>,
): AnswerResult[] {
  const results: AnswerResult[] = [];

  for (const [filename, votes] of Object.entries(answersJson)) {
    const match = filename.match(/^Q(\d+)\./i) || filename.match(/^(\d+)\./i);
    if (!match?.[1]) continue;

    const questionNumber = parseInt(match[1], 10);
    results.push(computeAnswer(questionNumber, votes));
  }

  return results.sort((a, b) => a.questionNumber - b.questionNumber);
}

export function letterToIndex(letter: AnswerLetter): number {
  return { a: 0, b: 1, c: 2, d: 3, e: 4, f: 5 }[letter] ?? 0;
}
