/**
 * compute-answers.ts
 *
 * Tính đáp án cho từng câu hỏi bằng majority voting từ dữ liệu cào FuOverflow.
 */

export type AnswerLetter = "a" | "b" | "c" | "d";

export interface VoteBreakdown {
  a: number;
  b: number;
  c: number;
  d: number;
}

export interface AnswerResult {
  questionNumber: number;
  answer: AnswerLetter;
  confidence: number; // 0..1
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
 * Lấy chữ cái đầu tiên là a/b/c/d (case-insensitive).
 * Bỏ qua các comment chỉ là giải thích (không có chữ cái đầu là a/b/c/d).
 */
function parseAnswerLetter(content: string): AnswerLetter | null {
  const trimmed = content.trim();
  if (!trimmed) return null;

  // Lấy ký tự đầu tiên không phải space
  const firstChar = trimmed[0]?.toLowerCase();
  if (
    firstChar === "a" ||
    firstChar === "b" ||
    firstChar === "c" ||
    firstChar === "d"
  ) {
    // Xác nhận: ký tự tiếp theo phải là space, newline, chấm, hoặc hết chuỗi
    // (để tránh bắt nhầm các từ bắt đầu bằng a như "aggregation")
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

/**
 * Tính đáp án cho một câu hỏi từ danh sách vote.
 * Quy tắc flag tranh luận:
 *   - confidence < 0.6, HOẶC
 *   - top-2 đáp án chênh nhau <= 1 vote (khi tổng vote >= 3)
 */
export function computeAnswer(
  questionNumber: number,
  votes: RawVote[],
): AnswerResult {
  const breakdown: VoteBreakdown = { a: 0, b: 0, c: 0, d: 0 };

  for (const vote of votes) {
    const letter = parseAnswerLetter(vote.content);
    if (letter) {
      breakdown[letter]++;
    }
  }

  const totalVotes = breakdown.a + breakdown.b + breakdown.c + breakdown.d;

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

  // Sort theo số vote giảm dần
  const sorted = (["a", "b", "c", "d"] as const).sort(
    (x, y) => breakdown[y] - breakdown[x],
  );
  const topAnswer = sorted[0]!;
  const secondAnswer = sorted[1]!;

  const maxVotes = breakdown[topAnswer];
  const secondVotes = breakdown[secondAnswer];
  const confidence = maxVotes / totalVotes;

  let disputed = false;
  let disputeReason: string | undefined;

  if (confidence < 0.75) {
    disputed = true;
    disputeReason = `Confidence ${(confidence * 100).toFixed(1)}% < 75% (${maxVotes}/${totalVotes} votes)`;
  } else if (totalVotes >= 3 && secondVotes >= 1) {
    // Nếu có ít nhất 1 người vote khác → flag để review
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

/**
 * Tính đáp án cho toàn bộ đề thi từ answers.json.
 * @param answersJson - Nội dung đã parse của answers.json
 */
export function computeAllAnswers(
  answersJson: Record<string, RawVote[]>,
): AnswerResult[] {
  const results: AnswerResult[] = [];

  for (const [filename, votes] of Object.entries(answersJson)) {
    // Parse số câu từ tên file: "Q1.jpg" → 1
    const match = filename.match(/^Q(\d+)\./i);
    if (!match?.[1]) continue;

    const questionNumber = parseInt(match[1], 10);
    results.push(computeAnswer(questionNumber, votes));
  }

  return results.sort((a, b) => a.questionNumber - b.questionNumber);
}

/**
 * Convert chữ cái đáp án sang index 0-based (a=0, b=1, c=2, d=3).
 */
export function letterToIndex(letter: AnswerLetter): number {
  return { a: 0, b: 1, c: 2, d: 3 }[letter];
}

/**
 * In bảng tóm tắt kết quả ra console.
 */
export function printAnswerSummary(results: AnswerResult[]): void {
  const disputed = results.filter((r) => r.disputed);
  const confident = results.filter((r) => !r.disputed);

  console.log("\n=== KẾT QUẢ TÍNH ĐÁP ÁN ===\n");
  console.log(`Tổng câu: ${results.length}`);
  console.log(`✅ Tự động điền: ${confident.length} câu`);
  console.log(`⚠️  Cần review thủ công: ${disputed.length} câu\n`);

  console.log("--- Đáp án ---");
  for (const r of results) {
    const flag = r.disputed ? "⚠️ " : "   ";
    const breakdown = Object.entries(r.voteBreakdown)
      .filter(([, v]) => v > 0)
      .map(([k, v]) => `${k.toUpperCase()}:${v}`)
      .join(", ");
    const conf = `${(r.confidence * 100).toFixed(0)}%`;
    console.log(
      `${flag}Q${String(r.questionNumber).padStart(2, "0")}: ${r.answer.toUpperCase()} (${conf}) [${breakdown}]${r.disputeReason ? ` ← ${r.disputeReason}` : ""}`,
    );
  }

  if (disputed.length > 0) {
    console.log("\n--- Câu cần review thủ công ---");
    for (const r of disputed) {
      console.log(`  Q${r.questionNumber}: ${r.disputeReason}`);
    }
  }
  console.log("");
}
